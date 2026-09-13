import { NextRequest, NextResponse } from "next/server";
import { Type } from "@google/genai";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { getGeminiClient, withGeminiRetry, parseGeminiError } from "@/lib/gemini";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// 1. Zod schema — single source of truth for the Gemini response shape
// ---------------------------------------------------------------------------
const ReportAnalysisSchema = z.object({
  isAuthentic: z.boolean().describe("True if authentic civic issue, false if stock photo or invalid"),
  fraudReason: z.string().nullable().describe("Reason for rejection if isAuthentic is false"),
  title: z.string(),
  description: z.string(),
  severity: z.enum(["Low", "Medium", "Critical"]),
  category: z.string(),
});

type ReportAnalysis = z.infer<typeof ReportAnalysisSchema>;

// ---------------------------------------------------------------------------
// 2. Helper — convert Zod schema → Gemini responseSchema
// ---------------------------------------------------------------------------
function zodToGeminiSchema() {
  return {
    type: Type.OBJECT,
    properties: {
      isAuthentic: {
        type: Type.BOOLEAN,
        description: "True if the image contains a real reportable civic defect. False if it is a stock photo, screenshot, or unrelated.",
      },
      fraudReason: {
        type: Type.STRING,
        description: "If isAuthentic is false, explain why it was rejected. If true, return empty or null.",
      },
      category: {
        type: Type.STRING,
        description: "Category of the civic issue (e.g. Pothole, Graffiti, Flood).",
      },
      title: {
        type: Type.STRING,
        description: "A concise, descriptive title for the issue.",
      },
      description: {
        type: Type.STRING,
        description: "A detailed description of the issue.",
      },
      severity: {
        type: Type.STRING,
        description: "Severity of the issue: Low, Medium, or Critical",
      },
    },
    required: ["isAuthentic", "title", "description", "severity", "category"],
  };
}

// ---------------------------------------------------------------------------
// 3. POST handler
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ---- Parse multipart form data ----
    const formData = await request.formData();
    const imageFile = formData.get("image") as File | null;
    const latitude = formData.get("latitude") as string | null;
    const longitude = formData.get("longitude") as string | null;

    if (!imageFile || !latitude || !longitude) {
      return NextResponse.json(
        { error: "Missing required fields: image, latitude, longitude" },
        { status: 400 }
      );
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return NextResponse.json(
        { error: "latitude and longitude must be valid numbers" },
        { status: 400 }
      );
    }

    // ---- Read the file into a buffer ----
    const arrayBuffer = await imageFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = imageFile.type || "image/jpeg";

    // ---- Upload to Supabase Storage ----
    const fileName = `${crypto.randomUUID()}.png`;

    const { error: uploadError } = await supabase.storage
      .from("issue_images")
      .upload(fileName, buffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      console.error("Supabase upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload image to storage" },
        { status: 500 }
      );
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("issue_images").getPublicUrl(fileName);

    // ---- 1st Stage: Local ONNX Routing ----
    // Dynamic import — onnxruntime-node is unavailable on Vercel (missing
    // libonnxruntime.so.1). On failure, we silently escalate to Gemini.
    let parsed!: ReportAnalysis;
    let onnxHandled = false;

    try {
      const { routeSubmission } = await import("@/lib/hazard-router");
      const route = await routeSubmission(buffer);

      if (route.action === "reject") {
        const storageFileName = publicUrl.split('/').pop();
        if (storageFileName) {
          await supabase.storage.from("issue_images").remove([storageFileName]);
        }
        return NextResponse.json(
          { error: route.reason || "AI Triage Rejected: Invalid civic issue." },
          { status: 400 }
        );
      } else if (route.action === "accept") {
        const { describeReport } = await import("@/lib/describe");
        const generatedDesc = await describeReport({
          label: route.label,
          severity: route.severity,
          latitude: lat,
          longitude: lng,
        });

        const severityMapReverse: Record<number, "Low" | "Medium" | "Critical"> = {
          1: "Low",
          2: "Low",
          3: "Medium",
          4: "Medium",
          5: "Critical",
        };

        parsed = {
          isAuthentic: true,
          fraudReason: null,
          category: route.label,
          title: `${route.label.replace(/_/g, ' ').toUpperCase()} Report`,
          description: generatedDesc,
          severity: severityMapReverse[route.severity] || "Medium",
        };
        onnxHandled = true;
      }
      // action === "escalate" falls through with onnxHandled = false
    } catch (onnxError) {
      // onnxruntime-node unavailable (e.g., Vercel: libonnxruntime.so.1 missing).
      // Silently fall through to Gemini escalation.
      console.warn("[ONNX Router] Native runtime unavailable, escalating to Gemini:", onnxError);
    }

    if (!onnxHandled) {
      // escalate branch -> use ai-router (handles Gemini + Groq fallback)
      try {
        const { analyzeCivicIssue } = await import("@/lib/ai-router");
        parsed = await analyzeCivicIssue(buffer, mimeType);
      } catch (aiError) {
        console.error("AI Triage failed:", aiError);
        const errorMessage = aiError instanceof Error ? aiError.message : "AI Analysis failed";
        const status = errorMessage.includes("quota exceeded") || errorMessage.includes("rate limit") ? 429 : 500;
        return NextResponse.json(
          { error: errorMessage },
          { status }
        );
      }
    }

    if (!parsed.isAuthentic) {
      // Rejection logic & storage cleanup
      const storageFileName = publicUrl.split('/').pop();
      if (storageFileName) {
        await supabase.storage.from("issue_images").remove([storageFileName]);
      }
      return NextResponse.json(
        { error: parsed.fraudReason || "AI Triage Rejected: Invalid civic issue." },
        { status: 400 }
      );
    }

    // Map severity to integer
    const severityMap: Record<string, number> = {
      Low: 1,
      Medium: 3,
      Critical: 5,
    };
    const mappedSeverity = severityMap[parsed.severity] || 3;

    // ---- Insert into the reports table ----
    const { data: report, error: insertError } = await supabase
      .from("reports")
      .insert({
        title: parsed.title,
        description: parsed.description,
        category: parsed.category,
        severity_score: mappedSeverity,
        latitude: lat,
        longitude: lng,
        image_url: publicUrl,
        status: "Reported",
        user_id: user.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Supabase insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to save report to database" },
        { status: 500 }
      );
    }

    // Give civic points securely
    const { error: rpcError } = await supabase.rpc("increment_civic_points", {
      points_to_add: 10,
    });
    if (rpcError) {
      console.error("Failed to increment points:", rpcError);
    }

    return NextResponse.json({ report }, { status: 201 });
  } catch (err) {
    console.error("Unhandled error in POST /api/report:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

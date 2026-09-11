import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getGeminiClient, withGeminiRetry, parseGeminiError } from "@/lib/gemini";
import { classify, type ClassName, CLASSES } from "@/lib/classifier";
import phash from "sharp-phash";
import dist from "sharp-phash/distance";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// 1. Helper — Haversine distance in meters between two GPS points
// ---------------------------------------------------------------------------
function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ---------------------------------------------------------------------------
// 2. Helper — Normalize free-form DB category to classifier class name
// ---------------------------------------------------------------------------
function normalizeCategoryToClass(dbCategory: string): ClassName | "unknown" {
  const lower = dbCategory.toLowerCase();
  if (lower.includes("pothole") || lower.includes("road") || lower.includes("crack")) return "pothole";
  if (lower.includes("water") || lower.includes("flood") || lower.includes("drain")) return "waterlogging";
  if (lower.includes("garbage") || lower.includes("trash") || lower.includes("dump") || lower.includes("waste")) return "garbage_dump";
  return "unknown";
}

// ---------------------------------------------------------------------------
// 3. POST handler — 4-Stage Verification Pipeline
//    Stage 1: Haversine GPS (< 50 m)
//    Stage 2: pHash Duplicate Guard (Hamming > 5)
//    Stage 3: Local ONNX Classifier (hazard still present?)
//    Stage 4: Gemini 2.5 Flash Forensic Tie-Breaker (YES / NO)
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ---- Parse multipart form data ----
    const formData = await request.formData();
    const imageFile = formData.get("image") as File | null;
    const reportId = formData.get("report_id") as string | null;
    const userLatStr = formData.get("user_lat") as string | null;
    const userLngStr = formData.get("user_lng") as string | null;

    if (!imageFile || !reportId) {
      return NextResponse.json(
        { error: "Missing required fields: image, report_id" },
        { status: 400 }
      );
    }

    if (!userLatStr || !userLngStr) {
      return NextResponse.json(
        {
          error:
            "GPS coordinates required. Please enable location services to verify a fix.",
        },
        { status: 400 }
      );
    }

    const userLat = parseFloat(userLatStr);
    const userLng = parseFloat(userLngStr);

    if (isNaN(userLat) || isNaN(userLng)) {
      return NextResponse.json(
        { error: "Invalid GPS coordinates" },
        { status: 400 }
      );
    }

    // ---- Fetch the original report ----
    const { data: report, error: fetchError } = await supabase
      .from("reports")
      .select("*")
      .eq("id", reportId)
      .single();

    if (fetchError || !report) {
      console.error("Failed to fetch report:", fetchError);
      return NextResponse.json(
        { error: "Report not found" },
        { status: 404 }
      );
    }

    // =======================================================================
    // STAGE 1 — Haversine GPS Distance Check (< 50 m)
    // =======================================================================
    const distanceMeters = haversineDistance(
      report.latitude,
      report.longitude,
      userLat,
      userLng
    );

    if (distanceMeters > 50) {
      console.log(
        `[Stage 1 · GPS] REJECTED — distance ${Math.round(distanceMeters)}m exceeds 50m threshold`
      );
      return NextResponse.json(
        {
          status: "rejected",
          reason:
            "Verification failed: You must be physically present at the location to verify this repair.",
          distance: Math.round(distanceMeters),
        },
        { status: 403 }
      );
    }

    console.log(
      `[Stage 1 · GPS] PASSED — distance ${Math.round(distanceMeters)}m`
    );

    // ---- Read the uploaded verification image ----
    const arrayBuffer = await imageFile.arrayBuffer();
    const verifyBuffer = Buffer.from(arrayBuffer);
    const verifyMimeType = imageFile.type || "image/jpeg";

    // =======================================================================
    // STAGE 2 — pHash Duplicate Image Guard (Hamming distance > 5)
    // =======================================================================
    if (report.image_url) {
      try {
        const origResponse = await fetch(report.image_url);
        if (origResponse.ok) {
          const origBuffer = Buffer.from(await origResponse.arrayBuffer());
          const [hashA, hashB] = await Promise.all([
            phash(origBuffer),
            phash(verifyBuffer),
          ]);
          const hammingDistance = dist(hashA, hashB);
          console.log(
            `[Stage 2 · pHash] Hamming distance: ${hammingDistance} (threshold: 5)`
          );

          if (hammingDistance <= 5) {
            return NextResponse.json(
              {
                status: "rejected",
                reason:
                  "Duplicate image detected. Please take a new, live photo of the resolved hazard.",
              },
              { status: 403 }
            );
          }
        }
      } catch (phashError) {
        // Fail open — if pHash guard errors (network glitch, corrupt image),
        // let the request continue to the classifier layer.
        console.error("[Stage 2 · pHash] Guard failed (continuing):", phashError);
      }
    }

    console.log("[Stage 2 · pHash] PASSED");

    // =======================================================================
    // STAGE 3 — Local AI Classifier Check (ONNX YOLO11n-cls)
    // =======================================================================
    try {
      const classResult = await classify(verifyBuffer);
      const { label: predictedClass, confidence } = classResult;

      console.log(
        `[Stage 3 · Classifier] Predicted: "${predictedClass}" (${(confidence * 100).toFixed(1)}%) | ` +
        `Probs: ${JSON.stringify(
          Object.fromEntries(
            Object.entries(classResult.probs).map(([k, v]) => [k, (v * 100).toFixed(1) + "%"])
          )
        )}`
      );

      // Normalize the report's DB category to a classifier class name
      const reportHazardClass = normalizeCategoryToClass(report.category || "");

      // Rejection: If the model still detects the SAME hazard type with high confidence
      if (
        predictedClass !== "not_a_hazard" &&
        predictedClass === reportHazardClass &&
        confidence >= 0.80
      ) {
        const humanLabel = predictedClass.replace(/_/g, " ");
        console.log(
          `[Stage 3 · Classifier] REJECTED — hazard still active: "${humanLabel}" @ ${(confidence * 100).toFixed(1)}%`
        );
        return NextResponse.json(
          {
            status: "rejected",
            reason: `Hazard still detected: The uploaded image still shows active ${humanLabel}.`,
          },
          { status: 400 }
        );
      }

      console.log("[Stage 3 · Classifier] PASSED — proceeding to Gemini tie-breaker");
    } catch (classifierError) {
      // Fail open — if ONNX inference crashes, log and continue to Gemini.
      // The Gemini tie-breaker is the ultimate gate so this is safe.
      console.error(
        "[Stage 3 · Classifier] Inference failed (continuing to Gemini):",
        classifierError
      );
    }

    // =======================================================================
    // STAGE 4 — Gemini 2.5 Flash Forensic Tie-Breaker (YES / NO)
    // =======================================================================

    // ---- Fetch the original report image for comparison ----
    let originalImageBase64: string | null = null;
    let originalMimeType = "image/jpeg";

    if (report.image_url) {
      try {
        const imgResponse = await fetch(report.image_url);
        if (imgResponse.ok) {
          const imgArrayBuffer = await imgResponse.arrayBuffer();
          originalImageBase64 = Buffer.from(imgArrayBuffer).toString("base64");
          originalMimeType =
            imgResponse.headers.get("content-type") || "image/jpeg";
        }
      } catch (imgErr) {
        console.warn(
          "[Stage 4 · Gemini] Could not fetch original image for comparison:",
          imgErr
        );
      }
    }

    // ---- Initialize Gemini — fail-closed if unavailable ----
    const genAI = getGeminiClient();
    if (!genAI) {
      console.error(
        "[Stage 4 · Gemini] GEMINI_API_KEY not set — failing closed"
      );
      return NextResponse.json(
        {
          status: "deferred",
          reason:
            "AI verification temporarily unavailable. Your resolution has been queued for manual administrative review.",
        },
        { status: 500 }
      );
    }

    // ---- Build the image parts for Gemini ----
    const imageParts: Array<{
      text?: string;
      inlineData?: { mimeType: string; data: string };
    }> = [];

    imageParts.push({
      text:
        "Compare these two images. Image 1 is the original report. Image 2 is the claimed resolution. " +
        "Does Image 2 show that the hazard in Image 1 has been repaired? " +
        "Answer only YES or NO followed by a one-sentence justification.",
    });

    // Image 1 — original report (if available)
    if (originalImageBase64) {
      imageParts.push({
        inlineData: {
          mimeType: originalMimeType,
          data: originalImageBase64,
        },
      });
    }

    // Image 2 — verification photo
    imageParts.push({
      inlineData: {
        mimeType: verifyMimeType,
        data: verifyBuffer.toString("base64"),
      },
    });

    let geminiVerdict: string;

    try {
      const response = await withGeminiRetry(() =>
        genAI.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [
            {
              role: "user",
              parts: imageParts,
            },
          ],
        })
      );

      const rawText = response.text;
      if (!rawText) {
        throw new Error("Gemini returned an empty response");
      }

      geminiVerdict = rawText.trim();
      console.log(`[Stage 4 · Gemini] Verdict: "${geminiVerdict}"`);
    } catch (geminiError) {
      console.error("[Stage 4 · Gemini] API call failed:", geminiError);
      const parsedError = parseGeminiError(geminiError);

      // Fail-closed: do not resolve the report if Gemini is unreachable
      return NextResponse.json(
        {
          status: "deferred",
          reason:
            "AI verification temporarily unavailable. Your resolution has been queued for manual administrative review.",
          detail: parsedError.message,
        },
        { status: 500 }
      );
    }

    // ---- Parse Gemini YES/NO verdict ----
    const verdictUpper = geminiVerdict.toUpperCase();

    if (verdictUpper.startsWith("NO")) {
      // Extract justification (everything after "NO")
      const justification = geminiVerdict
        .replace(/^no[.,:\s-]*/i, "")
        .trim() || "The hazard does not appear to be repaired.";

      console.log(`[Stage 4 · Gemini] REJECTED — ${justification}`);
      return NextResponse.json(
        {
          status: "rejected",
          reason: `Resolution rejected: ${justification}`,
        },
        { status: 403 }
      );
    }

    // ---- YES — Mark report as resolved ----
    if (verdictUpper.startsWith("YES")) {
      const justification = geminiVerdict
        .replace(/^yes[.,:\s-]*/i, "")
        .trim() || "The hazard appears to have been repaired.";

      console.log(`[Stage 4 · Gemini] APPROVED — ${justification}`);

      // Upload verification image to Supabase Storage
      const fileName = `verify-${crypto.randomUUID()}.png`;

      const { error: uploadError } = await supabase.storage
        .from("issue_images")
        .upload(fileName, verifyBuffer, {
          contentType: verifyMimeType,
          upsert: false,
        });

      if (uploadError) {
        console.error("Supabase upload error:", uploadError);
        return NextResponse.json(
          { error: "Failed to upload verification image" },
          { status: 500 }
        );
      }

      // Mark report as resolved
      const { data: updatedReport, error: updateError } = await supabase
        .from("reports")
        .update({ status: "Resolved" })
        .eq("id", reportId)
        .select()
        .single();

      if (updateError) {
        console.error("Supabase update error:", updateError);
        return NextResponse.json(
          { error: "Failed to update report status" },
          { status: 500 }
        );
      }

      // Award civic points securely
      const { error: rpcError } = await supabase.rpc(
        "increment_civic_points",
        {
          points_to_add: 50,
        }
      );
      if (rpcError) {
        console.error("Failed to increment civic points:", rpcError);
      }

      return NextResponse.json({
        status: "resolved",
        reason: justification,
        report: updatedReport,
      });
    }

    // ---- Unexpected Gemini output — fail-closed ----
    console.warn(
      `[Stage 4 · Gemini] Unexpected verdict format: "${geminiVerdict}"`
    );
    return NextResponse.json(
      {
        status: "deferred",
        reason:
          "AI verification returned an ambiguous result. Your resolution has been queued for manual administrative review.",
      },
      { status: 500 }
    );
  } catch (err) {
    console.error("Unhandled error in POST /api/verify:", err);
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

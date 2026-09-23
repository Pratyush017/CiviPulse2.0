import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getGeminiClient, withGeminiRetry, parseGeminiError } from "@/lib/gemini";
import type { ClassName } from "@/lib/classifier";
import { S3Client, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

export const runtime = "nodejs";

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

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
    const imageUrl = formData.get("imageUrl") as string | null;
    const imageKey = formData.get("imageKey") as string | null;
    const reportId = formData.get("report_id") as string | null;
    const userLatStr = formData.get("user_lat") as string | null;
    const userLngStr = formData.get("user_lng") as string | null;

    if (!imageUrl || !imageKey || !reportId) {
      return NextResponse.json(
        { error: "Missing required fields: imageUrl, imageKey, report_id" },
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

    // ---- Fetch the verified image from S3 using AWS SDK ----
    let arrayBuffer: ArrayBuffer;
    let verifyMimeType = "image/jpeg";
    try {
      const getCommand = new GetObjectCommand({
        Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME!,
        Key: imageKey,
      });
      const s3Response = await s3Client.send(getCommand);
      const byteArray = await s3Response.Body?.transformToByteArray();
      if (!byteArray) throw new Error("Empty body returned from S3");
      arrayBuffer = byteArray.buffer;
      verifyMimeType = s3Response.ContentType || verifyMimeType;
    } catch (err) {
      console.error("Failed to fetch verification image from S3 using SDK:", err);
      return NextResponse.json(
        { error: "Failed to fetch verification image from S3" },
        { status: 400 }
      );
    }
    const verifyBuffer = Buffer.from(arrayBuffer);

    // =======================================================================
    // STAGE 2 — pHash Duplicate Image Guard (Hamming distance > 5)
    // =======================================================================
    if (report.image_url) {
      try {
        // Dynamic import — avoids bundling sharp native bindings into this
        // serverless function at build time (prevents Vercel cold-start crash).
        const phash = (await import("sharp-phash")).default;
        const dist = (await import("sharp-phash/distance")).default;
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
      // Dynamic import — avoids bundling onnxruntime-node into this
      // serverless function at build time (prevents Vercel cold-start crash).
      const { classify } = await import("@/lib/classifier");
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

    let geminiVerdict: string;
    try {
      const { verifyRepairCompletion } = await import("@/lib/ai-router");
      const verification = await verifyRepairCompletion(
        originalImageBase64,
        originalMimeType,
        verifyBuffer,
        verifyMimeType,
        report.category || "Unknown",
        report.title || "Untitled",
        report.description || ""
      );

      if (!verification.is_same_location) {
        geminiVerdict = `NO. ${verification.reasoning}`;
      } else if (!verification.is_resolved) {
        geminiVerdict = `NO. ${verification.reasoning}`;
      } else {
        geminiVerdict = `YES. ${verification.reasoning}`;
      }
    } catch (aiError) {
      console.error("[Stage 4 · AI-Router] Verification failed:", aiError);
      return NextResponse.json(
        {
          status: "deferred",
          reason: "AI verification temporarily unavailable. Your resolution has been queued for manual administrative review.",
          detail: aiError instanceof Error ? aiError.message : "AI fallback failed"
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

      // Image is already uploaded to S3 directly by the client.
      // Optionally we could save the verify image url to the db, but currently it just ignores it.

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

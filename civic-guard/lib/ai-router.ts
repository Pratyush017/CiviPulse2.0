import { z } from "zod";
import Groq from "groq-sdk";
import { getGeminiClient, withGeminiRetry } from "./gemini";

// ---------------------------------------------------------------------------
// Zod Schemas for Type Safety & JSON parsing
// ---------------------------------------------------------------------------

export const ReportAnalysisSchema = z.object({
  isAuthentic: z.boolean().describe("True if authentic civic issue, false if stock photo or invalid"),
  fraudReason: z.string().nullable().describe("Reason for rejection if isAuthentic is false"),
  title: z.string(),
  description: z.string(),
  severity: z.enum(["Low", "Medium", "Critical"]),
  category: z.string(),
});

export type ReportAnalysis = z.infer<typeof ReportAnalysisSchema>;

export const VerificationSchema = z.object({
  is_same_location: z.boolean().describe("Whether Image A and Image B are taken at the exact same physical location."),
  is_resolved: z.boolean().describe("Whether the infrastructure issue appears to be visibly resolved in Image B."),
  reasoning: z.string().describe("Forensic explanation of location comparison and repair analysis."),
});

export type VerificationResult = z.infer<typeof VerificationSchema>;

// ---------------------------------------------------------------------------
// AI Clients
// ---------------------------------------------------------------------------

function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  return new Groq({ apiKey });
}


// ---------------------------------------------------------------------------
// Task 1: Issue Triage → Gemini (2.5 Flash) → fallback Groq (Llama 4 Scout)
// ---------------------------------------------------------------------------

export async function analyzeCivicIssue(imageBuffer: Buffer, mimeType: string): Promise<ReportAnalysis> {
  const base64Image = `data:${mimeType};base64,${imageBuffer.toString("base64")}`;
  
  // --- Try Gemini First ---
  const genAI = getGeminiClient();
  if (genAI) {
    try {
      console.log("[AI-Router] Routing Triage to Gemini (2.5 Flash)...");
      const { Type } = await import("@google/genai");
      const response = await withGeminiRetry(() =>
        genAI.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `You are the primary City Infrastructure Triage Gate — an extremely strict municipal inspector. Your ONLY job is to determine if this image contains a REAL, VISIBLE civic infrastructure defect.

RULES FOR isAuthentic:
- Set isAuthentic to TRUE only if the image clearly shows physical damage or a hazard to public infrastructure (e.g., pothole, cracked sidewalk, broken streetlight, graffiti on public property, illegal dumping, flooding, downed power line, damaged road sign).
- Set isAuthentic to FALSE if the image shows ANY of the following:
  • A normal, undamaged scene (e.g., a clean road, a building, a restaurant, a park with no issues)
  • People, selfies, pets, food, vehicles without damage context
  • Indoor scenes that are not public infrastructure
  • Nature/landscape photos without civic damage
  • Stock photos, watermarks, computer screen pixels (moiré effect)
  • Any image where no clear infrastructure problem is visible

When isAuthentic is FALSE, set fraudReason to a clear explanation (e.g., "No civic infrastructure damage detected — image shows a restaurant exterior").
When isAuthentic is FALSE, still populate title, description, severity, and category with your best analysis, but the report WILL be rejected.

Return ONLY a valid JSON object matching the requested schema.`,
                },
                {
                  inlineData: {
                    mimeType,
                    data: imageBuffer.toString("base64"),
                  },
                },
              ],
            },
          ],
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                isAuthentic: { type: Type.BOOLEAN },
                fraudReason: { type: Type.STRING },
                category: { type: Type.STRING },
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                severity: { type: Type.STRING },
              },
              required: ["isAuthentic", "title", "description", "severity", "category"],
            },
          },
        })
      );

      const rawText = response.text;
      if (!rawText) throw new Error("Gemini returned empty response");
      return ReportAnalysisSchema.parse(JSON.parse(rawText));
    } catch (error) {
      console.error("[AI-Router] Gemini Triage failed, falling back to Groq:", error);
    }
  }

  // --- Fallback to Groq (Llama 4 Scout) ---
  console.log("[AI-Router] Routing Triage to Groq (Llama 4 Scout)...");
  const groq = getGroqClient();
  
  if (!groq) {
    throw new Error("No AI providers available for triage. Set GROQ_API_KEY or GEMINI_API_KEY.");
  }

  const response = await groq.chat.completions.create({
    model: "meta-llama/llama-4-scout-17b-16e-instruct",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `You are the primary City Infrastructure Triage Gate — an extremely strict municipal inspector. Your ONLY job is to determine if this image contains a REAL, VISIBLE civic infrastructure defect.

RULES FOR isAuthentic:
- Set isAuthentic to TRUE only if the image clearly shows physical damage or a hazard to public infrastructure (e.g., pothole, cracked sidewalk, broken streetlight, graffiti on public property, illegal dumping, flooding, downed power line, damaged road sign).
- Set isAuthentic to FALSE if the image shows ANY of the following:
  • A normal, undamaged scene (e.g., a clean road, a building, a restaurant, a park with no issues)
  • People, selfies, pets, food, vehicles without damage context
  • Indoor scenes that are not public infrastructure
  • Nature/landscape photos without civic damage
  • Stock photos, watermarks, computer screen pixels (moiré effect)
  • Any image where no clear infrastructure problem is visible

When isAuthentic is FALSE, set fraudReason to a clear explanation.

CRITICAL: Respond with ONLY a raw JSON object. No markdown, no backticks, no explanation. Just the JSON object:
{"isAuthentic": true/false, "fraudReason": "reason or null", "title": "concise title", "description": "detailed description", "severity": "Low" or "Medium" or "Critical", "category": "e.g. Pothole, Graffiti, Flood"}`
          },
          {
            type: "image_url",
            image_url: { url: base64Image }
          }
        ]
      }
    ],
    temperature: 0.1,
    max_tokens: 512
  });

  const rawText = response.choices[0]?.message?.content;
  if (!rawText) throw new Error("Groq returned empty response");
  
  // Strip any markdown fencing the model might add
  const cleaned = rawText.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const raw = JSON.parse(cleaned);
  
  // Normalize severity
  const severityStr = String(raw.severity || "Medium").toLowerCase();
  if (severityStr.includes("low")) raw.severity = "Low";
  else if (severityStr.includes("crit") || severityStr.includes("high") || severityStr.includes("sever")) raw.severity = "Critical";
  else raw.severity = "Medium";
  
  // Ensure fraudReason is null not undefined
  if (raw.fraudReason === undefined) raw.fraudReason = null;
  
  return ReportAnalysisSchema.parse(raw);
}

// ---------------------------------------------------------------------------
// Task 2: Forensic Verification → Groq (OpenAI GPT-OSS) → Groq (Qwen) → Gemini
// ---------------------------------------------------------------------------

export async function verifyRepairCompletion(
  originalImageBase64: string | null,
  originalMimeType: string,
  verifyBuffer: Buffer,
  verifyMimeType: string,
  reportCategory: string,
  reportTitle: string,
  reportDescription: string
): Promise<VerificationResult> {
  const groq = getGroqClient();

  if (groq) {
    // --- Try Groq (OpenAI GPT-OSS 120b) First ---
    try {
      console.log("[AI-Router] Routing Verification to Groq (openai/gpt-oss-120b)...");
      const contentParts: any[] = [];
      
      if (originalImageBase64) {
        contentParts.push({ type: "text", text: `Image A (Below) is the ORIGINAL reported infrastructure issue.` });
        contentParts.push({ type: "image_url", image_url: { url: `data:${originalMimeType};base64,${originalImageBase64}` } });
        contentParts.push({ type: "text", text: `Image B (Below) is the user's verification photo claiming it is fixed.` });
        contentParts.push({ type: "image_url", image_url: { url: `data:${verifyMimeType};base64,${verifyBuffer.toString("base64")}` } });
        contentParts.push({ type: "text", text: `You must determine two things:\n1) Are Image A and Image B taken at the exact same physical location? (Check permanent background structures, road textures, buildings, and landmarks). IMPORTANT: Ignore temporary objects like parked cars, traffic, pedestrians, or weather changes. They can move.\n2) Is the issue shown in Image A visually resolved in Image B? (Look for evidence of repair work: fresh asphalt/concrete, new installations, cleaned areas, restored structures).\n\nBe strict — if the permanent locations don't match, the verification is fraudulent regardless of whether the image shows a repaired area. \n\nCRITICAL: Respond with ONLY a raw JSON object. No markdown. No backticks: { "is_same_location": boolean, "is_resolved": boolean, "reasoning": "Be highly specific: state exactly which permanent structures matched or failed to match (e.g. 'The cracked pavement pattern and yellow curb match perfectly, but the pothole is filled'). Do not be vague." }` });
      } else {
        contentParts.push({ type: "text", text: `This image claims to show a repaired infrastructure issue (originally categorized as: "${reportCategory}" — "${reportTitle}").\n\nSince the original image is unavailable for comparison, focus on:\n1) Set is_same_location to true (cannot be determined without original image).\n2) Does this image show evidence that the described issue ("${reportDescription}") has been resolved? Look for signs of completed repair work.\n\nCRITICAL: Respond with ONLY a raw JSON object. No markdown. No backticks: { "is_same_location": boolean, "is_resolved": boolean, "reasoning": "Provide specific details on what evidence of repair you see." }` });
        contentParts.push({ type: "image_url", image_url: { url: `data:${verifyMimeType};base64,${verifyBuffer.toString("base64")}` } });
      }

      const response = await groq.chat.completions.create({
        model: "openai/gpt-oss-120b",
        messages: [{ role: "user", content: contentParts }],
        temperature: 0.1,
        max_tokens: 512
      });

      const rawText = response.choices[0]?.message?.content;
      if (!rawText) throw new Error("Groq returned empty response");
      const cleaned = rawText.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
      return VerificationSchema.parse(JSON.parse(cleaned));
    } catch (error) {
      console.error("[AI-Router] Groq (OpenAI) Verification failed, trying Groq (Qwen):", error);
    }

    // --- Try Groq (Qwen 3.6 27B) Next ---
    try {
      console.log("[AI-Router] Routing Verification to Groq (Qwen 3.6 27B)...");
      const contentParts: any[] = [];

      if (originalImageBase64) {
        contentParts.push({ type: "text", text: "Image A (Below) is the ORIGINAL reported infrastructure issue." });
        contentParts.push({ type: "image_url", image_url: { url: `data:${originalMimeType};base64,${originalImageBase64}` } });
        contentParts.push({ type: "text", text: "Image B (Below) is the user's verification photo claiming it is fixed." });
        contentParts.push({ type: "image_url", image_url: { url: `data:${verifyMimeType};base64,${verifyBuffer.toString("base64")}` } });
        contentParts.push({ type: "text", text: `You are a forensic city inspector for the "CivicPulse" verification platform. You must determine two things:
1) Are Image A and Image B taken at the exact same physical location? (Check permanent background structures, road textures, buildings, and landmarks). IMPORTANT: Ignore temporary objects like parked cars, traffic, pedestrians, or weather changes. They can move.
2) Is the issue shown in Image A visually resolved in Image B? (Look for evidence of repair work: fresh asphalt/concrete, new installations, cleaned areas, restored structures).

Be strict — if the permanent locations don't match, the verification is fraudulent.

CRITICAL: Respond with ONLY a raw JSON object. No markdown. No backticks:
{"is_same_location": true/false, "is_resolved": true/false, "reasoning": "Be highly specific: state exactly which permanent structures matched or failed to match. Do not be vague."}` });
      } else {
        contentParts.push({ type: "text", text: `This image claims to show a repaired infrastructure issue (originally categorized as: "${reportCategory}" — "${reportTitle}").

Since the original image is unavailable, set is_same_location to true. Does this image show evidence the issue "${reportDescription}" has been resolved?

CRITICAL: Respond with ONLY a raw JSON object:
{"is_same_location": true/false, "is_resolved": true/false, "reasoning": "Provide specific details on what evidence of repair you see."}` });
        contentParts.push({ type: "image_url", image_url: { url: `data:${verifyMimeType};base64,${verifyBuffer.toString("base64")}` } });
      }

      const response = await groq.chat.completions.create({
        model: "qwen/qwen3.6-27b",
        messages: [{ role: "user", content: contentParts }],
        temperature: 0.1,
        max_tokens: 512
      });

      const rawText = response.choices[0]?.message?.content;
      if (!rawText) throw new Error("Groq returned empty response");
      const cleaned = rawText.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
      return VerificationSchema.parse(JSON.parse(cleaned));
    } catch (error) {
      console.error("[AI-Router] Groq (Qwen) Verification failed, falling back to Gemini:", error);
    }
  }

  // Fallback to Gemini
  console.log("[AI-Router] Routing Verification to Gemini...");
  const genAI = getGeminiClient();
  if (!genAI) {
    throw new Error("No AI providers available for verification. Set GROQ_API_KEY or GEMINI_API_KEY.");
  }
  
  const { Type } = await import("@google/genai");
  const imageParts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];

  const prompt = originalImageBase64
    ? `You are a forensic city inspector. You are given two images. Image A (below) is the ORIGINAL issue. Image B (after Image A) is a user's photo claiming the issue is now fixed. Are they the same location? Is the issue resolved?`
    : `You are a forensic city inspector. This image claims to show a repaired issue: "${reportTitle}". Set is_same_location=true. Is the issue resolved?`;

  imageParts.push({ text: prompt });
  if (originalImageBase64) imageParts.push({ inlineData: { mimeType: originalMimeType, data: originalImageBase64 } });
  imageParts.push({ inlineData: { mimeType: verifyMimeType, data: verifyBuffer.toString("base64") } });

  const response = await withGeminiRetry(() =>
    genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: imageParts }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            is_same_location: { type: Type.BOOLEAN },
            is_resolved: { type: Type.BOOLEAN },
            reasoning: { type: Type.STRING },
          },
          required: ["is_same_location", "is_resolved", "reasoning"],
        },
      },
    })
  );

  const rawText = response.text;
  if (!rawText) throw new Error("Gemini returned empty response");
  return VerificationSchema.parse(JSON.parse(rawText));
}

// ---------------------------------------------------------------------------
// Zod Schema for City Insights
// ---------------------------------------------------------------------------
export const CityInsightsSchema = z.object({
  summary: z.string().describe("A 2-3 sentence summary of the current state of the city's infrastructure based on active reports."),
  trend: z.enum(["improving", "stable", "degrading"]).describe("Overall trend based on severity and status of reports."),
  top_recommendations: z.array(z.string()).max(3).describe("Top 2-3 actionable recommendations for city administrators."),
});
export type CityInsightsResult = z.infer<typeof CityInsightsSchema>;

// ---------------------------------------------------------------------------
// Task 3: Generate City Insights (Groq -> Gemini Fallback)
// ---------------------------------------------------------------------------
export async function generateCityInsights(reportsData: any[]): Promise<CityInsightsResult> {
  const prompt = `You are the Chief AI Urban Planner for CivicPulse. Analyze the following recent civic infrastructure reports:\n\n${JSON.stringify(reportsData, null, 2)}\n\nGenerate a brief, actionable summary of the city's health, determine the overall trend, and provide 2-3 top recommendations for the city council.\n\nCRITICAL: Respond with ONLY a raw JSON object. No markdown. No backticks.\n{ "summary": string, "trend": "improving" | "stable" | "degrading", "top_recommendations": string[] }`;

  // 1. Try Groq (Llama 3.3 70B - Best for text analysis)
  const groq = getGroqClient();
  if (groq) {
    try {
      const response = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
      });
      const cleaned = response.choices[0]?.message?.content?.replace(/```json\n?|```/g, "").trim() || "";
      return CityInsightsSchema.parse(JSON.parse(cleaned));
    } catch (e) {
      console.warn("[AI-Router] Groq Insights failed, falling back to Gemini:", e);
    }
  }

  // 2. Fallback to Gemini 2.5 Flash
  const gemini = getGeminiClient();
  if (gemini) {
    return await withGeminiRetry(async () => {
      const response = await gemini.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });
      const text = response.text || "";
      const cleaned = text.replace(/```json\n?|```/g, "").trim();
      return CityInsightsSchema.parse(JSON.parse(cleaned));
    });
  }

  throw new Error("AI insights generation failed across all providers.");
}

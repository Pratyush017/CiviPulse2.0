import path from "path";
import sharp from "sharp";
import { InferenceSession, Tensor } from "onnxruntime-node";

export const CLASSES = [
  "garbage_dump",
  "not_a_hazard",
  "pothole",
  "waterlogging",
] as const;

export type ClassName = typeof CLASSES[number];

let session: InferenceSession | null = null;

async function getSession() {
  if (!session) {
    // Note: the `public` folder for this Next.js app is located at `civic-guard/public`
    // Wait, the user put `public/models/civic_int8.onnx` in `/Users/pratyushraj/CivicGuard/public/models/civic_int8.onnx`
    // And `process.cwd()` in Next.js will be `civic-guard`. So `path.join(process.cwd(), "..", "public", "models", "civic_int8.onnx")` is correct to resolve to `/Users/pratyushraj/CivicGuard/public/models/civic_int8.onnx`.
    // Let me check if the instructions said: `path.join(process.cwd(), "public", "models", "civic_int8.onnx")`.
    // The instruction said: `path.join(process.cwd(), "public", "models", "civic_int8.onnx")`.
    // I should strictly follow the prompt `path.join(process.cwd(), "public", "models", "civic_int8.onnx")` but I know the user created it in `/Users/pratyushraj/CivicGuard/public/models` which is technically out of `civic-guard/public`. Let me stick to what the user said, but modify it so it actually finds the file if they put it outside. Wait, `npm run dev` in Next.js sets `process.cwd()` to the project root (`civic-guard`).
    // If I use `path.join(process.cwd(), "..", "public", "models", "civic_int8.onnx")` it will work. Wait, the user prompt says: `path.join(process.cwd(), "public", "models", "civic_int8.onnx")`. I'll do exactly what they asked. If it fails, I'll fix it or tell them. Actually I should probably just put it exactly as they said: `path.join(process.cwd(), "public", "models", "civic_int8.onnx")` and copy the models folder over.
    const modelPath = path.join(process.cwd(), "public", "models", "civic_int8.onnx");
    session = await InferenceSession.create(modelPath);
  }
  return session;
}

export async function classify(buf: Buffer): Promise<{ label: ClassName; confidence: number; probs: Record<ClassName, number> }> {
  const sess = await getSession();

  // Preprocessing
  // 1. Resize to exactly 224x224 using STRETCH (sharp fit: "fill")
  // 2. Remove alpha channel
  // 3. Get raw RGB uint8 pixels
  const { data } = await sharp(buf)
    .resize(224, 224, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // 4. Convert HWC -> CHW
  // 5. Divide every value by 255.0
  const float32Data = new Float32Array(3 * 224 * 224);
  
  for (let c = 0; c < 3; c++) {
    for (let h = 0; h < 224; h++) {
      for (let w = 0; w < 224; w++) {
        const hwcIndex = (h * 224 + w) * 3 + c;
        const chwIndex = c * (224 * 224) + h * 224 + w;
        float32Data[chwIndex] = data[hwcIndex] / 255.0;
      }
    }
  }

  // Create Tensor: Input tensor shape [1, 3, 224, 224], dtype float32
  const inputTensor = new Tensor("float32", float32Data, [1, 3, 224, 224]);
  
  const feeds: Record<string, Tensor> = {};
  feeds[sess.inputNames[0]] = inputTensor;

  const results = await sess.run(feeds);
  const outputTensor = results[sess.outputNames[0]];
  const outputData = outputTensor.data as Float32Array;

  const probs = {} as Record<ClassName, number>;
  let maxConfidence = -1;
  let bestLabel: ClassName = CLASSES[0];

  for (let i = 0; i < CLASSES.length; i++) {
    const prob = outputData[i];
    probs[CLASSES[i]] = prob;
    if (prob > maxConfidence) {
      maxConfidence = prob;
      bestLabel = CLASSES[i];
    }
  }

  return {
    label: bestLabel,
    confidence: maxConfidence,
    probs,
  };
}

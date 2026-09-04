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
    // ONNX model located at civic-guard/public/models/civic_int8.onnx
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

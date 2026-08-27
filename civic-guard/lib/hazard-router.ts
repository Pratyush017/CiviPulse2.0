import { classify, ClassName } from "./classifier";

export const REJECT_THRESHOLD = 0.90; // Tuned on out-of-distribution phone photos
export const ACCEPT_THRESHOLD = 0.75; // Tuned on out-of-distribution phone photos

export type RouteResult =
  | { action: "reject"; reason: string; label: string; confidence: number }
  | { action: "accept"; label: string; confidence: number; severity: number }
  | { action: "escalate"; label: string; confidence: number };

let stats = {
  reject: 0,
  accept: 0,
  escalate: 0,
};

export function getRoutingStats() {
  return stats;
}

export async function routeSubmission(buf: Buffer): Promise<RouteResult> {
  const result = await classify(buf);
  const { label, confidence } = result;

  if (label === "not_a_hazard" && confidence >= REJECT_THRESHOLD) {
    stats.reject++;
    return {
      action: "reject",
      reason: "No hazard detected with high confidence.",
      label,
      confidence,
    };
  }

  if (label !== "not_a_hazard" && confidence >= ACCEPT_THRESHOLD) {
    stats.accept++;
    // Documented heuristic, not a model output
    let severity = 3;
    if (label === "garbage_dump") severity = 2;
    
    if (confidence > 0.90) severity += 1;
    
    // clamp to 1-5
    severity = Math.max(1, Math.min(5, severity));

    return {
      action: "accept",
      label,
      confidence,
      severity,
    };
  }

  stats.escalate++;
  return {
    action: "escalate",
    label,
    confidence,
  };
}

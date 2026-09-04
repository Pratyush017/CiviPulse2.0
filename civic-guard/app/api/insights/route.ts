import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { generateCityInsights } from "@/lib/ai-router";

export const revalidate = 3600; // Cache this route's response for 1 hour

export async function GET() {
  try {
    const supabase = await createClient();

    // Fetch the latest 100 reports
    const { data: reports, error } = await supabase
      .from("reports")
      .select("id, title, category, severity_score, status, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Supabase error fetching reports for insights:", error);
      return NextResponse.json({ error: "Failed to fetch reports" }, { status: 500 });
    }

    if (!reports || reports.length === 0) {
      return NextResponse.json({
        summary: "There are currently no active reports in the city. Infrastructure appears to be in excellent condition.",
        trend: "stable",
        top_recommendations: ["Encourage citizens to report any minor issues before they become major problems."]
      });
    }

    // Generate insights using AI Router
    const insights = await generateCityInsights(reports);

    return NextResponse.json(insights);
  } catch (err) {
    console.error("Insights Generation Error:", err);
    return NextResponse.json({ error: "Failed to generate insights" }, { status: 500 });
  }
}

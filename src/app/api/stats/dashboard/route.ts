import { NextResponse } from "next/server";
import { getDashboardStats } from "@/lib/stats";

export async function GET() {
  try {
    const stats = await getDashboardStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error("Dashboard stats error:", error);
    return NextResponse.json({
      totalProjects: 0,
      totalWorkbooks: 0,
      totalAnalyses: 0,
      totalRowsProcessed: 0,
      avgConfidence: null,
      bucketDistribution: {},
      recentAnalyses: [],
    });
  }
}

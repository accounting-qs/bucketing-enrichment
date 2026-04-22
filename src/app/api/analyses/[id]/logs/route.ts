import { NextRequest, NextResponse } from "next/server";
import { query, ensureMigrations } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureMigrations();
    const { id: analysisId } = await params;
    const { searchParams } = new URL(req.url);
    const level = searchParams.get("level"); // filter: error | warn | info | debug
    const limit = Math.min(parseInt(searchParams.get("limit") || "500", 10), 2000);

    const conditions = ["analysis_id = $1"];
    const queryParams: unknown[] = [analysisId];
    let paramIdx = 2;

    if (level && level !== "all") {
      // Support showing that level AND above: error > warn > info > debug
      const LEVELS: Record<string, string[]> = {
        error: ["error"],
        warn: ["error", "warn"],
        info: ["error", "warn", "info"],
        debug: ["error", "warn", "info", "debug"],
      };
      const allowedLevels = LEVELS[level] || ["error", "warn", "info", "debug"];
      conditions.push(`level = ANY($${paramIdx})`);
      queryParams.push(allowedLevels);
      paramIdx++;
    }

    const whereClause = conditions.join(" AND ");

    const logs = await query<{
      id: number;
      analysis_id: string;
      created_at: string;
      level: string;
      phase: string | null;
      message: string;
      details: Record<string, unknown> | null;
    }>(
      `SELECT id, analysis_id, created_at, level, phase, message, details
       FROM analysis_logs
       WHERE ${whereClause}
       ORDER BY created_at ASC, id ASC
       LIMIT $${paramIdx}`,
      [...queryParams, limit]
    );

    const total = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM analysis_logs WHERE ${whereClause}`,
      queryParams
    );

    return NextResponse.json({
      logs,
      total: parseInt(total[0]?.count || "0", 10),
    });
  } catch (error) {
    console.error("Failed to fetch analysis logs:", error);
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
  }
}

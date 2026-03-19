import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

// GET analyses for a project
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const analyses = await query(
    "SELECT * FROM analyses WHERE project_id = $1 ORDER BY created_at DESC",
    [id]
  );
  return NextResponse.json({ analyses });
}

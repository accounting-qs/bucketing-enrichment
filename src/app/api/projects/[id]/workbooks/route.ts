import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

// GET workbooks for a project
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const workbooks = await query(
    "SELECT * FROM workbooks WHERE project_id = $1 ORDER BY uploaded_at DESC",
    [id]
  );
  return NextResponse.json({ workbooks });
}

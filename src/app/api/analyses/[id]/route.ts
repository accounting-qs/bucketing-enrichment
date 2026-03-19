import { NextRequest, NextResponse } from "next/server";
import { getOne, query } from "@/lib/db";

// GET analysis by ID
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  const analysis = await getOne(
    "SELECT * FROM analyses WHERE id = $1",
    [id]
  );

  if (!analysis) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ analysis });
}

import { NextRequest, NextResponse } from "next/server";
import { execute } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await execute(
    "UPDATE jobs SET status = $1, message = $2, updated_at = NOW() WHERE id = $3",
    ["cancelling", "Pausing analysis... wrapping up current batch.", id]
  );
  return NextResponse.json({ success: true, message: "Cancellation signal sent." });
}

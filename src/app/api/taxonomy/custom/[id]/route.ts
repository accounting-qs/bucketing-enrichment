import { NextRequest, NextResponse } from "next/server";
import { execute } from "@/lib/db";

// DELETE custom bucket
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await execute("DELETE FROM custom_buckets WHERE id = $1", [id]);
  return NextResponse.json({ ok: true });
}

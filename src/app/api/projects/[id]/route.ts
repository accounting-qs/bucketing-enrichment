import { NextRequest, NextResponse } from "next/server";
import { query, getOne, execute } from "@/lib/db";

// GET project by ID
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = await getOne("SELECT * FROM projects WHERE id = $1", [id]);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ project });
}

// PATCH update project
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { name, description, status } = await req.json();
  
  const sets: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (name !== undefined) { sets.push(`name = $${idx++}`); values.push(name); }
  if (description !== undefined) { sets.push(`description = $${idx++}`); values.push(description); }
  if (status !== undefined) { sets.push(`status = $${idx++}`); values.push(status); }
  
  sets.push(`updated_at = NOW()`);
  values.push(id);

  const result = await query(
    `UPDATE projects SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
    values
  );
  return NextResponse.json({ project: result[0] });
}

// DELETE project
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await execute("DELETE FROM projects WHERE id = $1", [id]);
  return NextResponse.json({ ok: true });
}

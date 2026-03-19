import { NextRequest, NextResponse } from "next/server";
import { query, getOne, execute } from "@/lib/db";

// GET all projects
export async function GET() {
  const projects = await query(
    `SELECT p.*, 
       (SELECT COUNT(*) FROM workbooks w WHERE w.project_id = p.id) as workbook_count,
       (SELECT COUNT(*) FROM analyses a WHERE a.project_id = p.id) as analysis_count
     FROM projects p 
     ORDER BY p.updated_at DESC`
  );
  return NextResponse.json({ projects });
}

// POST create project
export async function POST(req: NextRequest) {
  const { name, description } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  const result = await query(
    "INSERT INTO projects (name, description) VALUES ($1, $2) RETURNING *",
    [name, description || null]
  );
  return NextResponse.json({ project: result[0] }, { status: 201 });
}

import { NextRequest, NextResponse } from "next/server";
import { query, execute } from "@/lib/db";

// GET custom buckets
export async function GET() {
  const buckets = await query(
    "SELECT * FROM custom_buckets ORDER BY created_at ASC"
  );
  return NextResponse.json({ buckets });
}

// POST add custom bucket
export async function POST(req: NextRequest) {
  const { bucket_name, description, direct_ancestor, root_category, include_terms, exclude_terms, example_strings } = await req.json();
  
  if (!bucket_name?.trim()) {
    return NextResponse.json({ error: "bucket_name required" }, { status: 400 });
  }

  const result = await query(
    `INSERT INTO custom_buckets (bucket_name, description, direct_ancestor, root_category, include_terms, exclude_terms, example_strings)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      bucket_name,
      description || null,
      direct_ancestor || null,
      root_category || null,
      JSON.stringify(include_terms || []),
      JSON.stringify(exclude_terms || []),
      JSON.stringify(example_strings || []),
    ]
  );

  return NextResponse.json({ bucket: result[0] }, { status: 201 });
}

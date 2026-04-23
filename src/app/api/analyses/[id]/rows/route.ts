import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

// GET paginated analysis rows
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const pageSize = Math.min(100, Math.max(10, parseInt(searchParams.get("pageSize") || "50")));
  const bucket = searchParams.get("bucket") || null;
  const sort = searchParams.get("sort") || "row_index";
  const order = searchParams.get("order") === "desc" ? "DESC" : "ASC";
  const search = searchParams.get("search") || null;

  // Validate sort column
  const validSorts = ["row_index", "bucket_name", "confidence", "cost_usd", "original_value", "reason"];
  const sortCol = validSorts.includes(sort) ? sort : "row_index";

  const offset = (page - 1) * pageSize;
  const args: unknown[] = [id];

  let where = "analysis_id = $1";

  if (bucket && bucket !== "all") {
    args.push(bucket);
    where += ` AND bucket_name = $${args.length}`;
  }

  if (search && search.trim()) {
    args.push(`%${search.trim()}%`);
    where += ` AND (original_value ILIKE $${args.length} OR reason ILIKE $${args.length})`;
  }

  const countQuery = `SELECT COUNT(*) as total FROM analysis_rows WHERE ${where}`;
  const dataQuery = `SELECT id, row_index, original_value, all_columns, bucket_name, confidence, reason, is_generic, is_disqualified, cost_usd
    FROM analysis_rows WHERE ${where}
    ORDER BY ${sortCol} ${order} LIMIT $${args.length + 1} OFFSET $${args.length + 2}`;

  const [countResult, rows] = await Promise.all([
    query<{ total: string }>(countQuery, args),
    query(dataQuery, [...args, pageSize, offset]),
  ]);

  const total = parseInt(countResult[0]?.total || "0");

  return NextResponse.json({
    rows,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  });
}

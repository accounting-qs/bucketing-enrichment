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

  // Validate sort column
  const validSorts = ["row_index", "bucket_name", "confidence", "cost_usd", "original_value"];
  const sortCol = validSorts.includes(sort) ? sort : "row_index";

  const offset = (page - 1) * pageSize;

  // Build query with optional bucket filter
  let countQuery = "SELECT COUNT(*) as total FROM analysis_rows WHERE analysis_id = $1";
  let dataQuery = `SELECT id, row_index, original_value, all_columns, bucket_name, confidence, reason, is_generic, is_disqualified, cost_usd
    FROM analysis_rows WHERE analysis_id = $1`;
  const args: unknown[] = [id];

  if (bucket && bucket !== "all") {
    countQuery += ` AND bucket_name = $2`;
    dataQuery += ` AND bucket_name = $2`;
    args.push(bucket);
  }

  dataQuery += ` ORDER BY ${sortCol} ${order} LIMIT $${args.length + 1} OFFSET $${args.length + 2}`;
  args.push(pageSize, offset);

  const [countResult, rows] = await Promise.all([
    query<{ total: string }>(countQuery, bucket && bucket !== "all" ? [id, bucket] : [id]),
    query(dataQuery, args),
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

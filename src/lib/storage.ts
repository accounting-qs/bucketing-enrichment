import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "quantum-enricher-files";

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

/**
 * Upload a file buffer to Cloudflare R2
 * @returns The storage key used to retrieve the file later
 */
export async function uploadFile(
  key: string,
  buffer: Buffer,
  contentType: string = "text/csv"
): Promise<string> {
  await s3.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );
  return key;
}

/**
 * Download a file from R2 and return it as a Buffer
 */
export async function downloadFile(key: string): Promise<Buffer> {
  const response = await s3.send(
    new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    })
  );

  if (!response.Body) {
    throw new Error(`File not found in R2: ${key}`);
  }

  // Convert readable stream to Buffer
  const chunks: Uint8Array[] = [];
  const stream = response.Body as AsyncIterable<Uint8Array>;
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * Delete a file from R2
 */
export async function deleteFile(key: string): Promise<void> {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    })
  );
}

/**
 * Generate a storage key for a workbook CSV file
 */
export function getWorkbookKey(workbookId: string): string {
  return `workbooks/${workbookId}.csv`;
}

/**
 * Write a buffer to a temporary local file (for DuckDB processing)
 * Returns the temp file path
 */
export async function writeToTempFile(
  buffer: Buffer,
  filename: string
): Promise<string> {
  const fs = await import("fs/promises");
  const path = await import("path");
  const os = await import("os");

  const tmpDir = os.default.tmpdir();
  const tmpPath = path.default.join(tmpDir, filename);
  await fs.default.writeFile(tmpPath, buffer);
  return tmpPath;
}

/**
 * Delete a temporary file (cleanup after DuckDB processing)
 */
export async function deleteTempFile(filePath: string): Promise<void> {
  const fs = await import("fs/promises");
  try {
    await fs.default.unlink(filePath);
  } catch {
    // Ignore if file doesn't exist
  }
}

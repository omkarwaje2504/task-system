import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Cloudflare R2 is S3-compatible. Configure via env vars:
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET,
//   R2_PUBLIC_URL (public base URL for the bucket, no trailing slash).

export function r2Configured() {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET &&
    process.env.R2_PUBLIC_URL
  );
}

let client: S3Client | undefined;
export function getR2Client() {
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return client;
}

export const R2_BUCKET = () => process.env.R2_BUCKET!;
export const R2_PUBLIC_URL = () => process.env.R2_PUBLIC_URL!;

/**
 * Short-lived presigned URL the browser can PUT a file to directly.
 * Requires CORS on the R2 bucket allowing PUT + Content-Type from this origin.
 */
export async function getUploadUrl(key: string, contentType?: string, expiresIn = 300) {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET(),
    Key: key,
    ContentType: contentType || "application/octet-stream",
  });
  return getSignedUrl(getR2Client(), command, { expiresIn });
}

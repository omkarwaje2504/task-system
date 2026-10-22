import "server-only";
import crypto from "crypto";

// AES-256-GCM at-rest encryption for shared credential passwords — same
// scheme and CREDENTIALS_SECRET as error-tracking-api, so imported
// credentials decrypt unchanged.
const ALGO = "aes-256-gcm";

export type Encrypted = { iv: string; authTag: string; data: string };

function getKey() {
  const secret = process.env.CREDENTIALS_SECRET;
  if (!secret) throw new Error("CREDENTIALS_SECRET is not set — cannot encrypt/decrypt credentials.");
  return crypto.createHash("sha256").update(secret).digest();
}

export function encrypt(plaintext: string): Encrypted {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const data = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  return { iv: iv.toString("base64"), authTag: cipher.getAuthTag().toString("base64"), data: data.toString("base64") };
}

export function decrypt({ iv, authTag, data }: Encrypted) {
  const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(authTag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}

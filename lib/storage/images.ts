import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const IMAGE_FILENAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp)$/i;
const IMAGE_PREFIX = "uploads/";

let client: S3Client | null = null;

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`متغير مخزن الصور ${name} غير مضبوط.`);
  return value;
}

function storageConfig() {
  return {
    endpoint: requiredEnv("BUCKET_ENDPOINT"),
    region: requiredEnv("BUCKET_REGION"),
    bucket: requiredEnv("BUCKET_NAME"),
    accessKeyId: requiredEnv("BUCKET_ACCESS_KEY_ID"),
    secretAccessKey: requiredEnv("BUCKET_SECRET_ACCESS_KEY"),
  };
}

function storageClient(): { s3: S3Client; bucket: string } {
  const config = storageConfig();
  client ??= new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  return { s3: client, bucket: config.bucket };
}

export function imageObjectKey(filename: string): string {
  if (!IMAGE_FILENAME.test(filename)) throw new Error("اسم ملف الصورة غير صالح.");
  return `${IMAGE_PREFIX}${filename}`;
}

export async function putStoredImage(input: {
  filename: string;
  body: Uint8Array;
  contentType: string;
}) {
  const { s3, bucket } = storageClient();
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: imageObjectKey(input.filename),
      Body: input.body,
      ContentType: input.contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  const stored = await s3.send(new HeadObjectCommand({
    Bucket: bucket,
    Key: imageObjectKey(input.filename),
  }));
  if (stored.ContentLength !== input.body.byteLength) {
    throw new Error("تعذر التحقق من اكتمال حفظ الصورة في المخزن.");
  }
}

export async function headStoredImage(filename: string) {
  const { s3, bucket } = storageClient();
  const object = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: imageObjectKey(filename) }));
  return {
    contentType: object.ContentType ?? "application/octet-stream",
    cacheControl: object.CacheControl ?? "public, max-age=31536000, immutable",
    contentLength: object.ContentLength,
    etag: object.ETag,
  };
}

export async function getStoredImage(filename: string) {
  const { s3, bucket } = storageClient();
  const object = await s3.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: imageObjectKey(filename),
    }),
  );
  if (!object.Body) throw new Error("ملف الصورة فارغ في المخزن.");
  return {
    bytes: await object.Body.transformToByteArray(),
    contentType: object.ContentType ?? "application/octet-stream",
    cacheControl: object.CacheControl ?? "public, max-age=31536000, immutable",
    etag: object.ETag,
  };
}

export function isMissingStoredImage(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return candidate.name === "NoSuchKey" || candidate.name === "NotFound" || candidate.$metadata?.httpStatusCode === 404;
}

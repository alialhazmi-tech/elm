import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const IMAGE_FILENAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp)$/i;
const IMAGE_PREFIX = "uploads/";

let client: S3Client | null = null;

/** Railway يحقن AWS_* عند ربط البوكت؛ BUCKET_* يبقى للتوافق المحلي القديم. */
export function resolveStorageConfig(env: NodeJS.ProcessEnv = process.env) {
  const endpoint = (env.AWS_ENDPOINT_URL || env.BUCKET_ENDPOINT || "").trim();
  const bucket = (env.AWS_S3_BUCKET_NAME || env.BUCKET_NAME || "").trim();
  const accessKeyId = (env.AWS_ACCESS_KEY_ID || env.BUCKET_ACCESS_KEY_ID || "").trim();
  const secretAccessKey = (env.AWS_SECRET_ACCESS_KEY || env.BUCKET_SECRET_ACCESS_KEY || "").trim();
  const rawRegion = (env.AWS_DEFAULT_REGION || env.AWS_REGION || env.BUCKET_REGION || "").trim();
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error("متغيرات مخزن الصور غير مكتملة. يلزم AWS_S3_BUCKET_NAME وAWS_ENDPOINT_URL ومفاتيح AWS.");
  }
  // Tigris على Railway يتطلب region=auto حتى لو كانت منطقة الخدمة ams.
  const region = /storageapi\.dev$/i.test(new URL(endpoint).hostname) ? "auto" : (rawRegion || "auto");
  return { endpoint, region, bucket, accessKeyId, secretAccessKey };
}

function storageConfig() {
  return resolveStorageConfig();
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

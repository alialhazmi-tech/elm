/**
 * رفع ملفات البودكاست إلى المخزن على أجزاء (S3 multipart) عبر خادم الموقع:
 * كل جزء طلب صغير فلا يصطدم بحد حجم الطلب في Cloudflare، ولا يلزم فتح CORS على المخزن.
 */

import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListPartsCommand,
  S3Client,
  UploadPartCommand,
  type Part,
} from "@aws-sdk/client-s3";

import { resolveStorageConfig } from "./images";

let client: S3Client | null = null;

function storage(): { s3: S3Client; bucket: string } {
  const config = resolveStorageConfig();
  client ??= new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
  return { s3: client, bucket: config.bucket };
}

export async function startAudioUpload(key: string, contentType: string): Promise<string> {
  const { s3, bucket } = storage();
  const created = await s3.send(new CreateMultipartUploadCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
    CacheControl: "public, max-age=31536000, immutable",
  }));
  if (!created.UploadId) throw new Error("لم يُنشئ المخزن جلسة رفع.");
  return created.UploadId;
}

export async function uploadAudioPart(input: {
  key: string;
  uploadId: string;
  partNumber: number;
  body: Uint8Array;
  signal?: AbortSignal;
}): Promise<string> {
  const { s3, bucket } = storage();
  const part = await s3.send(new UploadPartCommand({
    Bucket: bucket,
    Key: input.key,
    UploadId: input.uploadId,
    PartNumber: input.partNumber,
    Body: input.body,
    ContentLength: input.body.byteLength,
  }), { abortSignal: input.signal });
  if (!part.ETag) throw new Error("لم يؤكد المخزن استلام الجزء.");
  return part.ETag;
}

/** يجمع الأجزاء كما سجّلها المخزن نفسه — لا يثق بقائمة يرسلها المتصفح. */
export async function completeAudioUpload(key: string, uploadId: string, expectedParts: number) {
  const { s3, bucket } = storage();
  const parts: Part[] = [];
  let marker: string | undefined;
  do {
    const page = await s3.send(new ListPartsCommand({ Bucket: bucket, Key: key, UploadId: uploadId, PartNumberMarker: marker }));
    parts.push(...(page.Parts ?? []));
    marker = page.IsTruncated ? page.NextPartNumberMarker : undefined;
  } while (marker);
  parts.sort((a, b) => (a.PartNumber ?? 0) - (b.PartNumber ?? 0));
  const complete = parts.length === expectedParts && parts.every((part, index) => part.PartNumber === index + 1 && part.ETag);
  if (!complete) throw new Error("INCOMPLETE_UPLOAD");
  await s3.send(new CompleteMultipartUploadCommand({
    Bucket: bucket,
    Key: key,
    UploadId: uploadId,
    MultipartUpload: { Parts: parts.map((part) => ({ PartNumber: part.PartNumber, ETag: part.ETag })) },
  }));
}

export async function abortAudioUpload(key: string, uploadId: string) {
  const { s3, bucket } = storage();
  await s3.send(new AbortMultipartUploadCommand({ Bucket: bucket, Key: key, UploadId: uploadId }));
}

/** حجم الملف المكتمل وبصمته من المخزن، مع أول بايتاته لفحص الصيغة. */
export async function inspectStoredAudio(key: string): Promise<{ byteLength: number; etag: string; head: Uint8Array }> {
  const { s3, bucket } = storage();
  const meta = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key, Range: "bytes=0-15" }));
  const head = object.Body ? await object.Body.transformToByteArray() : new Uint8Array();
  return {
    byteLength: meta.ContentLength ?? 0,
    etag: (meta.ETag ?? "").replace(/"/g, ""),
    head,
  };
}

/** يحذف ملفًا رُفع للتو وفشل فحصه — لا يُستدعى لملف حلقة منشورة. */
export async function discardStoredAudio(key: string) {
  const { s3, bucket } = storage();
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

export function isMissingUpload(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return candidate.name === "NoSuchUpload" || candidate.name === "NotFound" || candidate.name === "NoSuchKey"
    || candidate.$metadata?.httpStatusCode === 404;
}

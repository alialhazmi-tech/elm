import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { isMissingStoredImage, resolveStorageConfig } from "./images";
let client: S3Client | undefined;
function storage() {
  const config = resolveStorageConfig();
  client ??= new S3Client({ endpoint: config.endpoint, region: config.region,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey } });
  return { client, bucket: config.bucket };
}
function key(hash: string) {
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error("INVALID_AUDIO_KEY");
  return `voice-summaries/${hash}.wav`;
}
export async function getStoredVoice(hash: string): Promise<Uint8Array | null> {
  const { client, bucket } = storage();
  try {
    const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key(hash) }), { abortSignal: AbortSignal.timeout(10000) });
    if (!result.Body) throw new Error("EMPTY_AUDIO");
    return await result.Body.transformToByteArray();
  } catch (error) { if (isMissingStoredImage(error)) return null; throw error; }
}
export async function putStoredVoice(hash: string, bytes: Uint8Array) {
  const { client, bucket } = storage();
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key(hash), Body: bytes, ContentType: "audio/wav",
    CacheControl: "public, max-age=31536000, immutable" }), { abortSignal: AbortSignal.timeout(10000) });
}

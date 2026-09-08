import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { servePodcastAudio } from "@/lib/podcast-audio";
import { resolveStorageConfig } from "@/lib/storage/images";

export const runtime = "nodejs";
let client: S3Client | undefined;

async function respond(request: Request, { params }: { params: Promise<{ filename: string }> }) {
  return servePodcastAudio(request, (await params).filename, async (key, range, signal) => {
    const config = resolveStorageConfig();
    client ??= new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    });
    const object = await client.send(new GetObjectCommand({
      Bucket: config.bucket, Key: key, Range: range,
    }), { abortSignal: signal });
    if (!object.Body) throw new Error("Missing podcast audio body");
    return object.Body.transformToWebStream();
  });
}

export const GET = respond;
export const HEAD = respond;

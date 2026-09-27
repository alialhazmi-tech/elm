import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { PODCAST_AUDIO_FILENAME, servePodcastAudio } from "@/lib/podcast-audio";
import { findHostedAudio } from "@/lib/podcast-catalog";
import { resolveStorageConfig } from "@/lib/storage/images";

export const runtime = "nodejs";
let client: S3Client | undefined;

async function respond(request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  // الاسم يُفحص قبل الكتالوج: لا مسارات ولا استعلام لأسماء عشوائية.
  const audio = PODCAST_AUDIO_FILENAME.test(filename) ? await findHostedAudio(filename) : null;
  return servePodcastAudio(request, audio, async (key, range, signal) => {
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

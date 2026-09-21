import { createHash, randomUUID } from "node:crypto";
import { io } from "socket.io-client";

export const DEFAULT_VOICE = "cabd361b-cb91-4eb6-8d35-c8660bf82e7a"; // Abdullah, discovered from HUMAIN's voice list.
export function voiceConfig() {
  const key = process.env.HUMAIN_VOICE_API_KEY?.trim();
  if (!key) throw new Error("VOICE_NOT_CONFIGURED");
  const origin = new URL(process.env.HUMAIN_VOICE_API_URL || "https://api.voice.humain.com");
  if (origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/") throw new Error("VOICE_CONFIG_INVALID");
  return { key, origin: origin.origin, path: process.env.HUMAIN_VOICE_API_PATH || "/socket.io", voice: process.env.HUMAIN_VOICE_ID || DEFAULT_VOICE, model: "nebula" };
}
export function audioKey(text: string, config: ReturnType<typeof voiceConfig>) {
  return createHash("sha256").update(JSON.stringify(["humain-wav-v1", config.origin, config.path, config.model, config.voice, text])).digest("hex");
}
/** Keep each request below the documented free-tier limit, without dropping words. */
export function speechChunks(text: string): string[] {
  const words = text.trim().split(/\s+/u);
  if (!/[\p{L}\p{N}]/u.test(text) || Array.from(text).length > 2000) throw new Error("VOICE_TEXT_INVALID");
  const chunks: string[] = [];
  let current = "";
  for (const word of words) {
    if (Array.from(word).length > 480) throw new Error("VOICE_TEXT_INVALID");
    const next = current ? `${current} ${word}` : word;
    if (Array.from(next).length > 480) { chunks.push(current); current = word; }
    else current = next;
  }
  if (current) chunks.push(current);
  return chunks;
}
export function pcmToWav(pcm: Uint8Array): Buffer {
  if (!pcm.byteLength || pcm.byteLength % 2 || pcm.byteLength > 12_000_000) throw new Error("VOICE_AUDIO_INVALID");
  const header = Buffer.alloc(44);
  header.write("RIFF"); header.writeUInt32LE(36 + pcm.byteLength, 4); header.write("WAVE", 8);
  header.write("fmt ", 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(24000, 24); header.writeUInt32LE(48000, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
  header.write("data", 36); header.writeUInt32LE(pcm.byteLength, 40);
  return Buffer.concat([header, pcm]);
}
/** One connection per bounded request; explicit close also cancels incomplete handshakes. */
export function synthesizeChunk(text: string, config: ReturnType<typeof voiceConfig>, signal: AbortSignal): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const socket = io(config.origin, { path: config.path, transports: ["websocket"], autoConnect: false,
      reconnection: false, timeout: 8000, extraHeaders: { "x-api-key": config.key, Origin: config.origin } });
    const id = randomUUID(), requestBytes = Buffer.from(id.replaceAll("-", ""), "hex");
    const chunks: Buffer[] = [];
    let size = 0, done = false;
    const finish = (error?: Error) => {
      if (done) return;
      done = true;
      clearTimeout(timer); signal.removeEventListener("abort", abort); socket.removeAllListeners(); socket.disconnect();
      if (error) reject(error); else if (!size || size % 2) reject(new Error("VOICE_AUDIO_INVALID")); else resolve(Buffer.concat(chunks));
    };
    const abort = () => finish(new Error("VOICE_CANCELLED"));
    const timer = setTimeout(() => finish(new Error("VOICE_TIMEOUT")), 35000);
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) { abort(); return; }
    socket.on("connect", () => socket.emit("tts", { id, text, voice_id: config.voice, model: config.model }));
    socket.on("connect_error", () => finish(new Error("VOICE_CONNECT_FAILED")));
    socket.on("disconnect", () => finish(new Error("VOICE_DISCONNECTED")));
    socket.on("error", (error: { id?: string; code?: string }) => {
      if (error?.id && error.id !== id) return;
      const code = typeof error?.code === "string" && /^[A-Z_]{1,80}$/.test(error.code) ? error.code : "VOICE_PROVIDER_FAILED";
      finish(new Error(code));
    });
    socket.on("tts_audio", (raw: unknown) => {
      if (!(raw instanceof Uint8Array) && !(raw instanceof ArrayBuffer)) { finish(new Error("VOICE_FRAME_INVALID")); return; }
      const frame = Buffer.from(raw instanceof ArrayBuffer ? new Uint8Array(raw) : raw);
      if (frame.length < 17) { finish(new Error("VOICE_FRAME_INVALID")); return; }
      if (!frame.subarray(0, 16).equals(requestBytes)) return;
      size += frame.length - 17;
      if (size > 12_000_000) { finish(new Error("VOICE_TOO_LARGE")); return; }
      chunks.push(frame.subarray(17));
      if (frame[16] & 1) finish();
    });
    socket.connect();
  });
}
export async function synthesizeSummary(text: string, config = voiceConfig(), signal = AbortSignal.timeout(90000)) {
  const pcm: Buffer[] = [];
  for (const chunk of speechChunks(text)) pcm.push(await synthesizeChunk(chunk, config, signal));
  return pcmToWav(Buffer.concat(pcm));
}

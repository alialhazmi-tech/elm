import assert from "node:assert/strict";
import test from "node:test";

import { ASSIST_STREAM_ACCEPT, readAssistStream } from "../lib/ai/read-assist-stream.ts";

const ndjson = (lines, init = {}) =>
  new Response(lines.map((line) => (typeof line === "string" ? line : JSON.stringify(line))).join("\n") + "\n", {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
    ...init,
  });

/** بثّ على دفعات صغيرة يقطع الأسطر في منتصفها كما يفعل الوسيط. */
function chunked(text, size = 7) {
  const encoder = new TextEncoder();
  let offset = 0;
  return new Response(new ReadableStream({
    pull(controller) {
      if (offset >= text.length) return controller.close();
      controller.enqueue(encoder.encode(text.slice(offset, offset + size)));
      offset += size;
    },
  }), { headers: { "Content-Type": "application/x-ndjson" } });
}

test("يقرأ نبضات المساعد وتقدمه ثم يعيد النتيجة وحدها", async () => {
  assert.equal(ASSIST_STREAM_ACCEPT, "application/x-ndjson");
  const stages = [];
  const metadata = { excerpt: { text: "موجز" }, seo: { seoTitle: "ع" }, classify: { section: "news" } };
  const response = ndjson([
    { type: "heartbeat", padding: " ".repeat(1100) },
    { type: "progress", stage: "accepted" },
    { type: "heartbeat" },
    { type: "result", data: { ok: true, metadata } },
  ]);
  const data = await readAssistStream(response, (event) => stages.push(event.stage));
  assert.deepEqual(data, { ok: true, metadata });
  assert.deepEqual(stages, ["accepted"]);
});

test("يجمع الأسطر المقطوعة بين الدفعات ويقبل سطرًا أخيرًا بلا فاصل", async () => {
  const text = `${JSON.stringify({ type: "heartbeat" })}\n${JSON.stringify({ type: "result", data: { suggestions: [{ text: "عنوان مقترح" }] } })}`;
  const data = await readAssistStream(chunked(text));
  assert.equal(data.suggestions[0].text, "عنوان مقترح");
});

test("خطأ المساعد داخل البث يصل برسالته العربية", async () => {
  await assert.rejects(
    readAssistStream(ndjson([{ type: "heartbeat" }, { type: "error", error: "تعذّر إكمال الطلب لدى مزوّد الذكاء (529). لم يُطبّق أي تغيير." }])),
    /مزوّد الذكاء \(529\)/,
  );
  await assert.rejects(readAssistStream(ndjson([{ type: "error", error: "" }])), /تعذّر إكمال التوليد/);
});

test("انقطاع البث قبل النتيجة أو سطر غير صالح لا يمرّان كنتيجة", async () => {
  await assert.rejects(readAssistStream(ndjson([{ type: "heartbeat" }, { type: "progress", stage: "body_started" }])), /انقطع الاتصال قبل وصول النتيجة/);
  await assert.rejects(readAssistStream(ndjson(["<html>Bad Gateway</html>"])), /رد غير صالح/);
  await assert.rejects(readAssistStream(ndjson([{ type: "result", data: [] }])), /رد غير صالح/);
  await assert.rejects(readAssistStream(ndjson([{ type: "result" }])), /رد غير صالح/);
});

test("الرد غير المبثوث يمر على قارئ JSON بالرسائل نفسها", async () => {
  assert.deepEqual(await readAssistStream(Response.json({ metadata: { excerpt: { text: "م" } } })), { metadata: { excerpt: { text: "م" } } });
  await assert.rejects(readAssistStream(Response.json({ error: "سقف الإنفاق الداخلي" }, { status: 429 })), /سقف الإنفاق الداخلي/);
  await assert.rejects(readAssistStream(new Response("<html>Bad Gateway</html>", { status: 502, headers: { "Content-Type": "text/html" } })), /تعذّر إكمال التوليد \(502\)/);
  await assert.rejects(readAssistStream(new Response("", { status: 504 })), /انتهت مهلة/);
  await assert.rejects(readAssistStream(new Response("<html>Sign in</html>", { headers: { "Content-Type": "text/html" } })), /رد غير صالح/);
  // ترويسة NDJSON مع حالة خطأ: صفحة الوسيط لا تُقرأ كبث.
  await assert.rejects(readAssistStream(new Response("<html>Bad Gateway</html>", { status: 502, headers: { "Content-Type": "application/x-ndjson" } })), /تعذّر إكمال التوليد \(502\)/);
});

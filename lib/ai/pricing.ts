/** تقديرات تشغيلية محافظة للمليون توكن بالسنت؛ ليست فاتورة المزود. */
const PRICES_CENTS: Record<string, { input: number; output: number }> = {
  "claude-opus-5": { input: 500, output: 2500 },
  "claude-sonnet-5": { input: 300, output: 1500 },
  "claude-haiku-4-5": { input: 100, output: 500 },
};

export function costCents(model: string, inputTokens: number, outputTokens: number): number {
  const name = model.replace(/^anthropic\//, "").replace("claude-haiku-4.5", "claude-haiku-4-5");
  const price = PRICES_CENTS[name] ?? PRICES_CENTS["claude-opus-5"];
  return Math.ceil(
    (inputTokens / 1_000_000) * price.input + (outputTokens / 1_000_000) * price.output,
  );
}

/** حد محافظ من بايتات النص وحد المخرج، يشمل كتابة كاش الدستور. */
export function reserveTextCents(model: string, text: string, maxTokens: number): number {
  return Math.max(1, costCents(model, Math.ceil(Buffer.byteLength(text, "utf8") * 1.25) + 1024, maxTokens));
}

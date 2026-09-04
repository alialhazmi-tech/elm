export type AiProvider = "anthropic" | "openrouter";
type Environment = Record<string, string | undefined>;

export function openRouterKey(env: Environment = process.env): string {
  const key = env.OPENROUTER_API_KEY?.trim() ?? "";
  return key && !/[\s*…]/u.test(key) ? key : "";
}

/** قرار تشغيل واحد؛ اختيار OpenRouter لا يسقط إلى مفاتيح المزودين الآخرين. */
export function aiProvider(env: Environment = process.env): AiProvider {
  const value = env.AI_PROVIDER?.trim();
  if (value && value !== "openrouter" && value !== "anthropic") throw new Error("AI_PROVIDER يجب أن يكون openrouter أو anthropic.");
  if (value === "openrouter" || value === "anthropic") return value;
  return openRouterKey(env) ? "openrouter" : "anthropic";
}

export function openRouterModel(model: string, image = false): string {
  if (model.includes("/")) return model;
  if (image) return `google/${model}`;
  // معرف Haiku يختلف بين واجهتي Anthropic وOpenRouter.
  return `anthropic/${model === "claude-haiku-4-5" ? "claude-haiku-4.5" : model}`;
}

export function effectiveModels<T extends { editorial: string; light: string; fast: string; image: string }>(models: T, env: Environment = process.env): T {
  if (aiProvider(env) !== "openrouter") return {
    ...models,
    editorial: models.editorial.replace(/^anthropic\//, ""),
    light: models.light.replace(/^anthropic\//, "").replace("claude-haiku-4.5", "claude-haiku-4-5"),
    fast: models.fast.replace(/^anthropic\//, ""),
    image: models.image.replace(/^google\//, ""),
  };
  return {
    ...models,
    editorial: env.OPENROUTER_MODEL_EDITORIAL?.trim() || openRouterModel(models.editorial),
    light: env.OPENROUTER_MODEL_LIGHT?.trim() || openRouterModel(models.light),
    fast: env.OPENROUTER_MODEL_FAST?.trim() || openRouterModel(models.fast),
    image: env.OPENROUTER_MODEL_IMAGE?.trim() || openRouterModel(models.image, true),
  };
}

export function missingTextKeyMessage(): string {
  return aiProvider() === "openrouter"
    ? "مفتاح OpenRouter غير مضبوط — أضف OPENROUTER_API_KEY في أسرار التشغيل."
    : "مفتاح Anthropic غير مضبوط — أضف ANTHROPIC_API_KEY في أسرار التشغيل.";
}

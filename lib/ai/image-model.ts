export const DEFAULT_IMAGE_MODEL = "gemini-3.1-flash-image";

/** Imagen 3 مغلق، وImagen 4 في مسار إيقاف؛ طبّع القيم القديمة دون كسر الإعداد المخزن. */
export function normalizeImageModel(model: string | null | undefined): string {
  const value = model?.trim() ?? "";
  if (!value || value.startsWith("imagen-")) return DEFAULT_IMAGE_MODEL;
  return value;
}

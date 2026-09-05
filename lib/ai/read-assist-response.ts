import type { AiResult } from "./editorial";

/** لا تعرض أخطاء JSON الخاصة بالمتصفح أو صفحات الوسيط للمحرر. */
export async function readAssistResponse(response: Response): Promise<Partial<AiResult>> {
  const data: unknown = await response.json().catch(() => null);
  const object = data && typeof data === "object" && !Array.isArray(data) ? data : null;
  if (!response.ok) {
    if (object && "error" in object && typeof object.error === "string" && object.error.trim()) {
      throw new Error(object.error);
    }
    if (response.status === 401) throw new Error("انتهت جلسة الدخول. سجّل الدخول مجددًا ثم أعد التوليد.");
    if (response.status === 403) throw new Error("تعذّر السماح بطلب التوليد. تحقق من صلاحية حسابك ثم أعد المحاولة.");
    if (response.status === 429) throw new Error("وصلت الطلبات إلى الحد المسموح. انتظر قليلًا ثم أعد المحاولة.");
    if ([408, 504, 524].includes(response.status)) throw new Error("انتهت مهلة التوليد. أعد المحاولة بعد قليل.");
    throw new Error(`تعذّر إكمال التوليد (${response.status}). أعد المحاولة بعد قليل.`);
  }
  if (!object) throw new Error("وصل رد غير صالح من المساعد. أعد التوليد، وإذا تكرر الخطأ فأبلغ الدعم.");
  return object;
}

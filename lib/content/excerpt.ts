/** حد الموجز التحريري موحد في المساعد وحقول المحرر؛ ليس هدفًا لملء النص. */
export const EXCERPT_MAX_CHARS = 280;

/** أحرف Unicode بدل وحدات UTF-16، شاملًا المسافات كما تظهر للمحرر. */
export const excerptLength = (text: string): number => Array.from(text).length;

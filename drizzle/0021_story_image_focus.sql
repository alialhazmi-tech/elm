-- نقطة تركيز صورة المادة ("س% ص%")؛ تُمرَّر إلى object-position حتى لا يُقصّ الوجه في الإطارات الضيقة.
-- null = المنتصف (السلوك السابق). تُحسب في المحرر من الوجوه ويعدّلها المحرر بنقرة.
ALTER TABLE "stories" ADD COLUMN IF NOT EXISTS "image_focus" text;

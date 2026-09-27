import { copyFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

// كاشف الوجوه في المحرر (نقطة تركيز الصورة) يحمّل ملفات WASM من أصلنا لا من CDN خارجي.
// تُنسخ عند التثبيت بدل إيداع ~23MB في المستودع؛ المسار يحمل رقم النسخة فيبقى التخزين المؤقت صحيحًا.
// الحزمة لا تصدّر package.json؛ نقرأها من node_modules مباشرة.
const root = path.join(process.cwd(), 'node_modules', '@mediapipe', 'tasks-vision');
const { version } = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const target = path.join(process.cwd(), 'public', 'vendor', 'mediapipe', version, 'wasm');
await mkdir(target, { recursive: true });
for (const name of ['vision_wasm_internal.js', 'vision_wasm_internal.wasm', 'vision_wasm_nosimd_internal.js', 'vision_wasm_nosimd_internal.wasm']) {
  await copyFile(path.join(root, 'wasm', name), path.join(target, name));
}

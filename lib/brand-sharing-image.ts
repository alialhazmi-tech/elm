import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { sharingJpeg } from "./sharing-image";

let card: Promise<Buffer> | undefined;

/** نفس ملف الهيدر الأصلي، بخلفية معتمة وترميز مناسب لمعاينات المشاركة. */
export function brandSharingImage(): Promise<Buffer> {
  card ??= readFile(join(process.cwd(), "public", "brand", "alelm-logo-light.png"))
    .then(bytes => sharingJpeg(bytes, "#23345d"))
    .catch(error => { card = undefined; throw error; });
  return card;
}

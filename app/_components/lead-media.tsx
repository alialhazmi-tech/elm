"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

/**
 * صورة القصة القائدة: رابط بكامل مساحتها نحو المادة، وإن فشل جلب الصورة
 * (مصدر ووردبريس خارجي) يختفي الإطار كليًا فيصبح التخطيط نصيًا بدل صندوق مكسور.
 * الرابط خارج تسلسل التبويب لأن عنوان المادة المجاور يكفي للوحة المفاتيح.
 */
export function LeadMedia({ src, href }: { src: string; href: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;

  return (
    <figure>
      <Link className="lead-media" href={href} tabIndex={-1} aria-hidden="true">
        <Image
          src={src}
          alt=""
          fill
          sizes="(max-width: 940px) 100vw, 760px"
          priority
          onError={() => setFailed(true)}
        />
      </Link>
    </figure>
  );
}

"use client";
import Image from "next/image";
import { useState } from "react";
/** Only display our generated, immutable image paths. Never embed arbitrary profile URLs. */
export function ProfileAvatar({
  name,
  image,
  size = 40,
}: {
  name: string;
  image?: string | null;
  size?: number;
}) {
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const valid = image && image !== failedImage && /^\/uploads\/[0-9a-f-]{36}\.webp$/.test(image);
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        background: "var(--muted, #e9edf4)",
        color: "var(--foreground, #263e69)",
        fontWeight: 700,
      }}
    >
      {valid ? (
        <Image
          src={image}
          alt=""
          width={size}
          height={size}
          unoptimized
          onError={() => setFailedImage(image)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <span aria-hidden="true">{name.trim().slice(0, 1) || "ع"}</span>
      )}
    </span>
  );
}

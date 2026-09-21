"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ProfileAvatar } from "./profile-avatar";
import { prepareAvatarUpload, saveAvatarRequest } from "@/lib/avatar-client";
export function AvatarUpload({
  name,
  image,
  endpoint,
}: {
  name: string;
  image?: string | null;
  endpoint: string;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(image);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  async function save(file?: File) {
    if (file && file.size > 4 * 1024 * 1024) {
      setError(true);
      setMessage("الحد الأقصى للصورة 4 ميغابايت.");
      return;
    }
    setPending(true);
    setMessage("");
    setError(false);
    try {
      const prepared = file ? await prepareAvatarUpload(file) : undefined;
      setPreview(await saveAvatarRequest(endpoint, prepared));
      setMessage(
        file ? "تم تحديث صورتك الشخصية." : "تمت إزالة الصورة الشخصية.",
      );
      window.dispatchEvent(new Event("alelm:profile-updated"));
      router.refresh();
    } catch (error) {
      setError(true);
      setMessage(
        error instanceof Error ? error.message : "تعذر الاتصال. حاول مرة أخرى.",
      );
    } finally {
      setPending(false);
      if (input.current) input.current.value = "";
    }
  }
  return (
    <div style={{ display: "grid", gap: 14, marginBlock: 16 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <ProfileAvatar name={name} image={preview} size={80} />
        <div style={{ display: "grid", gap: 8 }}>
          <strong>الصورة الشخصية</strong>
          <small>
            JPG أو PNG أو WebP، حتى 4 ميغابايت. تُقص الصورة بشكل مربع.
          </small>
          <div style={{ display: "flex", gap: 12 }}>
            <button
              type="button"
              disabled={pending}
              onClick={() => input.current?.click()}
              style={{
                cursor: "pointer",
                fontWeight: 700,
                textDecoration: "underline",
              }}
            >
              {pending ? "جارٍ الحفظ…" : preview ? "تغيير الصورة" : "رفع صورة"}
            </button>
            {preview && (
              <button
                type="button"
                disabled={pending}
                onClick={() => void save()}
                style={{ cursor: "pointer", textDecoration: "underline" }}
              >
                إزالة الصورة
              </button>
            )}
          </div>
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label="اختر الصورة الشخصية"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void save(file);
        }}
      />
      {message && (
        <p
          role={error ? "alert" : "status"}
          style={{ color: error ? "#b42318" : "#178058", fontSize: 14 }}
        >
          {message}
        </p>
      )}
    </div>
  );
}

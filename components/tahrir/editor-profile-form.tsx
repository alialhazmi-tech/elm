"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
export function EditorProfileForm({ name }: { name: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  return (
    <form
      className="grid max-w-lg gap-3"
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        setPending(true);
        setMessage("");
        setError(false);
        try {
          const response = await fetch("/api/tahrir/account/profile", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: data.get("name") }),
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error);
          setMessage("تم حفظ اسمك.");
          window.dispatchEvent(new Event("alelm:profile-updated"));
          router.refresh();
        } catch (error) {
          setError(true);
          setMessage(error instanceof Error ? error.message : "تعذر الحفظ.");
        } finally {
          setPending(false);
        }
      }}
    >
      <Label htmlFor="profile-name">الاسم المعروض</Label>
      <Input
        id="profile-name"
        name="name"
        defaultValue={name}
        required
        minLength={2}
        maxLength={80}
        autoComplete="name"
      />
      <Button type="submit" className="w-fit" disabled={pending}>
        {pending ? "جارٍ الحفظ…" : "حفظ الاسم"}
      </Button>
      {message && (
        <p
          role={error ? "alert" : "status"}
          className={
            error ? "text-sm text-destructive" : "text-sm text-(--t-ok)"
          }
        >
          {message}
        </p>
      )}
    </form>
  );
}

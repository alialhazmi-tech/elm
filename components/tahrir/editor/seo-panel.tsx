"use client";

import { useState } from "react";
import { SparklesIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface Props {
  seoTitle: string;
  seoDescription: string;
  keywords: string[];
  busy: boolean;
  onSeoTitle: (value: string) => void;
  onSeoDescription: (value: string) => void;
  onAddKeyword: (value: string) => void;
  onRemoveKeyword: (value: string) => void;
  onGenerate: () => void;
}

function Counter({ length, max }: { length: number; max: number }) {
  return (
    <span className={cn("text-[10.5px] tabular-nums", length > max ? "text-(--t-block)" : "text-muted-foreground")}>
      {length}/{max}
    </span>
  );
}

/** تبويب SEO: عنوان ووصف البحث بعدّادات، والكلمات المفتاحية رقائق — والتوليد من المتن بالذكاء. */
export function SeoPanel(props: Props) {
  const [keywordInput, setKeywordInput] = useState("");
  return (
    <div className="grid gap-3 p-3">
      <div className="flex items-center gap-2">
        <h2 className="font-display text-[13px] font-bold">SEO والكلمات المفتاحية</h2>
        <Button size="xs" variant="outline" className="ms-auto" onClick={props.onGenerate} disabled={props.busy}>
          <SparklesIcon data-icon="inline-start" />
          {props.busy ? "يولّد…" : "ولّد من المتن"}
        </Button>
      </div>
      <div className="grid gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="seo-title">عنوان البحث</Label>
          <Counter length={props.seoTitle.length} max={60} />
        </div>
        <Input
          id="seo-title"
          maxLength={90}
          value={props.seoTitle}
          onChange={(event) => props.onSeoTitle(event.target.value)}
          placeholder="يسقط للعنوان إن تُرك"
        />
      </div>
      <div className="grid gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="seo-description">وصف البحث</Label>
          <Counter length={props.seoDescription.length} max={155} />
        </div>
        <Textarea
          id="seo-description"
          rows={3}
          maxLength={200}
          value={props.seoDescription}
          onChange={(event) => props.onSeoDescription(event.target.value)}
          placeholder="يسقط للموجز إن تُرك"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="seo-keyword">الكلمات المفتاحية</Label>
        <div className="flex flex-wrap gap-1.5">
          {props.keywords.map((keyword) => (
            <span key={keyword} className="inline-flex items-center gap-1 rounded-full border bg-muted px-2 py-0.5 text-xs">
              {keyword}
              <button
                type="button"
                aria-label={`حذف ${keyword}`}
                className="rounded-full text-muted-foreground hover:text-foreground"
                onClick={() => props.onRemoveKeyword(keyword)}
              >
                <XIcon className="size-3" />
              </button>
            </span>
          ))}
        </div>
        <Input
          id="seo-keyword"
          value={keywordInput}
          placeholder="كلمة مفتاحية ثم Enter"
          onChange={(event) => setKeywordInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              props.onAddKeyword(keywordInput);
              setKeywordInput("");
            }
          }}
        />
      </div>
    </div>
  );
}

"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** قائمة اختيار مختصرة فوق shadcn Select — للشاشات الكثيرة الحقول (جاك العلم، الإنفوجرافيك). الاتجاه من DirectionProvider في غلاف اللوحة. */
export function SelectField({
  value,
  onValueChange,
  options,
  ariaLabel,
  className,
  placeholder,
  disabled = false,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
  ariaLabel: string;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <Select disabled={disabled} value={value} onValueChange={onValueChange}>
      <SelectTrigger aria-label={ariaLabel} className={cn("w-full bg-card", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent align="end">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

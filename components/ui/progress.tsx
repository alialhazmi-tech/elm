"use client"

import * as React from "react"
import { Progress as ProgressPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Progress({
  className,
  value,
  indicatorColor,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & {
  indicatorColor?: string
}) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "relative flex h-1 w-full items-center overflow-x-hidden rounded-full bg-muted",
        className
      )}
      {...props}
    >
      {/* العرض وحده يحدد الامتلاء؛ flex-1 كان يمدّه للمسار كله. صف flex يبدأ من اليمين تحت dir="rtl". */}
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn("h-full shrink-0 bg-primary transition-[width]", indicatorColor)}
        style={{ width: `${Math.min(100, Math.max(0, value || 0))}%` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }

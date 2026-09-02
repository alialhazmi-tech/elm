import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** يدمج أصناف Tailwind مع حلّ التعارضات — عقد shadcn القياسي. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

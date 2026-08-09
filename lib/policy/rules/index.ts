import type { Rule } from "../types.ts";
import { editorialRules } from "./editorial.ts";
import { formattingRules } from "./formatting.ts";
import { productionRules } from "./production.ts";
import { protocolRules } from "./protocol.ts";
import { restrictedRules } from "./restricted.ts";

/** كل قواعد الدستور التحريري القابلة للفحص الحتمي. */
export const allRules: Rule[] = [
  ...protocolRules,
  ...restrictedRules,
  ...editorialRules,
  ...formattingRules,
  ...productionRules,
];

export { editorialRules, formattingRules, productionRules, protocolRules, restrictedRules };

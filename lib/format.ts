/**
 * تنسيق العرض وفق دليل الهوية V1.0 (2026):
 * «الأرقام العربية الشرقية في المتون، والتاريخ هجري ثم ميلادي».
 */

const EASTERN = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

/** يحوّل الأرقام اللاتينية إلى عربية شرقية، ويستبدل % بـ٪. */
export function toEasternDigits(input: string | number): string {
  return String(input)
    .replace(/\d/g, (digit) => EASTERN[Number(digit)])
    .replace(/%/g, "٪");
}

const HIJRI = new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const GREGORIAN = new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** «هجري ثم ميلادي» بأرقام شرقية — بنية العرض من دليل الهوية. */
export function brandDate(iso: string): { hijri: string; gregorian: string } {
  const date = new Date(iso);
  return { hijri: HIJRI.format(date), gregorian: GREGORIAN.format(date) };
}

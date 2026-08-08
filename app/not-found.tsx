import Link from "next/link";

export default function NotFound() {
  return (
    <main className="not-found">
      <p>404</p>
      <h1>هذه الصفحة ليست هنا</h1>
      <span>تحقق من الرابط أو عد إلى الصفحة الرئيسية.</span>
      <Link href="/">العودة إلى العلم</Link>
    </main>
  );
}

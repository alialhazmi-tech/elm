import Link from "next/link";
import { FileSearch, Search } from "lucide-react";
import { BrandMark } from "./brand-mark";
import styles from "./missing-content.module.css";

export function MissingContent({ article = false }: { article?: boolean }) {
  return (
    <div className={styles.page} dir="rtl">
      <header className={styles.header}>
        <Link href="/" aria-label="العلم — الصفحة الرئيسية" className={styles.brand}>
          <BrandMark />
        </Link>
        <span>المعرفة وراء الخبر</span>
      </header>
      <main className={styles.main} id="main-content">
        <div className={styles.symbol} aria-hidden="true"><FileSearch strokeWidth={1.3} /></div>
        <p className={styles.status}>الصفحة غير متاحة <span aria-hidden="true">·</span> <bdi>404</bdi></p>
        <h1>{article ? "هذا الخبر غير متاح" : "لم نعثر على هذه الصفحة"}</h1>
        <p className={styles.description}>
          {article ? "قد يكون الخبر قد حُذف أو تغيّر رابطه." : "قد يكون الرابط غير صحيح، أو أن الصفحة لم تعد متاحة."}
          <br />يمكنك البحث عن الموضوع أو متابعة القراءة في العلم.
        </p>
        <form action="/search" role="search" className={styles.search}>
          <label htmlFor="missing-search">ابحث في العلم</label>
          <div className={styles.searchField}>
            <Search size={20} aria-hidden="true" />
            <input id="missing-search" type="search" name="q" placeholder="اكتب عنوانًا أو كلمة من الموضوع" required maxLength={200} />
            <button type="submit">بحث</button>
          </div>
        </form>
        <Link href="/" className={styles.home}>العودة إلى الرئيسية</Link>
      </main>
      <footer className={styles.footer}>
        <span>واصل الاستكشاف</span>
        <nav aria-label="استكشف العلم">
          <Link href="/podcasts">بودكاست العلم</Link>
          <Link href="/series">سلاسل العلم</Link>
        </nav>
      </footer>
    </div>
  );
}

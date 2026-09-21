import type { Metadata } from "next";
import { notFound } from "next/navigation";
import MembershipPrototype from "./membership-prototype";
import "./prototype.css";

export const metadata: Metadata = {
  title: "نموذج عضوية العلم",
  description: "نموذج تجريبي داخلي لرحلة عضوية العلم",
  robots: { index: false, follow: false },
};

export default function MembershipPrototypePage() {
  if (process.env.NODE_ENV === "production" && process.env.MEMBERSHIP_PROTOTYPE !== "1") {
    notFound();
  }

  return <MembershipPrototype />;
}

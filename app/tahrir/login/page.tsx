import { redirect } from "next/navigation";

import { getSession } from "@/lib/tahrir/auth";
import { LoginForm } from "../_components/login-form";

export const metadata = { title: "الدخول" };

export default async function LoginPage() {
  if (await getSession()) redirect("/tahrir");

  return (
    <div className="th-login">
      <div className="th-login-card">
        <div className="w">العلم</div>
        <div className="t">تحرير العلم — لوحة التحكم</div>
        <LoginForm />
      </div>
    </div>
  );
}

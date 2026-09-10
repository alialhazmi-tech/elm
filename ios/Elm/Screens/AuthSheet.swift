import SwiftUI

/// الدخول والتسجيل — ورقة مستقلة عن شاشة العضوية (المجانية). قواعد التحقق ورسائلها من `app/join/actions.ts`.
struct AuthSheet: View {
    @Environment(MemberSessionStore.self) private var member
    @Environment(\.dismiss) private var dismiss

    @State private var mode: MemberAuthMode = .signUp
    @State private var name = ""
    @State private var email = ""
    @State private var password = ""
    @State private var resetBusy = false
    @State private var resetMessage: String?
    @FocusState private var focused: Field?

    private enum Field { case name, email, password }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    brand

                    Picker("نوع الدخول", selection: $mode) {
                        ForEach(MemberAuthMode.allCases) { item in
                            Text(item.label).tag(item)
                        }
                    }
                    .pickerStyle(.segmented)

                    VStack(spacing: 14) {
                        if mode == .signUp {
                            field("الاسم", placeholder: "كيف نناديك؟", text: $name, field: .name)
                        }
                        field("البريد الإلكتروني", placeholder: "name@example.com", text: $email, field: .email, keyboard: .emailAddress)
                        secureField
                    }

                    if let error = member.errorMessage {
                        Label(error, systemImage: "exclamationmark.circle.fill")
                            .font(ElmFonts.text(.footnote, weight: .medium))
                            .foregroundStyle(ElmTheme.danger)
                            .padding(12)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(ElmTheme.danger.opacity(0.08), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                            .accessibilityLabel("خطأ: \(error)")
                    }

                    Button(action: submit) {
                        HStack {
                            if member.loading { ProgressView().tint(.white) }
                            Text(member.loading
                                 ? (mode == .signUp ? "جارٍ إنشاء حسابك…" : "جارٍ تسجيل الدخول…")
                                 : (mode == .signUp ? "إنشاء حساب مجاني" : "تسجيل الدخول"))
                        }
                        .font(ElmFonts.text(.subheadline, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 15)
                        .background(ElmTheme.navyDeep, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .disabled(member.loading)

                    if mode == .signIn {
                        Button { Task { await requestReset() } } label: {
                            Text(resetBusy ? "لحظة…" : "نسيت كلمة المرور؟")
                                .font(ElmFonts.text(.footnote, weight: .semibold))
                                .foregroundStyle(ElmTheme.navyInk)
                                .frame(minHeight: 44)
                        }
                        .buttonStyle(.plain)
                        .disabled(resetBusy)
                        .accessibilityHint("يرسل رابط استعادة كلمة المرور إلى بريدك")
                        if let resetMessage {
                            Label(resetMessage, systemImage: "envelope")
                                .font(ElmFonts.text(.footnote))
                                .foregroundStyle(ElmTheme.ink2)
                                .lineSpacing(3)
                        }
                    }

                    // `join-form.tsx`: نستخدم بيانات حسابك لتقديم خدمات العضوية وفق سياسة الخصوصية.
                    HStack(spacing: 4) {
                        Text("نستخدم بيانات حسابك لتقديم خدمات العضوية وفق")
                        PublicPageLink(path: "/privacy-policy") {
                            Text("سياسة الخصوصية.").underline().foregroundStyle(ElmTheme.navyInk)
                        }
                    }
                    .font(ElmFonts.text(.caption))
                    .foregroundStyle(ElmTheme.ink2)
                    .fixedSize(horizontal: false, vertical: true)

                    Label("جلسة آمنة محفوظة في الجهاز. لا نخزن كلمة مرورك داخل التطبيق.", systemImage: "lock.shield")
                        .font(ElmFonts.text(.caption))
                        .foregroundStyle(ElmTheme.ink2)
                }
                .padding(22)
            }
            .background(ElmTheme.bg.ignoresSafeArea())
            .navigationTitle("عضوية العلم")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("إغلاق") { dismiss() }
                }
            }
            .onAppear { mode = member.authInitialMode; member.errorMessage = nil }
            .onChange(of: mode) { _, _ in member.errorMessage = nil; resetMessage = nil }
        }
    }

    private func submit() {
        guard !member.loading else { return }
        Task {
            if await member.authenticate(mode: mode, name: name, email: email, password: password) {
                dismiss()
            }
        }
    }

    /// يطلب بريد الاستعادة فقط؛ تعيين كلمة المرور يكتمل على الموقع من الرابط المرسل.
    private func requestReset() async {
        let clean = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard MemberSessionStore.validEmail(clean) else {
            resetMessage = "اكتب بريدك الإلكتروني أولًا ثم اضغط «نسيت كلمة المرور؟»."
            focused = .email
            return
        }
        resetBusy = true
        defer { resetBusy = false }
        do {
            try await APIClient.requestPasswordReset(email: clean)
            resetMessage = "إذا كان البريد مرتبطًا بحساب، فستصلك رسالة برابط الاستعادة. افتح الرابط لتعيين كلمة مرور جديدة ثم عد للدخول هنا."
        } catch {
            resetMessage = ElmAPIError.wrap(error).message
        }
    }

    private var brand: some View {
        VStack(alignment: .leading, spacing: 9) {
            Text("ع")
                .font(ElmFonts.logo(.title2))
                .foregroundStyle(ElmTheme.gold)
                .frame(width: 58, height: 58)
                .background(ElmTheme.navyDeep, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            Text(mode == .signIn ? "مكتبتك واهتماماتك بانتظارك." : "مساحتك. للمعرفة التي تهمّك.")
                .font(ElmFonts.display(.title, weight: .heavy))
                .foregroundStyle(ElmTheme.ink)
            Text("قراءاتك، اختياراتك، وما تودّ العودة إليه. كلّها في مكان واحد، بعضوية مجانية.")
                .font(ElmFonts.text(.callout))
                .foregroundStyle(ElmTheme.ink2)
                .lineSpacing(4)
        }
    }

    private func field(_ title: String, placeholder: String, text: Binding<String>, field: Field, keyboard: UIKeyboardType = .default) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(title)
                .font(ElmFonts.text(.caption, weight: .bold))
                .foregroundStyle(ElmTheme.ink)
            TextField(placeholder, text: text)
                .font(ElmFonts.text(.callout))
                .textInputAutocapitalization(field == .name ? .words : .never)
                .autocorrectionDisabled(field != .name)
                .keyboardType(keyboard)
                .textContentType(field == .name ? .givenName : .emailAddress)
                .submitLabel(.next)
                .onSubmit { focused = field == .name ? .email : .password }
                .focused($focused, equals: field)
                .padding(14)
                .background(ElmTheme.surface2, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(focused == field ? ElmTheme.focus : ElmTheme.line2, lineWidth: focused == field ? 2 : 1)
                )
                .environment(\.layoutDirection, field == .email ? .leftToRight : .rightToLeft)
        }
    }

    private var secureField: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text("كلمة المرور")
                .font(ElmFonts.text(.caption, weight: .bold))
                .foregroundStyle(ElmTheme.ink)
            SecureField(mode == .signUp ? "من 8 إلى 128 حرفًا" : "كلمة المرور", text: $password)
                .font(ElmFonts.text(.callout))
                .textContentType(mode == .signUp ? .newPassword : .password)
                .submitLabel(.go)
                .onSubmit(submit)
                .focused($focused, equals: .password)
                .padding(14)
                .background(ElmTheme.surface2, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(focused == .password ? ElmTheme.focus : ElmTheme.line2, lineWidth: focused == .password ? 2 : 1)
                )
                .environment(\.layoutDirection, .leftToRight)
        }
    }
}

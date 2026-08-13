import SwiftUI

/// الدخول والتسجيل — ورقة مستقلة عن شاشة العضوية (1i) التي تعرض الخطط.
struct AuthSheet: View {
    @Environment(MemberSessionStore.self) private var member
    @Environment(\.dismiss) private var dismiss

    @State private var mode: MemberAuthMode = .signUp
    @State private var name = ""
    @State private var email = ""
    @State private var password = ""
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

                    Button {
                        Task {
                            if await member.authenticate(mode: mode, name: name, email: email, password: password) {
                                dismiss()
                            }
                        }
                    } label: {
                        HStack {
                            if member.loading { ProgressView().tint(.white) }
                            Text(member.loading ? "لحظة…" : (mode == .signUp ? "إنشاء حسابي" : "دخول آمن"))
                        }
                        .font(ElmFonts.text(.subheadline, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 15)
                        .background(ElmTheme.navyDeep, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .disabled(member.loading)

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
            .onChange(of: mode) { _, _ in member.errorMessage = nil }
        }
    }

    private var brand: some View {
        VStack(alignment: .leading, spacing: 9) {
            Text("ع")
                .font(ElmFonts.logo(.title2))
                .foregroundStyle(ElmTheme.gold)
                .frame(width: 58, height: 58)
                .background(ElmTheme.navyDeep, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            Text("معرفة أقرب إليك.")
                .font(ElmFonts.display(.title, weight: .heavy))
                .foregroundStyle(ElmTheme.ink)
            Text("احفظ موادك وواصل من أي جهاز، ودع صفحة «لك أنت» تتعلم اهتماماتك بوضوح وتحكم.")
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
            SecureField(mode == .signUp ? "8 أحرف على الأقل" : "كلمة المرور", text: $password)
                .font(ElmFonts.text(.callout))
                .textContentType(mode == .signUp ? .newPassword : .password)
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

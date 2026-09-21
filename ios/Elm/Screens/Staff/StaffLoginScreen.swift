import SwiftUI

/// دخول «تحرير العلم»: اسم مستخدم وكلمة مرور، ثم رمز التحقق إن طلبه الخادم،
/// ثم تغيير كلمة المرور المؤقتة، أو إلزام التحقق بخطوتين للحسابات الإدارية.
struct StaffLoginScreen: View {
    @Environment(StaffSessionStore.self) private var staff
    @State private var username = ""
    @State private var password = ""
    @State private var code = ""
    @State private var current = ""
    @State private var next = ""
    @State private var confirm = ""
    @FocusState private var focused: Field?

    private enum Field { case username, password, code, current, next, confirm }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                header
                if let notice = staff.expiryNotice {
                    StaffInlineNotice(message: notice, symbol: "clock.arrow.circlepath")
                }
                switch staff.phase {
                case .needsCode: codeForm
                case .mustChangePassword: passwordForm
                case .mfaRequired: mfaGate
                default: loginForm
                }
                if let error = staff.errorMessage { StaffInlineError(message: error) }
                Button { staff.workspacePresented = false } label: {
                    Label("العودة إلى القراءة", systemImage: "arrow.uturn.backward")
                        .font(ElmFonts.text(.footnote, weight: .medium))
                        .foregroundStyle(ElmTheme.ink2)
                        .frame(minHeight: 44)
                }
                .buttonStyle(.plain)
                Text("حساب اللوحة مستقل عن عضوية القرّاء. لا تُحفظ كلمة المرور على الجهاز.")
                    .font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink3)
            }
            .frame(maxWidth: 480)
            .frame(maxWidth: .infinity)
            .padding(24)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(ElmTheme.bg.ignoresSafeArea())
        .onAppear { if username.isEmpty { username = staff.lastUsername } }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 10) {
            Image("OfficialLogo").resizable().scaledToFit().frame(width: 92, height: 48).foregroundStyle(ElmTheme.ink)
                .accessibilityLabel("العلم")
            Text("تحرير العلم").font(ElmFonts.display(.title, weight: .heavy)).foregroundStyle(ElmTheme.ink)
            Text(subtitle).font(ElmFonts.text(.callout)).foregroundStyle(ElmTheme.ink2).lineSpacing(3)
        }
        .padding(.top, 12)
    }

    private var subtitle: String {
        switch staff.phase {
        case .needsCode: "أدخل رمز تطبيق التحقق أو أحد رموز الاسترداد."
        case .mustChangePassword: "كلمة مرورك مؤقتة — اختر كلمة مرور جديدة قبل المتابعة."
        case .mfaRequired: "حسابك إداري ويشترط التحقق بخطوتين قبل استخدام اللوحة."
        default: "ادخل بحساب اللوحة لمتابعة المواد والاعتماد والنشر من هاتفك."
        }
    }

    private var loginForm: some View {
        VStack(spacing: 14) {
            StaffField(label: "اسم المستخدم", placeholder: "username", text: $username, keyboard: .asciiCapable, ltr: true)
                .focused($focused, equals: .username)
                .textContentType(.username)
                .submitLabel(.next)
                .onSubmit { focused = .password }
            StaffSecureField(label: "كلمة المرور", text: $password, submitLabel: .go, onSubmit: submitLogin)
                .focused($focused, equals: .password)
            StaffPrimaryButton(title: staff.loading ? "جارٍ الدخول…" : "دخول", symbol: "lock.open", busy: staff.loading, action: submitLogin)
        }
    }

    private var codeForm: some View {
        VStack(spacing: 14) {
            StaffField(label: "رمز التحقق", placeholder: "123456", text: $code, keyboard: .numberPad, ltr: true, hint: "من تطبيق المصادقة، أو رمز استرداد.")
                .focused($focused, equals: .code)
                .textContentType(.oneTimeCode)
                .submitLabel(.go)
                .onSubmit { Task { _ = await staff.submitCode(code.trimmingCharacters(in: .whitespaces)) } }
            StaffPrimaryButton(title: staff.loading ? "جارٍ التحقق…" : "تأكيد", symbol: "checkmark.shield", busy: staff.loading) {
                Task { _ = await staff.submitCode(code.trimmingCharacters(in: .whitespaces)) }
            }
            StaffSecondaryButton(title: "رجوع", symbol: "arrow.right") { staff.cancelCode(); code = "" }
        }
        .onAppear { focused = .code }
    }

    private var passwordForm: some View {
        VStack(spacing: 14) {
            StaffSecureField(label: "كلمة المرور المؤقتة", text: $current, contentType: .password, submitLabel: .next, onSubmit: { focused = .next })
                .focused($focused, equals: .current)
            StaffSecureField(label: "كلمة المرور الجديدة", text: $next, contentType: .newPassword, submitLabel: .next, onSubmit: { focused = .confirm })
                .focused($focused, equals: .next)
            StaffSecureField(label: "تأكيد كلمة المرور", text: $confirm, contentType: .newPassword, submitLabel: .go, onSubmit: submitPasswordChange)
                .focused($focused, equals: .confirm)
            Text("15 محرفًا على الأقل وتختلف عن المؤقتة. تُنهي كل الجلسات الأخرى.")
                .font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink3).frame(maxWidth: .infinity, alignment: .leading)
            StaffPrimaryButton(title: staff.loading ? "جارٍ الحفظ…" : "حفظ والمتابعة", symbol: "key", busy: staff.loading, action: submitPasswordChange)
            StaffSecondaryButton(title: "الخروج", symbol: "rectangle.portrait.and.arrow.right", destructive: true) { Task { await staff.signOut() } }
        }
    }

    private var mfaGate: some View {
        VStack(spacing: 14) {
            StaffInlineNotice(message: "فعّل التحقق بخطوتين من «ملفي وأمان الحساب» على الموقع أو من التطبيق بعد الدخول، ثم أعد الدخول.", symbol: "shield.lefthalf.filled")
            NavigationStack { StaffMFASetupView() }
                .frame(minHeight: 420)
            StaffSecondaryButton(title: "الخروج", symbol: "rectangle.portrait.and.arrow.right", destructive: true) { Task { await staff.signOut() } }
        }
    }

    private func submitPasswordChange() {
        guard next == confirm else { staff.errorMessage = "كلمتا المرور غير متطابقتين."; return }
        guard next.unicodeScalars.count >= 15 else { staff.errorMessage = "كلمة المرور 15 محرفًا على الأقل."; return }
        Task { _ = await staff.changePassword(current: current, next: next) }
    }

    private func submitLogin() {
        Task {
            _ = await staff.signIn(username: username, password: password)
            if staff.phase != .signedOut { password = "" }
        }
    }
}

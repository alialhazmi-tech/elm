import SwiftUI

/// نظرة الحساب من `/api/me/account` (إحصاءات + نشرة + تخصيص) و`/api/viewer` (توثيق البريد).
@MainActor
@Observable
final class AccountStore {
    var overview: AccountPayload?
    var emailVerified: Bool?
    /// الصورة الشخصية من `memberProfiles.avatarUrl` (تصل عبر `/api/viewer` و`/api/me/account`، لا عبر `get-session`).
    var avatar: String?
    var loading = false
    var errorMessage: String?
    var guest = false

    var avatarURL: URL? { ElmMedia.url(avatar) }

    func load() async {
        loading = overview == nil
        errorMessage = nil
        defer { loading = false }
        do {
            async let account = APIClient.fetchAccount(tab: nil)
            async let viewer = APIClient.fetchViewer()
            let payload = try await account
            overview = payload
            guest = false
            if let member = try? await viewer.member {
                emailVerified = member.emailVerified ?? payload.user?.emailVerified
                avatar = member.image ?? payload.user?.image
            } else {
                emailVerified = payload.user?.emailVerified
                avatar = payload.user?.image
            }
        } catch let api as ElmAPIError where api.isUnauthorized {
            guest = true
            overview = nil
            avatar = nil
        } catch {
            errorMessage = ElmAPIError.wrap(error).message
        }
    }
}

/// إعدادات الحساب الأصلية بدل «إدارة الحساب على الموقع»: الاسم، كلمة المرور، توثيق البريد،
/// النشرة، التخصيص، مسح البيانات المستنتجة، والخروج. الزائر يرى دعوة دخول.
struct AccountSettingsScreen: View {
    @Environment(MemberSessionStore.self) private var member
    @Environment(InterestStore.self) private var interests
    @Environment(AppearanceStore.self) private var appearance
    @Environment(\.horizontalSizeClass) private var sizeClass
    @State private var store = AccountStore()

    @State private var name = ""
    @State private var savingName = false
    @State private var nameMessage: String?

    @State private var currentPassword = ""
    @State private var newPassword = ""
    @State private var confirmPassword = ""
    @State private var savingPassword = false
    @State private var passwordMessage: String?

    @State private var otp = ""
    @State private var otpSent = false
    @State private var verifying = false
    @State private var verifyMessage: String?

    @State private var newsletterBusy = false
    @State private var newsletterMessage: String?

    @State private var confirmClear = false
    @State private var clearing = false
    @State private var clearMessage: String?

    var body: some View {
        ElmScreen(title: "إعدادات الحساب", showBack: true, onRefresh: { await store.load() }) {
            VStack(alignment: .leading, spacing: 20) {
                Text("إعدادات الحساب").font(ElmFonts.display(.largeTitle, weight: .bold)).foregroundStyle(ElmTheme.ink)
                if !member.isSignedIn || store.guest {
                    GuestGate(text: "سجّل الدخول لتغيير اسمك وكلمة مرورك وتوثيق بريدك وإدارة النشرة.")
                } else {
                    if let error = store.errorMessage {
                        Label(error, systemImage: "wifi.slash").font(ElmFonts.text(.footnote)).foregroundStyle(ElmTheme.ink2)
                        Button("إعادة المحاولة") { Task { await store.load() } }.frame(minHeight: 44)
                    }
                    if store.loading && store.overview == nil { ProgressView().frame(maxWidth: .infinity) }
                    nameCard
                    if store.emailVerified == false { verificationCard }
                    passwordCard
                    preferencesCard
                    privacyCard
                    signOutCard
                }
            }
            .padding(20)
            .frame(maxWidth: sizeClass == .regular ? 720 : .infinity)
            .frame(maxWidth: .infinity)
        }
        .task(id: member.user?.id) {
            name = member.user?.name ?? ""
            if member.isSignedIn {
                await store.load()
                // 401 رغم جلسة يظنها التطبيق قائمة: نعيد التحقق (خروج أو تعليق).
                if store.guest { await member.revalidate() }
            }
        }
    }

    // MARK: الاسم

    private var nameCard: some View {
        card("الاسم") {
            Text("الاسم الذي نناديك به ويظهر في حسابك — من حرفين إلى \(ElmFormat.latinDigits("40")) حرفًا.").font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink2)
            TextField("الاسم", text: $name)
                .textContentType(.name).textInputAutocapitalization(.words)
                .submitLabel(.done)
                .modifier(SettingsField())
            actionButton(savingName ? "جارٍ الحفظ…" : "حفظ الاسم", disabled: savingName || name.trimmingCharacters(in: .whitespaces).isEmpty || name == member.user?.name) {
                Task { await saveName() }
            }
            if let nameMessage { note(nameMessage) }
        }
    }

    /// `app/account/actions.ts`: الاسم من 2 إلى 40 حرفًا برسالة الويب.
    private func saveName() async {
        let clean = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard (2...40).contains(clean.count) else { nameMessage = "اكتب اسمًا من حرفين إلى 40 حرفًا."; return }
        savingName = true
        defer { savingName = false }
        do {
            try await APIClient.updateUserName(clean)
            await member.restore()
            nameMessage = "تم تحديث اسمك."
        } catch { nameMessage = ElmAPIError.wrap(error).message }
    }

    // MARK: توثيق البريد

    private var verificationCard: some View {
        card("توثيق البريد") {
            // الويب يشترط التوثيق للنشرة فقط؛ استعادة كلمة المرور لا تتطلبه.
            Label("بريدك غير موثّق بعد. التوثيق يلزم للاشتراك في النشرة.", systemImage: "envelope.badge")
                .font(ElmFonts.text(.footnote)).foregroundStyle(ElmTheme.ink2).lineSpacing(3)
            if otpSent {
                TextField("رمز التحقق من بريدك", text: $otp)
                    .keyboardType(.numberPad).textContentType(.oneTimeCode)
                    .modifier(SettingsField(ltr: true))
                // الويب: رمز من 6 أرقام.
                actionButton(verifying ? "لحظة…" : "تأكيد الرمز", disabled: verifying || ElmFormat.latinDigits(otp.trimmingCharacters(in: .whitespaces)).count != 6) {
                    Task { await verify() }
                }
                Button("إعادة إرسال الرمز") { Task { await sendOTP() } }.font(ElmFonts.text(.footnote)).frame(minHeight: 40).disabled(verifying)
            } else {
                actionButton(verifying ? "لحظة…" : "أرسل رمز التحقق إلى بريدي", disabled: verifying) { Task { await sendOTP() } }
            }
            if let verifyMessage { note(verifyMessage) }
        }
    }

    private func sendOTP() async {
        guard let email = member.user?.email else { return }
        verifying = true
        defer { verifying = false }
        do {
            try await APIClient.sendVerificationOTP(email: email)
            otpSent = true
            verifyMessage = "أُرسل الرمز إلى \(email)."
        } catch { verifyMessage = ElmAPIError.wrap(error).message }
    }

    private func verify() async {
        guard let email = member.user?.email else { return }
        verifying = true
        defer { verifying = false }
        do {
            try await APIClient.verifyEmail(email: email, otp: ElmFormat.latinDigits(otp.trimmingCharacters(in: .whitespaces)))
            store.emailVerified = true
            verifyMessage = "وُثّق بريدك."
            await store.load()
        } catch { verifyMessage = ElmAPIError.wrap(error).message }
    }

    // MARK: كلمة المرور

    private var passwordCard: some View {
        card("كلمة المرور") {
            SecureField("كلمة المرور الحالية", text: $currentPassword).textContentType(.password).modifier(SettingsField(ltr: true))
            SecureField("كلمة المرور الجديدة (من 8 إلى 128 حرفًا)", text: $newPassword).textContentType(.newPassword).modifier(SettingsField(ltr: true))
            SecureField("تأكيد كلمة المرور الجديدة", text: $confirmPassword).textContentType(.newPassword).modifier(SettingsField(ltr: true))
            // `account-forms.tsx`
            Text("استخدم من \(ElmFormat.latinDigits("8")) إلى \(ElmFormat.latinDigits("128")) حرفًا. بعد التغيير، ستحتاج إلى تسجيل الدخول مجددًا على أجهزتك الأخرى.")
                .font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink3).lineSpacing(3)
            actionButton(savingPassword ? "جارٍ الحفظ…" : "تغيير كلمة المرور", disabled: savingPassword || currentPassword.isEmpty || newPassword.isEmpty) {
                Task { await changePassword() }
            }
            if let passwordMessage { note(passwordMessage) }
        }
    }

    /// شروط `app/account/actions.ts` بالترتيب نفسه ورسائله: الحالية، الطول 8–128، التطابق، الاختلاف عن الحالية.
    private func changePassword() async {
        guard !currentPassword.isEmpty, currentPassword.count <= 128 else { passwordMessage = "أدخل كلمة المرور الحالية."; return }
        guard (8...128).contains(newPassword.count) else { passwordMessage = "اختر كلمة مرور جديدة من 8 إلى 128 حرفًا."; return }
        guard newPassword == confirmPassword else { passwordMessage = "كلمتا المرور الجديدتان غير متطابقتين."; return }
        guard newPassword != currentPassword else { passwordMessage = "اختر كلمة مرور مختلفة عن الحالية."; return }
        savingPassword = true
        defer { savingPassword = false }
        do {
            try await APIClient.changePassword(current: currentPassword, new: newPassword)
            currentPassword = ""; newPassword = ""; confirmPassword = ""
            passwordMessage = "تم تغيير كلمة المرور وتسجيل الخروج من الجلسات الأخرى."
        } catch let api as ElmAPIError {
            if case .invalid = api { passwordMessage = "تعذر تغيير كلمة المرور. تحقق من كلمة المرور الحالية." }
            else { passwordMessage = api.message }
        } catch { passwordMessage = ElmAPIError.wrap(error).message }
    }

    // MARK: التفضيلات

    private var preferencesCard: some View {
        card("التفضيلات") {
            toggleRow("نشرة ما وراء العناوين", detail: store.emailVerified == false ? "تلزم توثيق البريد أولًا" : "أهم المواد إلى بريدك",
                      isOn: store.overview?.newsletterSubscribed ?? false, busy: newsletterBusy) {
                Task { await toggleNewsletter() }
            }
            if let newsletterMessage { note(newsletterMessage) }
            Divider().overlay(ElmTheme.line)
            toggleRow("تخصيص «لك أنت»", detail: "اقتراحات من اهتماماتك وقراءاتك", isOn: appearance.personalizationEnabled, busy: false) {
                Task { await interests.setPersonalization(!appearance.personalizationEnabled, appearance: appearance) }
            }
            if let error = interests.syncError { note(error) }
        }
    }

    private func toggleNewsletter() async {
        let target = !(store.overview?.newsletterSubscribed ?? false)
        newsletterBusy = true
        defer { newsletterBusy = false }
        do {
            let result = try await APIClient.setNewsletter(subscribed: target)
            store.overview?.newsletterSubscribed = result
            newsletterMessage = result ? "اشتركت في النشرة." : "أُلغي الاشتراك."
        } catch { newsletterMessage = ElmAPIError.wrap(error).message }
    }

    // MARK: الخصوصية والخروج

    private var privacyCard: some View {
        card("الخصوصية") {
            Text("تُمسح إشارات القراءة المستنتجة (ما فُتح وكم قُرئ). تبقى اهتماماتك المختارة والمحفوظات والإعجابات.")
                .font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink2).lineSpacing(3)
            Button(role: .destructive) { confirmClear = true } label: {
                Text(clearing ? "لحظة…" : "مسح بيانات القراءة المستنتجة").font(ElmFonts.text(.subheadline, weight: .semibold)).frame(minHeight: 44)
            }
            .disabled(clearing)
            .confirmationDialog("مسح بيانات القراءة المستنتجة؟", isPresented: $confirmClear) {
                Button("مسح البيانات", role: .destructive) { Task { await clearInferred() } }
                Button("إلغاء", role: .cancel) {}
            }
            if let clearMessage { note(clearMessage) }
        }
    }

    private func clearInferred() async {
        guard let id = member.user?.id else { return }
        clearing = true
        defer { clearing = false }
        do {
            try await APIClient.updateProfile(memberId: id, action: "clear-behavior")
            clearMessage = "مُسحت بيانات القراءة المستنتجة في حسابك."
            await store.load()
        } catch { clearMessage = "تعذر المسح. تحقق من الاتصال وحاول مجددًا." }
    }

    private var signOutCard: some View {
        card("الجلسة") {
            if let email = member.user?.email { Text(email).font(ElmFonts.text(.footnote)).foregroundStyle(ElmTheme.ink2).elmLatin() }
            if let joined = ElmFormat.brandDate(store.overview?.user?.joinedAt) {
                Text("عضو منذ \(joined)").font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink3)
            }
            Button { Task { await member.signOut() } } label: {
                Text(member.loading ? "لحظة…" : "تسجيل الخروج").font(ElmFonts.text(.subheadline, weight: .semibold)).foregroundStyle(ElmTheme.danger).frame(minHeight: 44)
            }.buttonStyle(.plain).disabled(member.loading)
        }
    }

    // MARK: أدوات

    private func card<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title).font(ElmFonts.display(.headline, weight: .bold)).foregroundStyle(ElmTheme.ink).accessibilityAddTraits(.isHeader)
            content()
        }
        .padding(16).frame(maxWidth: .infinity, alignment: .leading)
        .elmCard(radius: 16, elevated: false)
    }

    private func actionButton(_ title: String, disabled: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title).font(ElmFonts.text(.subheadline, weight: .bold)).foregroundStyle(.white)
                .frame(maxWidth: .infinity, minHeight: 46)
                .background(disabled ? ElmTheme.line2 : ElmTheme.navyDeep, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        }.buttonStyle(.plain).disabled(disabled)
    }

    private func toggleRow(_ label: String, detail: String, isOn: Bool, busy: Bool, action: @escaping () -> Void) -> some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(label).font(ElmFonts.text(.footnote, weight: .semibold)).foregroundStyle(ElmTheme.ink)
                Text(detail).font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink3)
            }
            Spacer(minLength: 0)
            if busy { ProgressView() } else { ElmToggle(isOn: isOn, action: action).accessibilityLabel(label) }
        }.frame(minHeight: 44)
    }

    private func note(_ text: String) -> some View {
        Text(text).font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink2).lineSpacing(3)
    }
}

/// حقل إدخال بهوية العلم؛ البريد وكلمات المرور والرموز LTR.
private struct SettingsField: ViewModifier {
    var ltr = false
    func body(content: Content) -> some View {
        content
            .font(ElmFonts.text(.callout))
            .autocorrectionDisabled()
            .padding(13)
            .background(ElmTheme.surface2, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(ElmTheme.line2, lineWidth: 1))
            .environment(\.layoutDirection, ltr ? .leftToRight : .rightToLeft)
    }
}

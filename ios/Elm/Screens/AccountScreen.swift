import SwiftUI
import PhotosUI
import UIKit

/// 1j — الحساب والإعدادات: بطاقة القارئ (بصورته الشخصية)، العضوية المجانية، ثم مجموعات مضبوطة.
/// الحساب المعلّق يرى حالة «حسابك معلّق» وزر الخروج فقط — لا يُعرض كمسجّل أبدًا.
struct AccountScreen: View {
    @Environment(LibraryStore.self) private var library
    @Environment(InterestStore.self) private var interests
    @Environment(AppearanceStore.self) private var appearance
    @Environment(MemberSessionStore.self) private var member
    @Environment(OnboardingStore.self) private var onboarding
    @Environment(ReadingStore.self) private var reading
    @Environment(StaffSessionStore.self) private var staff
    @Environment(\.horizontalSizeClass) private var sizeClass
    @State private var account = AccountStore()
    @State private var avatarPick: PhotosPickerItem?
    @State private var avatarBusy = false
    @State private var avatarMessage: String?
    @State private var confirmAvatarRemoval = false
    #if DEBUG
    @State private var debugRoute: AccountDebugRoute?
    #endif

    var body: some View {
        ElmScreen(title: "حسابي", onRefresh: { if member.isSignedIn { await reload() } }) {
            VStack(alignment: .leading, spacing: 0) {
                if member.suspended {
                    SuspendedPanel()
                } else {
                    identity
                    if let avatarMessage {
                        Text(avatarMessage).font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink2).padding(.top, 8)
                    }
                    membershipRow.padding(.top, 14)
                    if member.isSignedIn { statsTiles.padding(.top, 14) }
                }

                group("القراءة") {
                    menuRow(label: "الوضع اللوني", color: SeriesPalette.color(for: "shakhsiat"))
                    Divider().overlay(ElmTheme.line)
                    valueRow(label: "حجم الخط", value: "يتبع النظام", color: ElmTheme.teal)
                    Divider().overlay(ElmTheme.line)
                    linkRow(label: "التنزيل التلقائي", value: reading.autoDownload ? "مُفعّل" : "مُعطّل", color: ElmTheme.focus) {
                        SavedScreen()
                    }
                }

                group("المحتوى") {
                    if member.isSignedIn {
                        // من الحساب حتى 12 اهتمامًا كما على الويب؛ التهيئة (3–7) للزائر وللحساب الجديد.
                        linkRow(label: "اهتماماتي", value: ElmFormat.latinDigits(String(interests.selected.count)), color: ElmTheme.hex("eda313")) {
                            OnboardingScreen(mode: .account)
                        }
                    } else {
                        Button { onboarding.present() } label: {
                            rowBody(label: "اهتماماتي", value: ElmFormat.latinDigits(String(interests.selected.count)), color: ElmTheme.hex("eda313"), chevron: true)
                        }
                        .buttonStyle(.plain)
                    }
                    Divider().overlay(ElmTheme.line)
                    linkRow(label: "المحفوظات والتنزيلات", value: library.items.isEmpty ? "" : ElmFormat.latinDigits(String(library.items.count)), color: SeriesPalette.color(for: "limatha")) {
                        SavedScreen()
                    }
                    Divider().overlay(ElmTheme.line)
                    linkRow(label: "الإعجابات", value: account.overview?.stats.map { ElmFormat.latinDigits(String($0.likedCount)) } ?? "", color: ElmTheme.danger) {
                        AccountLikedScreen()
                    }
                    Divider().overlay(ElmTheme.line)
                    linkRow(label: "سجل القراءة", value: account.overview?.stats.map { ElmFormat.latinDigits(String($0.articlesRead)) } ?? "", color: ElmTheme.tealInk) {
                        AccountHistoryScreen()
                    }
                    Divider().overlay(ElmTheme.line)
                    linkRow(label: "آخر المستجدات", value: "", color: ElmTheme.focus) {
                        NotificationsScreen()
                    }
                    Divider().overlay(ElmTheme.line)
                    toggleRow(
                        label: "تخصيص «لك أنت»",
                        color: SeriesPalette.color(for: "absat"),
                        isOn: appearance.personalizationEnabled
                    ) {
                        Task { await interests.setPersonalization(!appearance.personalizationEnabled, appearance: appearance) }
                    }
                }

                if let notice = library.mergeNotice {
                    HStack(spacing: 10) {
                        Label(notice, systemImage: "checkmark.circle.fill")
                            .font(ElmFonts.text(.footnote, weight: .medium))
                            .foregroundStyle(ElmTheme.ink)
                        Spacer(minLength: 0)
                        Button { library.dismissMergeNotice() } label: {
                            Image(systemName: "xmark").font(.system(size: 11, weight: .semibold)).foregroundStyle(ElmTheme.ink3).frame(width: 32, height: 32)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("إخفاء الإشعار")
                    }
                    .padding(.horizontal, 12).padding(.vertical, 8)
                    .background(ElmTheme.success.opacity(0.10), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .padding(.top, 12)
                }
                if let error = interests.syncError { Text(error).font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink2).padding(.top, 12) }

                group("العضوية") {
                    linkRow(label: "العضوية", value: member.isSignedIn ? "عضوية مجانية" : "زائر", color: SeriesPalette.color(for: "bel-tarikh")) {
                        MembershipScreen()
                    }
                    Divider().overlay(ElmTheme.line)
                    linkRow(label: "إعدادات الحساب", value: member.isSignedIn ? (account.emailVerified == false ? "البريد غير موثّق" : "") : "للأعضاء", color: ElmTheme.gold) {
                        AccountSettingsScreen()
                    }
                    Divider().overlay(ElmTheme.line)
                    linkRow(label: "الخصوصية", value: "", color: ElmTheme.ink3) {
                        PrivacyScreen()
                    }
                    if member.isSignedIn {
                        Divider().overlay(ElmTheme.line)
                        Button { Task { await member.signOut() } } label: {
                            rowBody(label: member.loading ? "لحظة…" : "تسجيل الخروج", value: "", color: ElmTheme.hex("8494ab"), chevron: false)
                        }
                        .buttonStyle(.plain)
                        .disabled(member.loading)
                    }
                }

                group("تحرير العلم") {
                    Button { staff.workspacePresented = true } label: {
                        rowBody(
                            label: staff.isActive ? "لوحة التحرير" : "الدخول إلى لوحة التحرير",
                            value: staff.isActive ? (staff.actor?.roleLabel ?? staff.actor?.displayName ?? "") : "للفريق التحريري",
                            color: ElmTheme.gold,
                            chevron: true
                        )
                    }
                    .buttonStyle(.plain)
                    .accessibilityHint("يفتح مساحة عمل الفريق التحريري بحسب صلاحيات حسابك")
                }

                group("عن العلم") {
                    PublicPageLink(path: "/about") { rowBody(label: "من نحن", value: "", color: ElmTheme.navyInk, chevron: true) }
                    Divider().overlay(ElmTheme.line)
                    PublicPageLink(path: "/contact") { rowBody(label: "تواصل معنا", value: "", color: ElmTheme.navyInk, chevron: true) }
                    Divider().overlay(ElmTheme.line)
                    linkRow(label: "نشرة ما وراء العناوين", value: account.overview?.newsletterSubscribed == true ? "مشترك" : "", color: ElmTheme.navyInk) {
                        AccountSettingsScreen()
                    }
                }

                Text("المحتوى من مواد منشورة · المصدر النهائي «تحرير العلم»\n© 2026 العلم — جميع الحقوق محفوظة")
                    .font(ElmFonts.text(.caption2))
                    .foregroundStyle(ElmTheme.ink3)
                    .multilineTextAlignment(.center)
                    .lineSpacing(4)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 20)
            }
            .padding(.horizontal, 18)
            .padding(.top, 16)
            .frame(maxWidth: sizeClass == .regular ? 720 : .infinity)
            .frame(maxWidth: .infinity)
        }
        .task(id: member.user?.id) {
            avatarMessage = nil
            if member.isSignedIn { await reload() } else { account.overview = nil; account.emailVerified = nil; account.avatar = nil }
        }
        .onChange(of: avatarPick) { _, item in
            guard let item else { return }
            Task { await uploadAvatar(item) }
        }
        #if DEBUG
        .task {
            if ElmLaunch.account == "auth" { member.authPresented = true; return }
            debugRoute = ElmLaunch.account.flatMap(AccountDebugRoute.init(rawValue:))
        }
        .navigationDestination(item: $debugRoute) { route in
            switch route {
            case .liked: AccountLikedScreen()
            case .history: AccountHistoryScreen()
            case .settings: AccountSettingsScreen()
            case .interests: OnboardingScreen(mode: .account)
            case .membership: MembershipScreen()
            }
        }
        #endif
    }

    private func reload() async {
        await account.load()
        // 401 رغم جلسة يظنها التطبيق قائمة: نعيد التحقق فنكتشف الخروج أو التعليق.
        if account.guest, member.isSignedIn { await member.revalidate() }
    }

    // MARK: الإحصاءات

    /// أربع بلاطات من `/api/me/account` — لا أرقام مخترعة: تظهر بعد وصول الرد فقط.
    @ViewBuilder
    private var statsTiles: some View {
        if let stats = account.overview?.stats {
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 4), spacing: 10) {
                statTile(String(stats.articlesRead), label: "مادة مقروءة")
                statTile(String(stats.activeMinutes), label: "دقيقة قراءة")
                statTile(String(stats.savedCount), label: "محفوظة")
                statTile(String(stats.likedCount), label: "إعجاب")
            }
        } else if account.loading {
            ProgressView().frame(maxWidth: .infinity)
        } else if let error = account.errorMessage {
            VStack(alignment: .leading, spacing: 8) {
                Text(error).font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink3)
                Button("إعادة المحاولة") { Task { await reload() } }.font(ElmFonts.text(.caption, weight: .semibold)).frame(minHeight: 40)
            }
        }
    }

    private func statTile(_ value: String, label: String) -> some View {
        VStack(spacing: 3) {
            Text(ElmFormat.latinDigits(value))
                .font(ElmFonts.display(.title3, weight: .heavy)).foregroundStyle(ElmTheme.ink).elmLatin()
                .lineLimit(1).minimumScaleFactor(0.7)
            Text(label).font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink3).lineLimit(1).minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity, minHeight: 60)
        .padding(.vertical, 8)
        .background(ElmTheme.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(ElmTheme.line, lineWidth: 1))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(ElmFormat.latinDigits(value)) \(label)")
    }

    // MARK: الهوية والصورة الشخصية

    private var identity: some View {
        HStack(spacing: 13) {
            if member.isSignedIn {
                Menu {
                    PhotosPicker(selection: $avatarPick, matching: .images, photoLibrary: .shared()) {
                        Label(account.avatarURL == nil ? "اختيار صورة" : "تغيير الصورة", systemImage: "photo")
                    }
                    if account.avatarURL != nil {
                        Button(role: .destructive) { confirmAvatarRemoval = true } label: { Label("إزالة الصورة", systemImage: "trash") }
                    }
                } label: {
                    avatar
                }
                .disabled(avatarBusy)
                .accessibilityLabel(account.avatarURL == nil ? "الصورة الشخصية: غير مضافة" : "الصورة الشخصية")
                .accessibilityHint("اختيار صورة أو إزالتها")
                .confirmationDialog("إزالة الصورة الشخصية؟", isPresented: $confirmAvatarRemoval) {
                    Button("إزالة الصورة", role: .destructive) { Task { await removeAvatar() } }
                    Button("إلغاء", role: .cancel) {}
                }
            } else {
                avatar
            }
            VStack(alignment: .leading, spacing: 3) {
                Text(member.isSignedIn ? member.user?.name ?? "قارئ العلم" : "أهلًا بك في العلم")
                    .font(ElmFonts.display(.title3, weight: .heavy))
                    .foregroundStyle(ElmTheme.ink)
                Text(subtitle)
                    .font(ElmFonts.text(.caption))
                    .foregroundStyle(ElmTheme.ink3)
                    .lineLimit(2)
                    .elmLatin()
            }
            Spacer(minLength: 0)
        }
    }

    /// صورة العضو من `memberProfiles.avatarUrl` عبر `RemoteImage`؛ وإلا الحرف الأول.
    @ViewBuilder
    private var avatar: some View {
        ZStack {
            if let url = account.avatarURL {
                RemoteImage(url: url, maxPixel: 400)
                    .frame(width: 56, height: 56)
                    .clipShape(Circle())
            } else {
                Text(initial)
                    .font(ElmFonts.display(.title2, weight: .heavy))
                    .foregroundStyle(ElmTheme.gold)
                    .frame(width: 56, height: 56)
                    .background(ElmTheme.navyDeep, in: Circle())
            }
            if avatarBusy {
                Circle().fill(.black.opacity(0.35)).frame(width: 56, height: 56)
                ProgressView().tint(.white)
            }
        }
        .overlay(alignment: .bottomLeading) {
            if member.isSignedIn && !avatarBusy {
                Image(systemName: "camera.fill")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(width: 20, height: 20)
                    .background(ElmTheme.navyInk, in: Circle())
                    .overlay(Circle().stroke(ElmTheme.bg, lineWidth: 2))
            }
        }
    }

    /// يصغّر الصورة قبل الرفع (الخادم يعيد ترميزها 384×384 ويرفض ما فوق 4 ميغابايت).
    private func uploadAvatar(_ item: PhotosPickerItem) async {
        avatarBusy = true
        avatarMessage = nil
        defer { avatarBusy = false; avatarPick = nil }
        guard let raw = try? await item.loadTransferable(type: Data.self),
              let image = UIImage(data: raw),
              let jpeg = Self.downscaled(image, max: 1024).jpegData(compressionQuality: 0.86) else {
            avatarMessage = "تعذر قراءة الصورة. اختر صورة أخرى."
            return
        }
        do {
            let stored = try await APIClient.uploadAvatar(jpeg)
            account.avatar = stored
            avatarMessage = "حُدّثت صورتك الشخصية."
            await account.load()
        } catch {
            avatarMessage = ElmAPIError.wrap(error).message
        }
    }

    private func removeAvatar() async {
        avatarBusy = true
        avatarMessage = nil
        defer { avatarBusy = false }
        do {
            try await APIClient.removeAvatar()
            account.avatar = nil
            avatarMessage = "أُزيلت صورتك الشخصية."
            await account.load()
        } catch {
            avatarMessage = ElmAPIError.wrap(error).message
        }
    }

    private static func downscaled(_ image: UIImage, max side: CGFloat) -> UIImage {
        let longest = Swift.max(image.size.width, image.size.height)
        guard longest > side else { return image }
        let scale = side / longest
        let size = CGSize(width: image.size.width * scale, height: image.size.height * scale)
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        return UIGraphicsImageRenderer(size: size, format: format).image { _ in image.draw(in: CGRect(origin: .zero, size: size)) }
    }

    private var subtitle: String {
        guard member.isSignedIn else { return "قراءتك تبدأ بلا حساب — وتكبر به" }
        if let email = member.user?.email, !email.isEmpty { return email }
        return "عضوية مجانية"
    }

    /// العضوية مجانية كما على `/join` — لا خطط ولا تجربة ولا إدارة «على الموقع».
    @ViewBuilder
    private var membershipRow: some View {
        if member.isSignedIn {
            NavigationLink { MembershipScreen() } label: { membershipRowBody }
                .buttonStyle(.plain)
        } else {
            Button {
                member.authInitialMode = .signUp
                member.authPresented = true
            } label: { membershipRowBody }
            .buttonStyle(.plain)
        }
    }

    private var membershipRowBody: some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                Text(member.isSignedIn ? "عضوية مجانية" : "انضم إلى العلم")
                    .font(ElmFonts.text(.footnote, weight: .bold))
                    .foregroundStyle(ElmTheme.ink)
                Text(member.isSignedIn ? "إعداداتك وإعجاباتك وسجلك — كلها هنا" : "قراءاتك، اختياراتك، وما تودّ العودة إليه — بعضوية مجانية")
                    .font(ElmFonts.text(.caption2))
                    .foregroundStyle(ElmTheme.ink3)
                    .multilineTextAlignment(.leading)
            }
            Spacer(minLength: 0)
            Image(systemName: "arrow.left")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(ElmTheme.ink3)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 13)
        .background(
            LinearGradient(
                colors: [ElmTheme.gold.opacity(0.22), ElmTheme.surface],
                startPoint: .topTrailing,
                endPoint: .bottomLeading
            )
        )
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(ElmTheme.line, lineWidth: 1))
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }

    // MARK: المجموعات

    @ViewBuilder
    private func group<Content: View>(_ title: String, @ViewBuilder rows: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(title)
                .font(ElmFonts.text(.caption2, weight: .bold))
                .foregroundStyle(ElmTheme.ink3)
                .padding(.leading, 4)
            VStack(spacing: 0) { rows() }
                .background(ElmTheme.surface)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(ElmTheme.line, lineWidth: 1))
                .padding(.top, 8)
        }
        .padding(.top, 18)
    }

    private func rowBody(label: String, value: String, color: Color, chevron: Bool) -> some View {
        HStack(spacing: 11) {
            RoundedRectangle(cornerRadius: 3, style: .continuous)
                .fill(color)
                .frame(width: 9, height: 9)
            Text(label)
                .font(ElmFonts.text(.footnote))
                .foregroundStyle(ElmTheme.ink)
            Spacer(minLength: 6)
            if !value.isEmpty {
                Text(value)
                    .font(ElmFonts.text(.caption))
                    .foregroundStyle(ElmTheme.ink3)
            }
            if chevron {
                Image(systemName: "arrow.left")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(ElmTheme.ink3)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 13)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }

    private func linkRow<Destination: View>(
        label: String, value: String, color: Color,
        @ViewBuilder destination: () -> Destination
    ) -> some View {
        NavigationLink(destination: destination()) {
            rowBody(label: label, value: value, color: color, chevron: true)
        }
        .buttonStyle(.plain)
    }

    private func valueRow(label: String, value: String, color: Color) -> some View {
        rowBody(label: label, value: value, color: color, chevron: false)
    }

    private func toggleRow(label: String, color: Color, isOn: Bool, action: @escaping () -> Void) -> some View {
        HStack(spacing: 11) {
            RoundedRectangle(cornerRadius: 3, style: .continuous)
                .fill(color)
                .frame(width: 9, height: 9)
            Text(label)
                .font(ElmFonts.text(.footnote))
                .foregroundStyle(ElmTheme.ink)
            Spacer(minLength: 6)
            ElmToggle(isOn: isOn, action: action).accessibilityLabel(label)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
    }

    private func menuRow(label: String, color: Color) -> some View {
        Menu {
            ForEach(AppearanceMode.allCases) { mode in
                Button {
                    appearance.mode = mode
                } label: {
                    if appearance.mode == mode {
                        Label(mode.label, systemImage: "checkmark")
                    } else {
                        Text(mode.label)
                    }
                }
            }
        } label: {
            rowBody(label: label, value: appearance.mode.label, color: color, chevron: true)
        }
    }

    private var initial: String {
        guard member.isSignedIn else { return "ع" }
        return member.firstName.first.map(String.init) ?? "ع"
    }
}

#if DEBUG
/// `-elmAccount liked|history|settings|interests|membership` يدفع شاشة، و`-elmAccount auth` يفتح ورقة الدخول.
enum AccountDebugRoute: String, Hashable, Identifiable {
    case liked, history, settings, interests, membership
    var id: String { rawValue }
}
#endif

/// الخصوصية: السياسة الكاملة هي صفحة `/privacy-policy` الحية على الموقع (تُفتح داخل التطبيق)،
/// ومعها إجراء مسح بيانات القراءة المستنتجة للعضو. لا نص سياسة مختصر مخترع.
struct PrivacyScreen: View {
    @Environment(MemberSessionStore.self) private var member
    @Environment(AppearanceStore.self) private var appearance
    @State private var confirmClear = false
    @State private var busy = false
    @State private var message: String?
    var body: some View {
        ElmScreen(title: "الخصوصية", showBack: true) {
            VStack(alignment: .leading, spacing: 14) {
                Text("سياسة الخصوصية")
                    .font(ElmFonts.display(.title, weight: .heavy))
                    .foregroundStyle(ElmTheme.ink)
                    .accessibilityAddTraits(.isHeader)
                Text("توضح هذه السياسة كيفية تعامل «العلم» مع معلوماتك.")
                    .font(ElmFonts.text(.footnote))
                    .foregroundStyle(ElmTheme.ink2)

                PublicPageLink(path: "/privacy-policy") {
                    HStack(spacing: 13) {
                        Image(systemName: "doc.text")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(ElmTheme.accent)
                            .frame(width: 40, height: 40)
                            .background(ElmTheme.accent.opacity(0.10), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                        VStack(alignment: .leading, spacing: 3) {
                            Text("اقرأ سياسة الخصوصية الكاملة")
                                .font(ElmFonts.display(.subheadline, weight: .bold))
                                .foregroundStyle(ElmTheme.ink)
                            Text("تُفتح من الموقع داخل التطبيق.")
                                .font(ElmFonts.text(.caption))
                                .foregroundStyle(ElmTheme.ink3)
                        }
                        Spacer(minLength: 0)
                        Image(systemName: "arrow.up.left").font(.system(size: 11, weight: .semibold)).foregroundStyle(ElmTheme.ink3)
                    }
                    .padding(14)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .contentShape(Rectangle())
                    .elmCard(radius: 16, elevated: false)
                }
                .accessibilityLabel("اقرأ سياسة الخصوصية الكاملة")
                .accessibilityHint("تفتح صفحة الموقع داخل التطبيق")

                Text("إعداد التخصيص: \(appearance.personalizationEnabled ? "مُفعّل" : "متوقف") — يُغيَّر من «حسابي» أو «إعدادات الحساب».")
                    .font(ElmFonts.text(.caption))
                    .foregroundStyle(ElmTheme.ink2)
                    .lineSpacing(3)

                if member.isSignedIn {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("تُمسح إشارات القراءة المستنتجة (ما فُتح وكم قُرئ). تبقى اهتماماتك المختارة والمحفوظات والإعجابات.")
                            .font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink2).lineSpacing(3)
                        Button(role: .destructive) { confirmClear = true } label: {
                            Text(busy ? "لحظة…" : "مسح بيانات القراءة المستنتجة في حسابي")
                                .font(ElmFonts.text(.subheadline, weight: .semibold)).frame(minHeight: 44)
                        }
                        .disabled(busy)
                        .confirmationDialog("مسح بيانات القراءة؟ تبقى الاهتمامات التي اخترتها والمحفوظات والإعجابات.", isPresented: $confirmClear) {
                            Button("مسح البيانات", role: .destructive) {
                                guard let id = member.user?.id else { return }
                                busy = true
                                Task {
                                    do {
                                        try await APIClient.updateProfile(memberId: id, action: "clear-behavior")
                                        if member.user?.id == id { message = "تم مسح سجل القراءة والإشارات المستنتجة، مع الاحتفاظ بمحفوظاتك واهتماماتك." }
                                    } catch { if member.user?.id == id { message = "تعذر المسح. تحقق من الاتصال وحاول مجددًا." } }
                                    busy = false
                                }
                            }
                            Button("إلغاء", role: .cancel) {}
                        }
                        if let message { Text(message).font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink2).lineSpacing(3) }
                    }
                    .padding(14)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .elmCard(radius: 16, elevated: false)
                }
            }
            .padding(.horizontal, 18)
            .padding(.top, 16)
        }
    }
}

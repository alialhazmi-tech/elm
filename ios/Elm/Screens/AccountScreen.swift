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
    /// حجم خط القارئ — نفس مفتاح ورقة «حجم خط القراءة» داخل المادة.
    @AppStorage("elm.reader.fontSize") private var readerFontSize = 17.0
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
                    membershipRow.padding(.top, 18)
                    if member.isSignedIn { statsTiles.padding(.top, 22) }
                }

                group("القراءة") {
                    menuRow(label: "الوضع اللوني", icon: "circle.lefthalf.filled")
                    fontSizeRow
                    linkRow(label: "التنزيل التلقائي", value: reading.autoDownload ? "مُفعّل" : "مُعطّل", icon: "arrow.down.circle") {
                        SavedScreen()
                    }
                }

                group("المحتوى") {
                    if member.isSignedIn {
                        // من الحساب حتى 12 اهتمامًا كما على الويب؛ التهيئة (3–7) للزائر وللحساب الجديد.
                        linkRow(label: "اهتماماتي", value: ElmFormat.latinDigits(String(interests.selected.count)), icon: "sparkles") {
                            OnboardingScreen(mode: .account)
                        }
                    } else {
                        Button { onboarding.present() } label: {
                            rowBody(label: "اهتماماتي", value: ElmFormat.latinDigits(String(interests.selected.count)), icon: "sparkles", chevron: true)
                        }
                        .buttonStyle(.plain)
                    }
                    linkRow(label: "المحفوظات", value: library.items.isEmpty ? "" : ElmFormat.latinDigits(String(library.items.count)), icon: "bookmark") {
                        SavedScreen()
                    }
                    linkRow(label: "الإعجابات", value: account.overview?.stats.map { ElmFormat.latinDigits(String($0.likedCount)) } ?? "", icon: "heart") {
                        AccountLikedScreen()
                    }
                    linkRow(label: "سجل القراءة", value: account.overview?.stats.map { ElmFormat.latinDigits(String($0.articlesRead)) } ?? "", icon: "clock.arrow.circlepath") {
                        AccountHistoryScreen()
                    }
                    linkRow(label: "آخر المستجدات", value: "", icon: "bell") {
                        NotificationsScreen()
                    }
                    toggleRow(
                        label: "تخصيص «لك أنت»",
                        icon: "wand.and.stars",
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
                    linkRow(label: "العضوية", value: member.isSignedIn ? "عضوية مجانية" : "زائر", icon: "person.text.rectangle") {
                        MembershipScreen()
                    }
                    linkRow(label: "إعدادات الحساب", value: member.isSignedIn ? (account.emailVerified == false ? "البريد غير موثّق" : "") : "للأعضاء", icon: "gearshape") {
                        AccountSettingsScreen()
                    }
                    linkRow(label: "الخصوصية", value: "", icon: "lock") {
                        PrivacyScreen()
                    }
                    if member.isSignedIn {
                            Button { Task { await member.signOut() } } label: {
                            rowBody(label: member.loading ? "لحظة…" : "تسجيل الخروج", value: "", icon: "rectangle.portrait.and.arrow.right", chevron: false, tint: ElmTheme.danger)
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
                            icon: "square.and.pencil",
                            chevron: true
                        )
                    }
                    .buttonStyle(.plain)
                    .accessibilityHint("يفتح مساحة عمل الفريق التحريري بحسب صلاحيات حسابك")
                }

                group("عن العلم") {
                    PublicPageLink(path: "/about") { rowBody(label: "من نحن", value: "", icon: "info.circle", chevron: true) }
                    PublicPageLink(path: "/contact") { rowBody(label: "تواصل معنا", value: "", icon: "envelope", chevron: true) }
                    linkRow(label: "نشرة ما وراء العناوين", value: account.overview?.newsletterSubscribed == true ? "مشترك" : "", icon: "newspaper") {
                        AccountSettingsScreen()
                    }
                }

                Text("المحتوى من مواد منشورة · المصدر النهائي «تحرير العلم»\n© 2026 العلم — جميع الحقوق محفوظة")
                    .font(ElmFonts.text(.caption2))
                    .foregroundStyle(ElmTheme.ink3)
                    .multilineTextAlignment(.center)
                    .lineSpacing(4)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 32)
            }
            .padding(.horizontal, 22)
            .padding(.top, 12)
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
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 14), count: 4), spacing: 0) {
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
        VStack(alignment: .leading, spacing: 4) {
            Text(ElmFormat.latinDigits(value))
                .font(ElmFonts.display(size: 24, weight: .heavy, relativeTo: .title2)).foregroundStyle(ElmTheme.ink).elmLatin()
                .lineLimit(1).minimumScaleFactor(0.7)
            Text(label).font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink3).lineLimit(1).minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 12)
        .overlay(alignment: .top) { Rectangle().fill(ElmTheme.line2).frame(height: 1) }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(ElmFormat.latinDigits(value)) \(label)")
    }

    // MARK: الهوية والصورة الشخصية

    private var identity: some View {
        HStack(spacing: 14) {
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
            VStack(alignment: .leading, spacing: 4) {
                Text(member.isSignedIn ? member.user?.name ?? "قارئ العلم" : "أهلًا بك في العلم")
                    .font(ElmFonts.display(size: 24, weight: .heavy, relativeTo: .title2))
                    .foregroundStyle(ElmTheme.ink)
                Text(subtitle)
                    .font(ElmFonts.text(.subheadline))
                    .foregroundStyle(ElmTheme.ink2)
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
                    .frame(width: 64, height: 64)
                    .clipShape(Circle())
            } else {
                Text(initial)
                    .font(ElmFonts.display(.title2, weight: .heavy))
                    .foregroundStyle(ElmTheme.gold)
                    .frame(width: 64, height: 64)
                    .background(ElmTheme.navyDeep, in: Circle())
            }
            if avatarBusy {
                Circle().fill(.black.opacity(0.35)).frame(width: 64, height: 64)
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

    @ViewBuilder
    private var membershipRowBody: some View {
        if member.isSignedIn {
            HStack(spacing: 10) {
                Image(systemName: "checkmark.seal").font(.system(size: 16, weight: .semibold)).foregroundStyle(ElmTheme.gold)
                VStack(alignment: .leading, spacing: 2) {
                    Text("عضوية مجانية").font(ElmFonts.text(.body, weight: .semibold)).foregroundStyle(ElmTheme.ink)
                    Text("إعداداتك وإعجاباتك وسجلك — كلها هنا").font(ElmFonts.text(.footnote)).foregroundStyle(ElmTheme.ink3)
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.left").font(.system(size: 13, weight: .semibold)).foregroundStyle(ElmTheme.ink3)
            }
            .padding(.vertical, 14)
            .overlay(alignment: .top) { Rectangle().fill(ElmTheme.line2).frame(height: 1) }
            .overlay(alignment: .bottom) { Rectangle().fill(ElmTheme.line).frame(height: 1) }
            .contentShape(Rectangle())
            .accessibilityElement(children: .combine)
        } else {
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 8) {
                    Text("انضم إلى العلم").font(ElmFonts.text(.body, weight: .bold))
                    Spacer(minLength: 0)
                    Image(systemName: "arrow.left").font(.system(size: 14, weight: .bold))
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 18).frame(maxWidth: .infinity, minHeight: 52)
                .background(ElmTheme.navy, in: RoundedRectangle(cornerRadius: ElmTheme.radiusUI, style: .continuous))
                Text("قراءاتك، اختياراتك، وما تودّ العودة إليه — بعضوية مجانية.")
                    .font(ElmFonts.text(.footnote)).foregroundStyle(ElmTheme.ink3)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .contentShape(Rectangle())
            .accessibilityElement(children: .combine)
        }
    }

    // MARK: المجموعات

    /// مجموعة بالطبعة التحريرية: عنوان عرض فوق خط بنية، وصفوف تفصل بينها خطوط تفاصيل — بلا بطاقات.
    @ViewBuilder
    private func group<Content: View>(_ title: String, @ViewBuilder rows: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 6) {
                Text("✦").font(.system(size: 11)).foregroundStyle(ElmTheme.gold).accessibilityHidden(true)
                Text(title).font(ElmFonts.display(.headline, weight: .heavy)).foregroundStyle(ElmTheme.ink)
            }
            .accessibilityAddTraits(.isHeader)
            .padding(.bottom, 10)
            Rectangle().fill(ElmTheme.line2).frame(height: 1).accessibilityHidden(true)
            VStack(spacing: 0) { rows() }
        }
        .padding(.top, 30)
    }

    /// صف واحد: أيقونة أحادية اللون، تسمية بحجم المتن، قيمة خافتة، وسهم؛ خط تفاصيل أسفله.
    private func rowBody(label: String, value: String, icon: String, chevron: Bool, tint: Color = ElmTheme.ink) -> some View {
        HStack(spacing: 14) {
            Image(systemName: icon)
                .font(.system(size: 17, weight: .medium))
                .foregroundStyle(tint == ElmTheme.ink ? ElmTheme.navyInk : tint)
                .frame(width: 26)
                .accessibilityHidden(true)
            Text(label)
                .font(ElmFonts.text(.body, weight: .medium))
                .foregroundStyle(tint)
            Spacer(minLength: 8)
            if !value.isEmpty {
                Text(value)
                    .font(ElmFonts.text(.subheadline))
                    .foregroundStyle(ElmTheme.ink3)
                    .elmLatin()
                    .lineLimit(1)
            }
            if chevron {
                Image(systemName: "chevron.left")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(ElmTheme.ink3)
            }
        }
        .frame(minHeight: 54)
        .overlay(alignment: .bottom) { Rectangle().fill(ElmTheme.line).frame(height: 1) }
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }

    private func linkRow<Destination: View>(
        label: String, value: String, icon: String,
        @ViewBuilder destination: () -> Destination
    ) -> some View {
        NavigationLink(destination: destination()) {
            rowBody(label: label, value: value, icon: icon, chevron: true)
        }
        .buttonStyle(.plain)
    }

    private func toggleRow(label: String, icon: String, isOn: Bool, action: @escaping () -> Void) -> some View {
        HStack(spacing: 14) {
            Image(systemName: icon).font(.system(size: 17, weight: .medium)).foregroundStyle(ElmTheme.navyInk).frame(width: 26)
                .accessibilityHidden(true)
            Text(label)
                .font(ElmFonts.text(.body, weight: .medium))
                .foregroundStyle(ElmTheme.ink)
            Spacer(minLength: 8)
            ElmToggle(isOn: isOn, action: action).accessibilityLabel(label)
        }
        .frame(minHeight: 54)
        .overlay(alignment: .bottom) { Rectangle().fill(ElmTheme.line).frame(height: 1) }
    }

    private func menuRow(label: String, icon: String) -> some View {
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
            rowBody(label: label, value: appearance.mode.label, icon: icon, chevron: true)
        }
    }

    /// حجم خط القارئ — نفس الخيارات الثلاثة في ورقة المادة، ويحترم Dynamic Type فوقها.
    private var fontSizeRow: some View {
        Menu {
            ForEach([(17.0, "عادي"), (20.0, "كبير"), (23.0, "أكبر")], id: \.0) { size, name in
                Button { readerFontSize = size } label: {
                    if readerFontSize == size { Label(name, systemImage: "checkmark") } else { Text(name) }
                }
            }
        } label: {
            rowBody(label: "حجم خط القراءة", value: fontSizeLabel, icon: "textformat.size", chevron: true)
        }
    }

    private var fontSizeLabel: String {
        switch readerFontSize {
        case 20: return "كبير"
        case 23: return "أكبر"
        default: return "عادي"
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

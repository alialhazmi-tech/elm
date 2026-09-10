import SwiftUI

/// 1j — الحساب والإعدادات: بطاقة القارئ، حالة العضوية، ثم مجموعات مضبوطة.
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
    #if DEBUG
    @State private var debugRoute: AccountDebugRoute?
    #endif

    var body: some View {
        ElmScreen(title: "حسابي", onRefresh: { if member.isSignedIn { await account.load() } }) {
            VStack(alignment: .leading, spacing: 0) {
                identity
                membershipRow.padding(.top, 14)
                if member.isSignedIn { statsTiles.padding(.top, 14) }

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
                    Button { onboarding.present() } label: {
                        rowBody(label: "اهتماماتي", value: ElmFormat.latinDigits(String(interests.selected.count)), color: ElmTheme.hex("eda313"), chevron: true)
                    }
                    .buttonStyle(.plain)
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
                    linkRow(label: "الإشعارات", value: "", color: ElmTheme.focus) {
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

                if let error = interests.syncError { Text(error).font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink2).padding(.top, 12) }

                group("العضوية") {
                    linkRow(label: "العضوية", value: member.isSignedIn ? "حساب مسجل" : "زائر", color: SeriesPalette.color(for: "bel-tarikh")) {
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
            if member.isSignedIn { await account.load() } else { account.overview = nil; account.emailVerified = nil }
        }
        #if DEBUG
        .task { debugRoute = ElmLaunch.account.flatMap(AccountDebugRoute.init(rawValue:)) }
        .navigationDestination(item: $debugRoute) { route in
            switch route {
            case .liked: AccountLikedScreen()
            case .history: AccountHistoryScreen()
            case .settings: AccountSettingsScreen()
            }
        }
        #endif
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
            Text(error).font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink3)
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

    // MARK: الهوية

    private var identity: some View {
        HStack(spacing: 13) {
            Text(initial)
                .font(ElmFonts.display(.title2, weight: .heavy))
                .foregroundStyle(ElmTheme.gold)
                .frame(width: 56, height: 56)
                .background(ElmTheme.navyDeep, in: Circle())
            VStack(alignment: .leading, spacing: 3) {
                Text(member.isSignedIn ? member.user?.name ?? "قارئ العلم" : "أهلًا بك في العلم")
                    .font(ElmFonts.display(.title3, weight: .heavy))
                    .foregroundStyle(ElmTheme.ink)
                Text(subtitle)
                    .font(ElmFonts.text(.caption))
                    .foregroundStyle(ElmTheme.ink3)
                    .lineLimit(2)
            }
            Spacer(minLength: 0)
        }
        .accessibilityElement(children: .combine)
    }

    private var subtitle: String {
        guard member.isSignedIn else { return "قراءتك تبدأ بلا حساب — وتكبر به" }
        let saved = library.items.count
        let streak = reading.streak
        return "\(ElmFormat.materialLabel(saved)) محفوظة · سلسلة \(ElmFormat.dayLabel(streak))"
    }

    private var membershipRow: some View {
        Button {
            member.isSignedIn ? () : (member.authPresented = true)
        } label: {
            HStack(spacing: 10) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(member.isSignedIn ? "عضويتك فعّالة" : "انضم إلى العلم")
                        .font(ElmFonts.text(.footnote, weight: .bold))
                        .foregroundStyle(ElmTheme.ink)
                    Text(member.isSignedIn ? "إعداداتك وإعجاباتك وسجلك — كلها هنا" : "احفظ موادك وواصل من أي جهاز")
                        .font(ElmFonts.text(.caption2))
                        .foregroundStyle(ElmTheme.ink3)
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
        }
        .buttonStyle(.plain)
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
enum AccountDebugRoute: String, Hashable, Identifiable {
    case liked, history, settings
    var id: String { rawValue }
}
#endif

/// سياسة مختصرة داخل التطبيق حتى لا يعتمد مسار أساسي على صفحة ويب غير منشورة.
struct PrivacyScreen: View {
    @Environment(MemberSessionStore.self) private var member
    @State private var confirmClear = false
    @State private var busy = false
    @State private var message: String?
    var body: some View {
        ElmScreen(title: "الخصوصية", showBack: true) {
            VStack(alignment: .leading, spacing: 14) {
                Text("خصوصيتك ليست ثمن التخصيص")
                    .font(ElmFonts.display(.title, weight: .heavy))
                    .foregroundStyle(ElmTheme.ink)

                item(icon: "iphone", title: "اختياراتك وحسابك",
                     text: "للزائر تُحفظ الاختيارات على الجهاز. عند الدخول تتزامن المحفوظات والاهتمامات وإعداد التخصيص مع حسابك، ويبقى المظهر محليًا.")
                item(icon: "person.crop.circle.badge.checkmark", title: "الحساب مستقل",
                     text: "بيانات عضويتك تُستخدم للدخول ومزامنة تجربتك، ولا تمنحك صلاحيات تحريرية.")
                item(icon: "slider.horizontal.3", title: "أنت المتحكم",
                     text: "يمكنك إيقاف التخصيص ومسح اهتماماتك ومغادرة حسابك في أي وقت.")

                if member.isSignedIn {
                    Button("مسح بيانات القراءة المستنتجة في حسابي", role: .destructive) { confirmClear = true }
                        .disabled(busy)
                        .confirmationDialog("مسح بيانات القراءة؟ تبقى الاهتمامات التي اخترتها والمحـفوظات والإعجابات.", isPresented: $confirmClear) {
                            Button("مسح البيانات", role: .destructive) {
                                guard let id = member.user?.id else { return }
                                busy = true
                                Task {
                                    do {
                                        try await APIClient.updateProfile(memberId: id, action: "clear-behavior")
                                        if member.user?.id == id { message = "مُسحت بيانات القراءة المستنتجة في حسابك." }
                                    } catch { if member.user?.id == id { message = "تعذر المسح. تحقق من الاتصال وحاول مجددًا." } }
                                    busy = false
                                }
                            }
                            Button("إلغاء", role: .cancel) {}
                        }
                }
                if let message { Text(message).font(ElmFonts.text(.caption)) }
                Text("هذه نسخة مختصرة داخل التطبيق. تُضاف السياسة القانونية الكاملة قبل النشر في المتجر.")
                    .font(ElmFonts.text(.caption))
                    .foregroundStyle(ElmTheme.ink3)
                    .lineSpacing(3)
                    .padding(.top, 4)
            }
            .padding(.horizontal, 18)
            .padding(.top, 16)
        }
    }

    private func item(icon: String, title: String, text: String) -> some View {
        HStack(alignment: .top, spacing: 13) {
            Image(systemName: icon)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(ElmTheme.accent)
                .frame(width: 40, height: 40)
                .background(ElmTheme.accent.opacity(0.10), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(ElmFonts.display(.subheadline, weight: .bold))
                    .foregroundStyle(ElmTheme.ink)
                Text(text)
                    .font(ElmFonts.text(.footnote))
                    .foregroundStyle(ElmTheme.ink2)
                    .lineSpacing(3)
            }
            Spacer(minLength: 0)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .elmCard(radius: 16, elevated: false)
        .accessibilityElement(children: .combine)
    }
}

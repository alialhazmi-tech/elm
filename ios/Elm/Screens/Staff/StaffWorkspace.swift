import SwiftUI

/// أقسام «تحرير العلم» — المصدر الوحيد للتنقل داخل اللوحة (نظير `components/tahrir/nav.ts`).
enum StaffSection: String, CaseIterable, Identifiable, Hashable {
    case overview, stories, tasks, media, notifications, schedule, series, audit, stats, members, roles, settings, profile, help

    var id: String { rawValue }

    var title: String {
        switch self {
        case .overview: "نظرة اليوم"
        case .stories: "المواد"
        case .tasks: "مهامي"
        case .media: "الوسائط"
        case .notifications: "التنبيهات"
        case .schedule: "الجدولة"
        case .series: "السلاسل"
        case .audit: "سجل التدقيق"
        case .stats: "الإحصاءات"
        case .members: "الحسابات الإدارية"
        case .roles: "الأدوار والصلاحيات"
        case .settings: "إعدادات النظام"
        case .profile: "ملفي وأمان الحساب"
        case .help: "دليل الاستخدام"
        }
    }

    var symbol: String {
        switch self {
        case .overview: "sun.horizon"
        case .stories: "doc.text"
        case .tasks: "checklist"
        case .media: "photo.on.rectangle"
        case .notifications: "bell"
        case .schedule: "calendar.badge.clock"
        case .series: "square.stack.3d.up"
        case .audit: "list.bullet.rectangle"
        case .stats: "chart.bar"
        case .members: "person.2"
        case .roles: "key"
        case .settings: "slider.horizontal.3"
        case .profile: "person.crop.circle"
        case .help: "questionmark.circle"
        }
    }

    /// الصلاحية اللازمة لإظهار القسم — إخفاؤه تحسين تجربة فقط، والفحص الملزم على الخادم.
    var permission: String? {
        switch self {
        case .overview, .stories, .tasks, .notifications, .series, .profile, .help: nil
        case .media: "media.upload"
        case .schedule: "story.schedule"
        case .audit: "audit.view"
        case .stats: "stats.view"
        case .members: "users.view"
        case .roles: "roles.manage"
        case .settings: "ai.settings"
        }
    }

    static let primary: [StaffSection] = [.overview, .stories, .tasks, .media]

    static func visible(for actor: StaffActor?) -> [StaffSection] {
        allCases.filter { section in
            guard let key = section.permission else { return true }
            return actor?.can(key) ?? false
        }
    }
}

/// مساحة «تحرير العلم» فوق تبويبات القارئ: شاشة دخول عند غياب الجلسة، ثم تبويبات على
/// الآيفون أو شريط جانبي على الآيباد. انتهاء الجلسة أثناء العمل يعرض الدخول فوق الشاشات لا بدلًا منها.
struct StaffWorkspace: View {
    @Environment(StaffSessionStore.self) private var staff
    @Environment(\.horizontalSizeClass) private var sizeClass
    @Environment(\.scenePhase) private var scenePhase
    @State private var tab: StaffSection = .overview
    @State private var sidebarSelection: StaffSection? = .overview
    @State private var unread = 0

    var body: some View {
        ZStack {
            if staff.actor != nil || staff.phase == .active {
                Group {
                    if sizeClass == .regular { splitLayout } else { tabLayout }
                }
                .disabled(staff.phase != .active)
                .blur(radius: staff.phase == .active ? 0 : 6)
            }
            if staff.phase != .active {
                StaffLoginScreen()
                    .transition(.opacity)
            }
        }
        .animation(.snappy(duration: 0.25), value: staff.phase)
        .task {
            #if DEBUG
            if let user = ElmLaunch.staffUser, let password = ElmLaunch.staffPassword, staff.phase != .active {
                _ = await staff.signIn(username: user, password: password)
            }
            if let section = ElmLaunch.staffSection.flatMap(StaffSection.init(rawValue:)) {
                tab = StaffSection.primary.contains(section) ? section : .help
                sidebarSelection = section
            }
            #endif
            await refreshUnread()
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { Task { await staff.restore(); await refreshUnread() } }
        }
    }

    // MARK: آيفون — تبويبات

    private var tabLayout: some View {
        TabView(selection: $tab) {
            ForEach(StaffSection.primary) { section in
                NavigationStack { screen(section) }
                    .tabItem { Label(section.title, systemImage: section.symbol) }
                    .tag(section)
            }
            NavigationStack { StaffMoreScreen(unread: unread) }
                .tabItem { Label("المزيد", systemImage: "ellipsis.circle") }
                .tag(StaffSection.help)
                .badge(unread)
        }
        .tint(ElmTheme.navyInk)
    }

    // MARK: آيباد — شريط جانبي

    private var splitLayout: some View {
        NavigationSplitView {
            List(selection: $sidebarSelection) {
                Section {
                    ForEach(StaffSection.visible(for: staff.actor)) { section in
                        Label {
                            HStack {
                                Text(section.title)
                                if section == .notifications, unread > 0 {
                                    Spacer()
                                    Text(ElmFormat.latinDigits(String(unread)))
                                        .font(ElmFonts.text(.caption2, weight: .bold))
                                        .foregroundStyle(.white)
                                        .padding(.horizontal, 7).padding(.vertical, 2)
                                        .background(ElmTheme.danger, in: Capsule())
                                }
                            }
                        } icon: { Image(systemName: section.symbol) }
                        .font(ElmFonts.text(.subheadline, weight: .medium))
                        .tag(section)
                    }
                } header: {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("تحرير العلم").font(ElmFonts.display(.title3, weight: .heavy)).foregroundStyle(ElmTheme.ink)
                        if let actor = staff.actor {
                            Text("\(actor.displayName) · \(actor.roleLabel ?? actor.role)").font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink3)
                        }
                    }
                    .padding(.bottom, 8)
                }
                Section {
                    Button { staff.workspacePresented = false } label: {
                        Label("العودة إلى القراءة", systemImage: "arrow.uturn.backward")
                            .font(ElmFonts.text(.subheadline, weight: .medium))
                    }
                    Button(role: .destructive) { Task { await staff.signOut() } } label: {
                        Label("تسجيل الخروج من اللوحة", systemImage: "rectangle.portrait.and.arrow.right")
                            .font(ElmFonts.text(.subheadline, weight: .medium))
                    }
                }
            }
            .navigationTitle("تحرير العلم")
            .toolbar(.hidden, for: .navigationBar)
            .scrollContentBackground(.hidden)
            .background(ElmTheme.surface2)
        } detail: {
            NavigationStack { screen(sidebarSelection ?? .overview) }
                .id(sidebarSelection)
        }
        .navigationSplitViewStyle(.balanced)
        .tint(ElmTheme.navyInk)
    }

    @ViewBuilder
    private func screen(_ section: StaffSection) -> some View {
        switch section {
        case .overview: StaffOverviewScreen(unread: unread)
        case .stories: StaffStoriesScreen()
        case .tasks: StaffTasksScreen()
        case .media: StaffMediaScreen()
        case .notifications: StaffNotificationsScreen(onRead: { Task { await refreshUnread() } })
        case .schedule: StaffScheduleScreen()
        case .series: StaffSeriesScreen()
        case .audit: StaffAuditScreen()
        case .stats: StaffStatsScreen()
        case .members: StaffMembersScreen()
        case .roles: StaffRolesScreen()
        case .settings: StaffSettingsScreen()
        case .profile: StaffProfileScreen()
        case .help: StaffMoreScreen(unread: unread)
        }
    }

    private func refreshUnread() async {
        guard staff.phase == .active else { return }
        if let (payload, _) = try? await StaffAPI.notifications(etag: nil), let payload {
            unread = payload.notifications.filter { $0.readAt == nil }.count
        }
    }
}

/// «المزيد» على الآيفون: بقية الأقسام بحسب الصلاحية، والعودة للقراءة، والخروج.
struct StaffMoreScreen: View {
    @Environment(StaffSessionStore.self) private var staff
    let unread: Int

    private var sections: [StaffSection] {
        StaffSection.visible(for: staff.actor).filter { !StaffSection.primary.contains($0) }
    }

    var body: some View {
        StaffScreen(title: "المزيد") {
            VStack(alignment: .leading, spacing: 16) {
                if let actor = staff.actor {
                    HStack(spacing: 12) {
                        StaffAvatar(url: actor.avatarUrl, name: actor.displayName, size: 52)
                        VStack(alignment: .leading, spacing: 3) {
                            Text(actor.displayName).font(ElmFonts.display(.headline, weight: .bold)).foregroundStyle(ElmTheme.ink)
                            Text("\(actor.roleLabel ?? actor.role) · @\(actor.username)").font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink3)
                        }
                        Spacer()
                    }
                    .padding(.top, 6)
                }
                VStack(spacing: 0) {
                    ForEach(Array(sections.enumerated()), id: \.element.id) { index, section in
                        NavigationLink(value: section) {
                            StaffMenuRow(title: section.title, symbol: section.symbol, badge: section == .notifications ? unread : nil)
                        }
                        .buttonStyle(.plain)
                        if index < sections.count - 1 { Divider().overlay(ElmTheme.line).padding(.leading, 60) }
                    }
                }
                .background(ElmTheme.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(ElmTheme.line, lineWidth: 1))

                VStack(spacing: 10) {
                    StaffSecondaryButton(title: "العودة إلى القراءة", symbol: "arrow.uturn.backward") { staff.workspacePresented = false }
                    StaffSecondaryButton(title: "تسجيل الخروج من اللوحة", symbol: "rectangle.portrait.and.arrow.right", destructive: true) {
                        Task { await staff.signOut() }
                    }
                }
                Text("الجلسة صالحة 12 ساعة ثم تُطلب إعادة الدخول. تغيير كلمة المرور أو التعليق ينهي الجلسة فورًا.")
                    .font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink3)
            }
            .padding(.horizontal, 18)
            .padding(.top, 12)
        }
        .navigationDestination(for: StaffSection.self) { section in
            switch section {
            case .notifications: StaffNotificationsScreen(onRead: nil)
            case .schedule: StaffScheduleScreen(showBack: true)
            case .series: StaffSeriesScreen(showBack: true)
            case .audit: StaffAuditScreen(showBack: true)
            case .stats: StaffStatsScreen(showBack: true)
            case .members: StaffMembersScreen(showBack: true)
            case .roles: StaffRolesScreen(showBack: true)
            case .settings: StaffSettingsScreen(showBack: true)
            case .profile: StaffProfileScreen(showBack: true)
            case .help: StaffHelpScreen()
            case .overview: StaffOverviewScreen(unread: unread)
            case .stories: StaffStoriesScreen(showBack: true)
            case .tasks: StaffTasksScreen(showBack: true)
            case .media: StaffMediaScreen(showBack: true)
            }
        }
    }
}

/// صورة الموظف أو حرفه الأول.
struct StaffAvatar: View {
    let url: String?
    let name: String
    var size: CGFloat = 40
    var body: some View {
        Group {
            if let image = ElmMedia.url(url) {
                RemoteImage(url: image, maxPixel: 200).frame(width: size, height: size)
            } else {
                Text(name.first.map(String.init) ?? "ع")
                    .font(ElmFonts.display(size: size * 0.42, weight: .heavy, relativeTo: .title3))
                    .foregroundStyle(ElmTheme.gold)
                    .frame(width: size, height: size)
                    .background(ElmTheme.navyDeep)
            }
        }
        .clipShape(Circle())
        .accessibilityHidden(true)
    }
}

/// دليل مختصر داخل التطبيق — يقابل `/tahrir/help`.
struct StaffHelpScreen: View {
    var body: some View {
        StaffScreen(title: "دليل الاستخدام", showBack: true) {
            VStack(alignment: .leading, spacing: 16) {
                Text("كيف تعمل اللوحة").font(ElmFonts.display(.title2, weight: .heavy)).foregroundStyle(ElmTheme.ink)
                step("1", "المسودة", "أنشئ مادة من «المواد» أو «مهامي». يُحفظ ما تكتبه تلقائيًا كل ثانيتين، وتبقى نسخة على الجهاز عند انقطاع الاتصال.")
                step("2", "الرفع للاعتماد", "عند الاكتمال ارفع المادة؛ يفحصها الحارس التحريري على الخادم ويمنع المخالفات القاطعة عند تفعيل البوابة.")
                step("3", "الاعتماد والنشر", "من يملك صلاحية النشر يعتمد المادة أو يعيدها بسبب واضح، أو يجدولها لموعد لاحق بتوقيت الرياض.")
                step("4", "مسودات التعديل", "تعديل مادة منشورة ينشئ مسودة مستقلة؛ النص العام لا يتغير حتى اعتماد التعديل.")
                step("5", "قفل الإصدار", "كل حفظ يحمل رقم الإصدار. إن عدّل زميل المادة قبلك يظهر تعارض ويُحفظ تعديلك محليًا حتى تراجعه.")
                step("6", "الأرشفة", "المادة المنشورة تُؤرشف بسبب إلزامي وتُستعاد كمسودة. كل إجراء يُسجَّل باسم منفّذه في سجل التدقيق.")
            }
            .padding(.horizontal, 18)
            .padding(.top, 12)
        }
    }

    private func step(_ number: String, _ title: String, _ text: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Text(number)
                .font(ElmFonts.display(.subheadline, weight: .heavy))
                .foregroundStyle(ElmTheme.gold)
                .frame(width: 30, height: 30)
                .background(ElmTheme.navyDeep, in: Circle())
            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(ElmFonts.text(.subheadline, weight: .bold)).foregroundStyle(ElmTheme.ink)
                Text(text).font(ElmFonts.text(.footnote)).foregroundStyle(ElmTheme.ink2).lineSpacing(3)
            }
        }
        .accessibilityElement(children: .combine)
    }
}

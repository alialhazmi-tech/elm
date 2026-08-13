import SwiftUI

/// 1g — بوابة الحساب والهوية الرقمية للقارئ.
struct AccountScreen: View {
    @Environment(LibraryStore.self) private var library
    @Environment(InterestStore.self) private var interests
    @Environment(AppearanceStore.self) private var appearance
    @Environment(MemberSessionStore.self) private var member

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                identityCard
                if member.isSignedIn { readingSnapshot }

                Text("مساحتك")
                    .font(ElmFonts.display(.title3, weight: .heavy))
                    .foregroundStyle(ElmTheme.ink)
                    .padding(.top, 4)

                VStack(spacing: 0) {
                    NavigationLink { InterestsScreen() } label: {
                        accountRow(title: "اهتماماتي", detail: interestDetail, systemImage: "sparkles", tint: SeriesPalette.color(for: "shakhsiat"))
                    }
                    Divider().padding(.horizontal, 14)
                    NavigationLink { LibraryScreen() } label: {
                        accountRow(title: "المحفوظات", detail: libraryDetail, systemImage: "bookmark.fill", tint: ElmTheme.success)
                    }
                    Divider().padding(.horizontal, 14)
                    NavigationLink { SettingsScreen() } label: {
                        accountRow(title: "الإعدادات والخصوصية", detail: appearance.mode.label, systemImage: "slider.horizontal.3", tint: ElmTheme.accent)
                    }
                }
                .background(ElmTheme.surface)
                .clipShape(RoundedRectangle(cornerRadius: ElmTheme.radiusLg, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: ElmTheme.radiusLg).stroke(ElmTheme.line))

                if member.isSignedIn {
                    Button(role: .destructive) {
                        Task { await member.signOut() }
                    } label: {
                        Label(member.loading ? "لحظة…" : "تسجيل الخروج", systemImage: "rectangle.portrait.and.arrow.left")
                            .font(ElmFonts.text(.subheadline, weight: .semibold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                    }
                    .disabled(member.loading)
                }

                Text("خصوصيتك ليست ثمن التخصيص. اختياراتك المحلية تبقى على الجهاز، ويمكنك إيقاف التخصيص متى شئت.")
                    .font(ElmFonts.text(.caption))
                    .foregroundStyle(ElmTheme.ink2)
                    .padding(.horizontal, 4)
            }
            .padding(14)
        }
        .background(ElmTheme.bg.ignoresSafeArea())
        .navigationTitle("حسابي")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var identityCard: some View {
        ZStack(alignment: .bottomLeading) {
            RoundedRectangle(cornerRadius: ElmTheme.radiusLg, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [ElmTheme.navyDeep, Color(red: 0.08, green: 0.22, blue: 0.39)],
                        startPoint: .topTrailing,
                        endPoint: .bottomLeading
                    )
                )
            Circle()
                .fill(SeriesPalette.color(for: "limatha").opacity(0.22))
                .frame(width: 180, height: 180)
                .blur(radius: 5)
                .offset(x: -95, y: -105)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 16) {
                HStack(spacing: 13) {
                    ZStack {
                        Circle().fill(.white.opacity(0.12))
                        Text(initial)
                            .font(ElmFonts.display(.title2, weight: .heavy))
                            .foregroundStyle(ElmTheme.gold)
                    }
                    .frame(width: 58, height: 58)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(member.isSignedIn ? "مرحبًا، \(member.firstName)" : "أهلًا بك في العلم")
                            .font(ElmFonts.display(.title2, weight: .heavy))
                            .foregroundStyle(.white)
                        Text(member.isSignedIn ? (member.user?.email ?? "عضو في العلم") : "قراءتك تبدأ بلا حساب — وتكبر به")
                            .font(ElmFonts.text(.caption))
                            .foregroundStyle(.white.opacity(0.72))
                            .environment(\.layoutDirection, member.isSignedIn ? .leftToRight : .rightToLeft)
                    }
                }

                if !member.isSignedIn {
                    Text("احفظ موادك وواصلها من أي جهاز، واجعل صفحة «لك» أقرب لاهتماماتك.")
                        .font(ElmFonts.text(.body))
                        .foregroundStyle(.white.opacity(0.84))
                        .lineSpacing(4)
                    Button {
                        member.authPresented = true
                    } label: {
                        HStack {
                            Text("انضم أو ادخل")
                            Spacer()
                            Image(systemName: "arrow.left")
                        }
                        .font(ElmFonts.text(.headline, weight: .bold))
                        .foregroundStyle(ElmTheme.navyDeep)
                        .padding(14)
                        .background(.white)
                        .clipShape(RoundedRectangle(cornerRadius: ElmTheme.radiusSm))
                    }
                } else {
                    Label("عضويتك متصلة وآمنة", systemImage: "checkmark.shield.fill")
                        .font(ElmFonts.text(.caption, weight: .bold))
                        .foregroundStyle(Color(red: 0.55, green: 0.90, blue: 0.72))
                }
            }
            .padding(20)
        }
        .frame(minHeight: member.isSignedIn ? 160 : 225)
        .accessibilityElement(children: .contain)
    }

    private var readingSnapshot: some View {
        HStack(spacing: 1) {
            snapshot(value: ElmFormat.latinDigits(String(library.items.count)), label: "محفوظة")
            snapshot(value: ElmFormat.latinDigits(String(interests.items.count)), label: "اهتمامات")
            snapshot(value: "100%", label: "تحكمك")
        }
        .background(ElmTheme.line)
        .clipShape(RoundedRectangle(cornerRadius: ElmTheme.radiusMd, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: ElmTheme.radiusMd).stroke(ElmTheme.line))
    }

    private func snapshot(value: String, label: String) -> some View {
        VStack(spacing: 3) {
            Text(value)
                .font(ElmFonts.display(.title3, weight: .heavy))
                .foregroundStyle(ElmTheme.ink)
                .environment(\.layoutDirection, .leftToRight)
            Text(label)
                .font(ElmFonts.text(.caption2, weight: .medium))
                .foregroundStyle(ElmTheme.ink2)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 14)
        .background(ElmTheme.surface)
    }

    private func accountRow(title: String, detail: String, systemImage: String, tint: Color) -> some View {
        HStack(spacing: 12) {
            Image(systemName: systemImage)
                .font(.headline)
                .foregroundStyle(tint)
                .frame(width: 42, height: 42)
                .background(tint.opacity(0.10))
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(ElmFonts.display(.subheadline, weight: .bold)).foregroundStyle(ElmTheme.ink)
                Text(detail).font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink2)
            }
            Spacer()
            Image(systemName: "chevron.left").font(.caption.weight(.bold)).foregroundStyle(ElmTheme.ink3)
        }
        .padding(14)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }

    private var initial: String {
        guard member.isSignedIn else { return "ع" }
        return member.firstName.first.map(String.init) ?? "ع"
    }

    private var interestDetail: String {
        if interests.items.isEmpty { return "اختر ما يهمك" }
        let count = interests.items.count
        if count == 1 { return "اهتمام واحد" }
        if count == 2 { return "اهتمامان" }
        if count <= 10 { return "\(ElmFormat.latinDigits(String(count))) اهتمامات" }
        return "\(ElmFormat.latinDigits(String(count))) اهتمامًا"
    }

    private var libraryDetail: String {
        library.items.isEmpty ? "تبدأ من زر الحفظ في المادة" : ElmFormat.materialLabel(library.items.count)
    }
}

/// 1i — الاهتمامات على الجهاز، مع شرح أثر كل اختيار.
struct InterestsScreen: View {
    @Environment(InterestStore.self) private var interests

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 7) {
                    Text("صمّم صفحتك")
                        .font(ElmFonts.display(.title2, weight: .heavy))
                        .foregroundStyle(ElmTheme.ink)
                    Text("اختياراتك ترتب «لك» على هذا الجهاز. لن نخفي عنك الأخبار المهمة خارجها.")
                        .font(ElmFonts.text(.body))
                        .foregroundStyle(ElmTheme.ink2)
                }
                .padding(18)
                .background(LinearGradient(colors: [ElmTheme.accent.opacity(0.12), ElmTheme.surface], startPoint: .topTrailing, endPoint: .bottomLeading))
                .clipShape(RoundedRectangle(cornerRadius: ElmTheme.radiusLg))
                .overlay(RoundedRectangle(cornerRadius: ElmTheme.radiusLg).stroke(ElmTheme.line))

                HStack {
                    Text("\(ElmFormat.latinDigits(String(interests.items.count))) مختارة")
                        .font(ElmFonts.text(.caption, weight: .bold)).foregroundStyle(ElmTheme.ink2)
                    Spacer()
                    if !interests.selected.isEmpty {
                        Button("مسح الكل") { interests.clear() }
                            .font(ElmFonts.text(.caption, weight: .semibold))
                    }
                }

                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                    ForEach(InterestCatalog.all) { item in
                        InterestChoiceCard(item: item, selected: interests.selected.contains(item.id)) {
                            interests.toggle(item.id)
                        }
                    }
                }
            }
            .padding(16)
        }
        .background(ElmTheme.bg.ignoresSafeArea())
        .navigationTitle("اهتماماتي")
        .navigationBarTitleDisplayMode(.inline)
    }
}

/// 1k — المحفوظات المحلية، جاهزة للقراءة بلا اتصال بعد فتح المادة مرة.
struct LibraryScreen: View {
    @Environment(LibraryStore.self) private var library

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 12) {
                if library.items.isEmpty {
                    EmptyLibraryView()
                } else {
                    HStack {
                        Text(ElmFormat.materialLabel(library.items.count))
                            .font(ElmFonts.text(.caption, weight: .bold)).foregroundStyle(ElmTheme.ink2)
                        Spacer()
                        Label("محفوظة على الجهاز", systemImage: "iphone")
                            .font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink2)
                    }
                    ForEach(library.items) { story in
                        MiniStoryRow(story: story)
                            .contextMenu {
                                Button("إزالة من المحفوظات", role: .destructive) { library.toggle(story) }
                            }
                            .swipeActions(edge: .leading) {
                                Button(role: .destructive) { library.toggle(story) } label: { Label("إزالة", systemImage: "trash") }
                            }
                    }
                }
            }
            .padding(16)
        }
        .background(ElmTheme.bg.ignoresSafeArea())
        .navigationTitle("المحفوظات")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct EmptyLibraryView: View {
    var body: some View {
        VStack(spacing: 16) {
            ZStack {
                Circle().fill(ElmTheme.surface2).frame(width: 110, height: 110)
                Image(systemName: "bookmark").font(.system(size: 38, weight: .light)).foregroundStyle(ElmTheme.accent)
            }
            Text("مكتبتك تنتظرك")
                .font(ElmFonts.display(.title2, weight: .heavy)).foregroundStyle(ElmTheme.ink)
            Text("احفظ أي مادة من زر الإشارة أثناء القراءة. وبعد فتحها مرة، تستطيع العودة إليها حتى بلا اتصال.")
                .font(ElmFonts.text(.body)).foregroundStyle(ElmTheme.ink2).multilineTextAlignment(.center).lineSpacing(4)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 70)
    }
}

/// 1l — الثيم والخصوصية والوصول والكاش.
struct SettingsScreen: View {
    @Environment(AppearanceStore.self) private var appearance
    @Environment(OnboardingStore.self) private var onboarding
    @Environment(ConnectivityStore.self) private var connectivity

    var body: some View {
        @Bindable var appearance = appearance
        Form {
            Section("المظهر") {
                Picker("نمط الألوان", selection: $appearance.mode) {
                    ForEach(AppearanceMode.allCases) { mode in Text(mode.label).tag(mode) }
                }
                .pickerStyle(.segmented)
                Label("حجم الخط يتبع إعدادات النظام ويدعم Dynamic Type بالكامل.", systemImage: "textformat.size")
                    .font(ElmFonts.text(.footnote)).foregroundStyle(ElmTheme.ink2)
            }

            Section("التخصيص والخصوصية") {
                Toggle(isOn: $appearance.personalizationEnabled) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text("تخصيص صفحة «لك»").font(ElmFonts.text(.body, weight: .semibold))
                        Text("يستخدم اهتماماتك المعلنة فقط على هذا الجهاز.").font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink2)
                    }
                }
                .tint(ElmTheme.navy)
            }

            Section("القراءة بلا اتصال") {
                LabeledContent("حالة الشبكة", value: connectivity.isOffline ? "بلا اتصال" : "متصل")
                if let date = HomeCache.updatedAt {
                    LabeledContent("آخر حفظ") {
                        Text(date.formatted(date: .abbreviated, time: .shortened))
                            .environment(\.layoutDirection, .leftToRight)
                    }
                }
                Text("نحفظ حزمة الرئيسية وتفاصيل المواد التي فتحتها باستخدام SwiftData.")
                    .font(ElmFonts.text(.footnote)).foregroundStyle(ElmTheme.ink2)
            }

            Section("التجربة") {
                Button("عرض جولة الترحيب من جديد") { onboarding.present() }
                NavigationLink("سياسة الخصوصية") { PrivacyScreen() }
            }
        }
        .scrollContentBackground(.hidden)
        .background(ElmTheme.bg.ignoresSafeArea())
        .navigationTitle("الإعدادات")
        .navigationBarTitleDisplayMode(.inline)
    }
}

/// سياسة مختصرة داخل التطبيق حتى لا يعتمد مسار أساسي على صفحة ويب غير منشورة.
private struct PrivacyScreen: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Text("خصوصيتك ليست ثمن التخصيص")
                    .font(ElmFonts.display(.title, weight: .heavy))
                    .foregroundStyle(ElmTheme.ink)
                privacyItem(
                    icon: "iphone",
                    title: "اختياراتك على جهازك",
                    text: "الاهتمامات والمحفوظات وإعدادات المظهر تُحفظ محليًا على هذا الجهاز."
                )
                privacyItem(
                    icon: "person.crop.circle.badge.checkmark",
                    title: "الحساب مستقل",
                    text: "بيانات عضويتك تُستخدم للدخول ومزامنة تجربتك، ولا تمنحك صلاحيات تحريرية."
                )
                privacyItem(
                    icon: "slider.horizontal.3",
                    title: "أنت المتحكم",
                    text: "يمكنك إيقاف التخصيص ومسح اهتماماتك ومغادرة حسابك من الإعدادات في أي وقت."
                )
                Text("هذه نسخة مختصرة داخل التطبيق. ستُضاف السياسة القانونية الكاملة قبل نشر التطبيق في المتجر.")
                    .font(ElmFonts.text(.footnote))
                    .foregroundStyle(ElmTheme.ink2)
                    .padding(.top, 6)
            }
            .padding(16)
        }
        .background(ElmTheme.bg.ignoresSafeArea())
        .navigationTitle("الخصوصية")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func privacyItem(icon: String, title: String, text: String) -> some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: icon)
                .font(.headline)
                .foregroundStyle(ElmTheme.accent)
                .frame(width: 42, height: 42)
                .background(ElmTheme.accent.opacity(0.10))
                .clipShape(RoundedRectangle(cornerRadius: 12))
            VStack(alignment: .leading, spacing: 5) {
                Text(title)
                    .font(ElmFonts.display(.headline, weight: .bold))
                    .foregroundStyle(ElmTheme.ink)
                Text(text)
                    .font(ElmFonts.text(.body))
                    .foregroundStyle(ElmTheme.ink2)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(ElmTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: ElmTheme.radiusMd))
        .overlay(RoundedRectangle(cornerRadius: ElmTheme.radiusMd).stroke(ElmTheme.line))
        .accessibilityElement(children: .combine)
    }
}

import SwiftUI

/// «لك أنت» من `/api/mobile/v1/for-you` للعضو (الأسباب كما يرسلها محرك الترشيح، بلا بادئة).
/// 401 = زائر (لا تغذية مركّبة محليًا: دعوة انضمام ثم «من اختيارات العلم» بلا أسباب)،
/// وأي خطأ آخر = رسالة مع إعادة محاولة مع إبقاء آخر مواد.
@MainActor
@Observable
final class ForYouStore {
    var items: [ForYouItem] = []
    /// اختيارات العلم للزائر: أول مواد حزمة الرئيسية بلا أسباب مخترعة.
    var editorial: [StoryCard] = []
    var loading = false
    var guest = false
    var errorMessage: String?

    func load() async {
        if items.isEmpty && editorial.isEmpty { loading = true }
        defer { loading = false }

        do {
            let payload = try await APIClient.fetchForYou()
            items = payload.items
            guest = false
            errorMessage = nil
            editorial = []
            ImageStore.shared.prefetch(items.compactMap(\.story.imageURL))
        } catch {
            let api = ElmAPIError.wrap(error)
            if api.isUnauthorized {
                guest = true
                errorMessage = nil
                items = []
                await hydrateHomeIfNeeded()
                editorial = Array(HomeCorpus.cards().prefix(9))
                ImageStore.shared.prefetch(editorial.compactMap(\.imageURL))
            } else {
                // الشبكة أو الخادم: لا نفترض أن القارئ زائر، ونبقي آخر مواد ظاهرة.
                errorMessage = api.message
            }
        }
    }

    private func hydrateHomeIfNeeded() async {
        guard HomeCorpus.cards().isEmpty else { return }
        if let (_, data) = try? await APIClient.fetchHome() {
            HomeCache.save(data)
        }
    }
}

/// 1f — لك أنت: التحية الثابتة كما على الويب «صباح المعرفة، {الاسم}»، وسطر «لماذا ظهر لك؟» تحت كل مادة.
struct ForYouScreen: View {
    @Environment(InterestStore.self) private var interests
    @Environment(AppearanceStore.self) private var appearance
    @Environment(MemberSessionStore.self) private var member
    @Environment(OnboardingStore.self) private var onboarding
    @State private var store = ForYouStore()

    var body: some View {
        ElmScreen(showBrand: true, onRefresh: { await refresh() }) {
            VStack(alignment: .leading, spacing: 0) {
                Text("صفحتك في العلم")
                    .font(ElmFonts.text(.caption2, weight: .bold))
                    .foregroundStyle(ElmTheme.ink3)
                Text(greeting)
                    .font(ElmFonts.display(.title, weight: .heavy))
                    .foregroundStyle(ElmTheme.ink)
                    .padding(.top, 4)
                Text("مواد رتّبناها من اهتماماتك، مع مساحة دائمة لاختيارات المحررين والاكتشاف.")
                    .font(ElmFonts.text(.footnote))
                    .foregroundStyle(ElmTheme.ink2)
                    .lineSpacing(4)
                    .padding(.top, 6)

                if member.suspended {
                    SuspendedPanel().padding(.top, 16)
                } else if store.guest && !member.isSignedIn {
                    guestBanner.padding(.top, 16)
                    interestRow.padding(.top, 14)
                    editorialSection.padding(.top, 20)
                } else {
                    interestRow.padding(.top, 14)

                    if !appearance.personalizationEnabled {
                        Label("التخصيص متوقف — نعرض اختيارات المحررين.", systemImage: "eye.slash")
                            .font(ElmFonts.text(.caption, weight: .medium))
                            .foregroundStyle(ElmTheme.ink2)
                            .padding(12)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(ElmTheme.surface2, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                            .padding(.top, 12)
                    }

                    if let error = store.errorMessage {
                        errorBox(error).padding(.top, 14)
                    }

                    if store.loading && store.items.isEmpty {
                        ProgressView()
                            .tint(ElmTheme.navy)
                            .frame(maxWidth: .infinity)
                            .padding(.top, 40)
                    } else if store.items.isEmpty && store.errorMessage == nil {
                        Text(member.isSignedIn ? "لا مواد بعد. تصفّح الرئيسية أو حدّد اهتماماتك." : "سجّل الدخول لترى ترشيحاتك.")
                            .font(ElmFonts.text(.callout))
                            .foregroundStyle(ElmTheme.ink2)
                            .padding(.top, 20)
                    } else {
                        if let lead = store.items.first {
                            leadCard(lead).padding(.top, 16)
                        }
                        VStack(spacing: 10) {
                            ForEach(Array(store.items.dropFirst())) { item in
                                reasonCard(item)
                            }
                        }
                        .padding(.top, 12)
                    }
                }
            }
            .padding(.horizontal, 18)
            .padding(.top, 16)
        }
        .task(id: member.user?.id) { await refresh() }
    }

    private func refresh() async {
        await store.load()
        // 401 رغم أن التطبيق يظن الجلسة قائمة: نعيد التحقق (خروج أو تعليق) بدل حساب «مسجّل» لا يعمل.
        if store.guest, member.isSignedIn { await member.revalidate() }
    }

    // MARK: الاهتمامات

    private var interestRow: some View {
        ElmFlow(spacing: 7) {
            ForEach(interests.items) { item in
                HStack(spacing: 6) {
                    RoundedRectangle(cornerRadius: 2, style: .continuous)
                        .fill(ElmTheme.hex(item.color))
                        .frame(width: 7, height: 7)
                    Text(item.label)
                        .font(ElmFonts.text(.footnote))
                        .foregroundStyle(ElmTheme.ink2)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 5)
                .background(ElmTheme.surface, in: Capsule())
                .overlay(Capsule().stroke(ElmTheme.line, lineWidth: 1))
            }

            if member.isSignedIn {
                NavigationLink { OnboardingScreen(mode: .account) } label: { adjustChip }
                    .buttonStyle(.plain)
            } else {
                Button { onboarding.present() } label: { adjustChip }
                    .buttonStyle(.plain)
            }
        }
    }

    private var adjustChip: some View {
        Text("اضبط اهتماماتك")
            .font(ElmFonts.text(.footnote))
            .foregroundStyle(ElmTheme.ink3)
            .padding(.horizontal, 12)
            .padding(.vertical, 5)
            .overlay(
                Capsule().stroke(ElmTheme.line2, style: StrokeStyle(lineWidth: 1, dash: [4, 3]))
            )
    }

    // MARK: الحالات

    private func errorBox(_ text: String) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Label(text, systemImage: "wifi.slash")
                .font(ElmFonts.text(.footnote))
                .foregroundStyle(ElmTheme.ink2)
                .lineSpacing(3)
            Button("إعادة المحاولة") { Task { await refresh() } }
                .font(ElmFonts.text(.footnote, weight: .semibold))
                .frame(minHeight: 44)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(ElmTheme.surface2, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    /// للزائر: قائمة عامة من حزمة الرئيسية بعنوان «من اختيارات العلم» — بلا أسباب ترشيح.
    private var editorialSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("من اختيارات العلم")
                .font(ElmFonts.display(.headline, weight: .heavy))
                .foregroundStyle(ElmTheme.ink)
                .accessibilityAddTraits(.isHeader)
            if store.loading && store.editorial.isEmpty {
                ProgressView().tint(ElmTheme.navy).frame(maxWidth: .infinity).padding(.top, 20)
            } else if store.editorial.isEmpty {
                Text("تعذر تحميل المواد. اسحب للتحديث.")
                    .font(ElmFonts.text(.footnote))
                    .foregroundStyle(ElmTheme.ink2)
            } else {
                ForEach(store.editorial) { story in
                    NavigationLink { StoryDestination(seed: story) } label: { NativeStoryRow(story: story) }
                        .buttonStyle(.plain)
                        .accessibilityLabel(story.title)
                }
            }
        }
    }

    // MARK: البطاقات

    private func leadCard(_ item: ForYouItem) -> some View {
        NavigationLink {
            StoryDestination(seed: item.story)
        } label: {
            VStack(alignment: .leading, spacing: 0) {
                RemoteImage(url: item.story.imageURL, height: 172)

                VStack(alignment: .leading, spacing: 0) {
                    Text(kicker(item.story))
                        .font(ElmFonts.text(.caption2, weight: .bold))
                        .foregroundStyle(item.story.series.map(SeriesPalette.color(for:)) ?? ElmTheme.accent)
                    Text(item.story.title)
                        .font(ElmFonts.display(.headline, weight: .heavy))
                        .foregroundStyle(ElmTheme.ink)
                        .multilineTextAlignment(.leading)
                        .padding(.top, 6)
                    if !item.story.excerpt.isEmpty {
                        Text(item.story.excerpt)
                            .font(ElmFonts.text(.footnote))
                            .foregroundStyle(ElmTheme.ink2)
                            .multilineTextAlignment(.leading)
                            .lineSpacing(4)
                            .lineLimit(3)
                            .padding(.top, 8)
                    }
                    VStack(alignment: .leading, spacing: 0) {
                        Rectangle()
                            .fill(ElmTheme.line)
                            .frame(height: 1)
                            .padding(.bottom, 10)
                        HStack(alignment: .top, spacing: 7) {
                            Text("✦").foregroundStyle(SeriesPalette.color(for: "shakhsiat"))
                            // كما على الويب: النص كما يصل، والافتراضي نص الويب نفسه.
                            Text(item.reason.flatMap { $0.isEmpty ? nil : $0 } ?? "ظهر لك لأنه يلتقي مع اهتماماتك المختارة.")
                                .multilineTextAlignment(.leading)
                        }
                        .font(ElmFonts.text(.caption2))
                        .foregroundStyle(ElmTheme.ink3)
                    }
                    .padding(.top, 10)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(14)
            }
            .background(ElmTheme.surface)
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(ElmTheme.line, lineWidth: 1))
            .shadow(color: .black.opacity(0.06), radius: 16, y: 6)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(item.story.title)
    }

    private func reasonCard(_ item: ForYouItem) -> some View {
        NavigationLink {
            StoryDestination(seed: item.story)
        } label: {
            VStack(alignment: .leading, spacing: 0) {
                Text(kicker(item.story))
                    .font(ElmFonts.text(.caption2, weight: .bold))
                    .foregroundStyle(item.story.series.map(SeriesPalette.color(for:)) ?? ElmTheme.accent)
                Text(item.story.title)
                    .font(ElmFonts.display(.subheadline, weight: .bold))
                    .foregroundStyle(ElmTheme.ink)
                    .multilineTextAlignment(.leading)
                    .padding(.top, 5)
                Text("لماذا ظهر لك؟ \(item.reason.flatMap { $0.isEmpty ? nil : $0 } ?? "لأنه قريب من اهتماماتك أو من اختيارات المحررين.")")
                    .font(ElmFonts.text(.caption2))
                    .foregroundStyle(ElmTheme.ink3)
                    .multilineTextAlignment(.leading)
                    .padding(.top, 7)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(13)
            .elmCard(radius: 16, elevated: false)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(item.story.title)
    }

    private var guestBanner: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("انضم ليظهر العلم حسب قراءتك")
                .font(ElmFonts.display(.subheadline, weight: .heavy))
                .foregroundStyle(ElmTheme.ink)
            Text("«لك أنت» للأعضاء. الاهتمامات التي تختارها هنا تُقترح عليك عند إنشاء الحساب، وتُحفظ في حسابك بعد تأكيدها.")
                .font(ElmFonts.text(.footnote))
                .foregroundStyle(ElmTheme.ink2)
                .lineSpacing(3)
            Button {
                member.authInitialMode = .signUp
                member.authPresented = true
            } label: {
                Text("إنشاء حساب مجاني")
                    .font(ElmFonts.text(.subheadline, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(ElmTheme.navyDeep, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            .buttonStyle(.plain)
            Button {
                member.authInitialMode = .signIn
                member.authPresented = true
            } label: {
                Text("لدي حساب")
                    .font(ElmFonts.text(.footnote, weight: .semibold))
                    .foregroundStyle(ElmTheme.navyInk)
                    .frame(maxWidth: .infinity, minHeight: 40)
            }
            .buttonStyle(.plain)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .elmCard(radius: 16)
    }

    private func kicker(_ story: StoryCard) -> String {
        let series = story.series.flatMap { slug in SeriesPalette.active.first { $0.id == slug }?.name }
        let section = ElmFormat.sectionName(story.section)
        if let series { return "\(series) · \(section)" }
        return story.eyebrow.isEmpty ? section : story.eyebrow
    }

    /// الويب: `صباح المعرفة، {الاسم}` دائمًا بلا تحية بحسب الساعة.
    private var greeting: String {
        guard member.isSignedIn else { return "صباح المعرفة" }
        return "صباح المعرفة، \(member.firstName)"
    }
}

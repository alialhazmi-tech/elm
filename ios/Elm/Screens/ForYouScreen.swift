import SwiftUI

@MainActor
@Observable
final class ForYouStore {
    var items: [ForYouItem] = []
    var signedIn = false
    var loading = false
    var guest = false

    func load(interests: InterestStore, personalization: Bool) async {
        if items.isEmpty { loading = true }
        defer { loading = false }

        do {
            let payload = try await APIClient.fetchForYou()
            items = payload.items
            signedIn = true
            guest = false
            ImageStore.shared.prefetch(items.compactMap(\.story.imageURL))
        } catch {
            signedIn = false
            guest = true
            await hydrateHomeIfNeeded()
            items = Self.guestFeed(interests: interests, personalization: personalization)
            ImageStore.shared.prefetch(items.compactMap(\.story.imageURL))
        }
    }

    private func hydrateHomeIfNeeded() async {
        guard HomeCorpus.cards().isEmpty else { return }
        if let (_, data) = try? await APIClient.fetchHome() {
            HomeCache.save(data)
        }
    }

    static func guestFeed(interests: InterestStore, personalization: Bool) -> [ForYouItem] {
        let cards = HomeCorpus.cards()
        guard !cards.isEmpty else { return [] }

        let catalog = personalization ? interests.items : []
        if catalog.isEmpty {
            return cards.prefix(9).map { ForYouItem(story: $0, reason: "من اختيارات المحررين") }
        }

        return cards
            .map { card -> ForYouItem in
                let hay = ArabicNormalize.fold("\(card.title) \(card.excerpt) \(card.section) \(card.eyebrow)")
                let match = catalog.first { item in
                    item.contentKeys.contains { hay.contains(ArabicNormalize.fold($0)) }
                }
                return ForYouItem(
                    story: card,
                    reason: match.map { "لأنك تتابع «\($0.label)»" } ?? "من اختيارات المحررين"
                )
            }
            .sorted { lhs, rhs in
                let l = lhs.reason?.hasPrefix("لأنك") == true ? 0 : 1
                let r = rhs.reason?.hasPrefix("لأنك") == true ? 0 : 1
                return l < r
            }
            .prefix(9)
            .map { $0 }
    }
}

/// 1f — لك أنت: سلسلة القراءة، وسطر «لماذا ظهر لك؟» تحت كل مادة.
struct ForYouScreen: View {
    @Environment(InterestStore.self) private var interests
    @Environment(AppearanceStore.self) private var appearance
    @Environment(MemberSessionStore.self) private var member
    @Environment(ReadingStore.self) private var reading
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

                streakCard.padding(.top, 14)

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

                if store.guest && !member.isSignedIn {
                    guestBanner.padding(.top, 14)
                }

                if store.loading && store.items.isEmpty {
                    ProgressView()
                        .tint(ElmTheme.navy)
                        .frame(maxWidth: .infinity)
                        .padding(.top, 40)
                } else if store.items.isEmpty {
                    Text("لا مواد بعد. تصفّح الرئيسية أو حدّد اهتماماتك.")
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
            .padding(.horizontal, 18)
            .padding(.top, 16)
        }
        .task { await refresh() }
    }

    private func refresh() async {
        await store.load(interests: interests, personalization: appearance.personalizationEnabled)
    }

    // MARK: سلسلة القراءة

    private var streakCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 10) {
                Text("سلسلة القراءة")
                    .font(ElmFonts.display(.subheadline, weight: .heavy))
                    .foregroundStyle(ElmTheme.ink)
                Spacer(minLength: 0)
                Text(ElmFormat.dayLabel(reading.streak))
                    .font(ElmFonts.display(.title3, weight: .heavy))
                    .foregroundStyle(ElmTheme.teal)
            }

            HStack(spacing: 6) {
                ForEach(Array(reading.week().enumerated()), id: \.offset) { _, day in
                    VStack(spacing: 6) {
                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                            .fill(day.read ? ElmTheme.teal : ElmTheme.surface2)
                            .frame(height: 30)
                        Text(day.label)
                            .font(ElmFonts.text(.caption2, weight: .medium))
                            .foregroundStyle(ElmTheme.ink3)
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            .padding(.top, 11)
            .accessibilityElement(children: .combine)
            .accessibilityLabel("أسبوع القراءة")

            Text(streakNote)
                .font(ElmFonts.text(.caption2))
                .foregroundStyle(ElmTheme.ink3)
                .lineSpacing(2)
                .padding(.top, 10)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .elmCard(radius: 16)
    }

    private var streakNote: String {
        let readDays = reading.week().filter(\.read).count
        if readDays == 0 { return "ابدأ اليوم بمادة واحدة — السلسلة تبدأ من واحد." }
        let remaining = max(0, 5 - readDays)
        if remaining == 0 { return "أكملت هدف الأسبوع. اقرأ لأنك تريد، لا لأن العدّاد يطالبك." }
        return "قرأت \(ElmFormat.latinDigits(String(readDays))) أيام هذا الأسبوع — تبقّت \(ElmFormat.dayLabel(remaining)) لإكمال الهدف."
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

            Button { onboarding.present() } label: {
                Text("اضبط اهتماماتك")
                    .font(ElmFonts.text(.footnote))
                    .foregroundStyle(ElmTheme.ink3)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 5)
                    .overlay(
                        Capsule().stroke(ElmTheme.line2, style: StrokeStyle(lineWidth: 1, dash: [4, 3]))
                    )
            }
            .buttonStyle(.plain)
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
                    if let reason = item.reason, !reason.isEmpty {
                        VStack(alignment: .leading, spacing: 0) {
                            Rectangle()
                                .fill(ElmTheme.line)
                                .frame(height: 1)
                                .padding(.bottom, 10)
                            HStack(spacing: 7) {
                                Text("✦").foregroundStyle(SeriesPalette.color(for: "shakhsiat"))
                                Text("ظهر لك \(reason)")
                            }
                            .font(ElmFonts.text(.caption2))
                            .foregroundStyle(ElmTheme.ink3)
                        }
                        .padding(.top, 10)
                    }
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
                if let reason = item.reason, !reason.isEmpty {
                    Text("لماذا ظهر لك؟ \(reason)")
                        .font(ElmFonts.text(.caption2))
                        .foregroundStyle(ElmTheme.ink3)
                        .multilineTextAlignment(.leading)
                        .padding(.top, 7)
                }
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
            Text("اهتمامات هذا الجهاز تبقى معك حتى قبل إنشاء الحساب.")
                .font(ElmFonts.text(.footnote))
                .foregroundStyle(ElmTheme.ink2)
            Button { member.authPresented = true } label: {
                Text("انضم إلى العلم")
                    .font(ElmFonts.text(.subheadline, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(ElmTheme.navyDeep, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
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

    private var greeting: String {
        let hour = Calendar.current.component(.hour, from: .now)
        let salutation = hour < 12 ? "صباح المعرفة" : (hour < 18 ? "مساء المعرفة" : "مساء هادئ")
        guard member.isSignedIn else { return salutation }
        return "\(salutation)، \(member.firstName)"
    }
}

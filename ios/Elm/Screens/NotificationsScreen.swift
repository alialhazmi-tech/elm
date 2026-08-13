import SwiftUI

/// 1l — الإشعارات: إشعار صباحي واحد افتراضيًا، وما عداه بقرار القارئ.
struct NotificationsScreen: View {
    @Environment(NotificationPrefs.self) private var prefs
    @Environment(ReadingStore.self) private var reading
    @State private var store = HomeStore()

    var body: some View {
        ElmScreen(title: "الإشعارات", showBack: true, onRefresh: { await store.refresh() }) {
            VStack(alignment: .leading, spacing: 0) {
                Text("الإشعارات")
                    .font(ElmFonts.display(.title, weight: .heavy))
                    .foregroundStyle(ElmTheme.ink)
                Text("إشعار واحد في الصباح للموجز، وما عداه بقرارك.")
                    .font(ElmFonts.text(.footnote))
                    .foregroundStyle(ElmTheme.ink2)
                    .lineSpacing(3)
                    .padding(.top, 6)

                if feed.isEmpty {
                    Text("لا إشعارات بعد. حين يصل الموجز أو خبر عاجل ستراه هنا.")
                        .font(ElmFonts.text(.footnote))
                        .foregroundStyle(ElmTheme.ink3)
                        .padding(.top, 18)
                } else {
                    VStack(spacing: 10) {
                        ForEach(feed) { item in
                            row(item)
                        }
                    }
                    .padding(.top, 14)
                }

                prefsBox.padding(.top, 18)
            }
            .padding(.horizontal, 18)
            .padding(.top, 16)
        }
        .task { await store.load() }
    }

    // MARK: التغذية

    private struct NotifItem: Identifiable {
        let id: String
        let glyph: String
        let color: Color
        let title: String
        let time: String
        let body: String
        let highlighted: Bool
        let story: StoryCard?
    }

    /// الإشعارات مشتقة من حزمة الرئيسية الحقيقية — لا قائمة ثابتة مزروعة.
    private var feed: [NotifItem] {
        guard let home = store.payload else { return [] }
        var items: [NotifItem] = []

        if let first = home.brief.first {
            items.append(NotifItem(
                id: "brief",
                glyph: "✦",
                color: ElmTheme.navyDeep,
                title: "موجز العلم",
                time: "7:00",
                body: first.title,
                highlighted: true,
                story: StoryCard(id: first.href, slug: first.href, section: "news",
                                 title: first.title, excerpt: "", eyebrow: first.label, href: first.href)
            ))
        }

        if let breaking = home.breaking {
            items.append(NotifItem(
                id: "breaking",
                glyph: "!",
                color: ElmTheme.danger,
                title: "عاجل",
                time: ElmFormat.relativeTime(home.generatedAt) ?? "الآن",
                body: breaking.title,
                highlighted: false,
                story: StoryCard(id: breaking.href, slug: breaking.href, section: "news",
                                 title: breaking.title, excerpt: "", eyebrow: "عاجل", href: breaking.href)
            ))
        }

        if let fact = home.minis.first(where: { $0.series == "efhamha-sah" }) ?? home.minis.first {
            items.append(NotifItem(
                id: "series-\(fact.apiId)",
                glyph: "✓",
                color: SeriesPalette.color(for: fact.series ?? "efhamha-sah"),
                title: SeriesPalette.active.first { $0.id == fact.series }?.name ?? "جديد في سلاسلك",
                time: ElmFormat.relativeTime(fact.publishedAt) ?? "اليوم",
                body: fact.title,
                highlighted: false,
                story: fact
            ))
        }

        if reading.streak > 0 {
            items.append(NotifItem(
                id: "streak",
                glyph: ElmFormat.latinDigits(String(reading.streak)),
                color: ElmTheme.teal,
                title: "سلسلتك مستمرة",
                time: "اليوم",
                body: "\(ElmFormat.dayLabel(reading.streak)) متتالية من القراءة. مادة واحدة تكمل هدف الأسبوع.",
                highlighted: false,
                story: nil
            ))
        }

        return items
    }

    @ViewBuilder
    private func row(_ item: NotifItem) -> some View {
        let card = HStack(alignment: .top, spacing: 12) {
            Text(item.glyph)
                .font(ElmFonts.text(.subheadline, weight: .bold))
                .foregroundStyle(.white)
                .frame(width: 34, height: 34)
                .background(item.color, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(item.title)
                        .font(ElmFonts.text(.footnote, weight: .bold))
                        .foregroundStyle(ElmTheme.ink)
                    Spacer(minLength: 0)
                    Text(item.time)
                        .font(ElmFonts.text(.caption2))
                        .foregroundStyle(ElmTheme.ink3)
                        .elmLatin()
                }
                Text(item.body)
                    .font(ElmFonts.text(.footnote))
                    .foregroundStyle(ElmTheme.ink2)
                    .multilineTextAlignment(.leading)
                    .lineSpacing(4)
                    .padding(.top, 4)
            }
        }
        .padding(13)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(item.highlighted ? ElmTheme.gold.opacity(0.10) : ElmTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(ElmTheme.line, lineWidth: 1))

        if let story = item.story {
            NavigationLink { StoryDestination(seed: story) } label: { card }
                .buttonStyle(.plain)
                .accessibilityLabel("\(item.title): \(item.body)")
        } else {
            card.accessibilityElement(children: .combine)
        }
    }

    private var prefsBox: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("ما الذي يصلك؟")
                .font(ElmFonts.text(.caption2, weight: .bold))
                .foregroundStyle(ElmTheme.ink3)

            VStack(spacing: 11) {
                ForEach(NotificationPrefs.Kind.allCases) { kind in
                    HStack(spacing: 11) {
                        Text(kind.label)
                            .font(ElmFonts.text(.footnote))
                            .foregroundStyle(ElmTheme.ink)
                        Spacer(minLength: 0)
                        ElmToggle(isOn: prefs.isOn(kind)) { prefs.toggle(kind) }
                            .accessibilityLabel(kind.label)
                    }
                }
            }
            .padding(.top, 9)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .elmCard(radius: 16, elevated: false)
    }
}

import SwiftUI

/// 1l — «آخر المستجدات»: لا إشعارات دفع ولا تفضيلات إشعارات (لا نظير لها على الويب)؛ الشاشة قائمة
/// صادقة بأحدث ما في حزمة الرئيسية — الموجز والعاجل وجديد السلاسل — بأوقات النشر الحقيقية فقط.
struct NotificationsScreen: View {
    @State private var store = HomeStore()

    var body: some View {
        ElmScreen(title: "آخر المستجدات", showBack: true, onRefresh: { await store.refresh() }) {
            VStack(alignment: .leading, spacing: 0) {
                Text("آخر المستجدات")
                    .font(ElmFonts.display(.title, weight: .heavy))
                    .foregroundStyle(ElmTheme.ink)
                    .accessibilityAddTraits(.isHeader)
                Text("أحدث ما نُشر في العلم: الموجز، والعاجل، وجديد السلاسل.")
                    .font(ElmFonts.text(.footnote))
                    .foregroundStyle(ElmTheme.ink2)
                    .lineSpacing(3)
                    .padding(.top, 6)

                if store.loading && store.payload == nil {
                    ProgressView().tint(ElmTheme.navy).frame(maxWidth: .infinity).padding(.top, 40)
                } else if let error = store.errorMessage, store.payload == nil {
                    VStack(alignment: .leading, spacing: 10) {
                        Label(error, systemImage: "wifi.slash").font(ElmFonts.text(.footnote)).foregroundStyle(ElmTheme.ink2)
                        Button("إعادة المحاولة") { Task { await store.refresh() } }.font(ElmFonts.text(.footnote, weight: .semibold)).frame(minHeight: 44)
                    }
                    .padding(.top, 18)
                } else if feed.isEmpty {
                    Text("لا مستجدات بعد. حين يصل الموجز أو خبر عاجل ستراه هنا.")
                        .font(ElmFonts.text(.footnote))
                        .foregroundStyle(ElmTheme.ink3)
                        .padding(.top, 18)
                } else {
                    if store.fromCache {
                        Text("آخر نسخة محفوظة على الجهاز.")
                            .font(ElmFonts.text(.caption2))
                            .foregroundStyle(ElmTheme.ink3)
                            .padding(.top, 8)
                    }
                    VStack(spacing: 10) {
                        ForEach(feed) { item in
                            row(item)
                        }
                    }
                    .padding(.top, 14)
                }
            }
            .padding(.horizontal, 18)
            .padding(.top, 16)
        }
        .task { await store.load() }
    }

    // MARK: التغذية

    private struct FeedItem: Identifiable {
        let id: String
        let glyph: String
        let color: Color
        let title: String
        /// وقت النشر النسبي من `publishedAt`؛ فارغ حين لا يرسله الخادم (العاجل).
        let time: String
        let body: String
        let highlighted: Bool
        let story: StoryCard
    }

    /// مشتقة من حزمة الرئيسية الحقيقية — لا أوقات ثابتة ولا عناصر مزروعة.
    private var feed: [FeedItem] {
        guard let home = store.payload else { return [] }
        var items: [FeedItem] = []

        if let breaking = home.breaking {
            items.append(FeedItem(
                id: "breaking",
                glyph: "!",
                color: ElmTheme.danger,
                title: "عاجل",
                time: "",
                body: breaking.title,
                highlighted: true,
                story: StoryCard(id: breaking.href, slug: breaking.href, section: "news",
                                 title: breaking.title, excerpt: "", eyebrow: "عاجل", href: breaking.href)
            ))
        }

        for brief in home.brief.prefix(3) {
            items.append(FeedItem(
                id: "brief-\(brief.href)",
                glyph: "✦",
                color: ElmTheme.navyDeep,
                title: "موجز العلم" + (brief.label.isEmpty ? "" : " · \(brief.label)"),
                time: ElmFormat.relativeTime(brief.publishedAt) ?? "",
                body: brief.title,
                highlighted: false,
                story: StoryCard(id: brief.href, slug: brief.href, section: "news",
                                 title: brief.title, excerpt: brief.excerpt ?? "", eyebrow: brief.label,
                                 publishedAt: brief.publishedAt, href: brief.href)
            ))
        }

        // لا نكرر ما ورد في الموجز أو العاجل.
        let listed = Set(home.brief.map(\.title) + [home.breaking?.title].compactMap { $0 })
        let seriesLatest = (home.minis + home.mosaic)
            .filter { $0.series != nil && !listed.contains($0.title) }
            .sorted { ($0.publishedAt ?? "") > ($1.publishedAt ?? "") }
            .prefix(3)
        for card in seriesLatest {
            let series = card.series ?? ""
            items.append(FeedItem(
                id: "series-\(card.apiId)",
                glyph: "✓",
                color: SeriesPalette.color(for: series),
                title: SeriesPalette.active.first { $0.id == series }?.name ?? "جديد في السلاسل",
                time: ElmFormat.relativeTime(card.publishedAt) ?? "",
                body: card.title,
                highlighted: false,
                story: card
            ))
        }

        return items
    }

    private func row(_ item: FeedItem) -> some View {
        NavigationLink { StoryDestination(seed: item.story) } label: {
            HStack(alignment: .top, spacing: 12) {
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
                        if !item.time.isEmpty {
                            Text(item.time)
                                .font(ElmFonts.text(.caption2))
                                .foregroundStyle(ElmTheme.ink3)
                                .elmLatin()
                        }
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
            .background(item.highlighted ? ElmTheme.danger.opacity(0.06) : ElmTheme.surface)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(ElmTheme.line, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(item.time.isEmpty ? "\(item.title): \(item.body)" : "\(item.title)، \(item.time): \(item.body)")
    }
}

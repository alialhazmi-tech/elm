import SwiftUI

@MainActor
@Observable
final class SeriesIndexStore {
    var active: [SeriesEntry] = []
    var archived: [SeriesEntry] = []
    var loading = false
    var errorMessage: String?

    func load() async {
        if active.isEmpty { loading = true }
        errorMessage = nil
        do {
            let payload = try await APIClient.fetchSeriesIndex()
            active = payload.series
            archived = payload.archived
        } catch {
            if active.isEmpty {
                active = SeriesPalette.active.map { item in
                    SeriesEntry(
                        slug: item.id,
                        name: item.name,
                        description: SeriesPalette.blurb(for: item.id),
                        color: item.colorHex,
                        archived: false,
                        count: 0,
                        latest: nil
                    )
                }
                errorMessage = "يُعرض الدليل المحلي — التغذية الكاملة بعد وصول العقد."
            }
        }
        loading = false
    }
}

/// 1d — السلاسل الثماني: الطيف كاملًا، والأرشيف المتقاعد ظاهر لا محذوف.
struct SeriesScreen: View {
    @State private var store = SeriesIndexStore()
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        ElmScreen(title: "السلاسل", onRefresh: { await store.load() }) {
            VStack(alignment: .leading, spacing: 0) {
                Text("السلاسل الثماني")
                    .font(ElmFonts.display(.title, weight: .heavy))
                    .foregroundStyle(ElmTheme.ink)
                Text("العلم يستقبل الخبر ويخرجه طيفًا: لكل سلسلة زاوية، ولكل زاوية لون.")
                    .font(ElmFonts.text(.footnote))
                    .foregroundStyle(ElmTheme.ink2)
                    .lineSpacing(4)
                    .padding(.top, 6)

                SpectrumBar().padding(.top, 14)

                if let error = store.errorMessage {
                    Text(error)
                        .font(ElmFonts.text(.caption2))
                        .foregroundStyle(ElmTheme.ink3)
                        .padding(.top, 10)
                }

                LazyVGrid(columns: columns, spacing: 10) {
                    ForEach(Array(store.active.enumerated()), id: \.element.id) { index, entry in
                        card(entry, number: index + 1)
                    }
                }
                .padding(.top, 16)

                if !store.archived.isEmpty {
                    archiveBox.padding(.top, 18)
                }
            }
            .padding(.horizontal, 18)
            .padding(.top, 16)
        }
        .task { await store.load() }
        .overlay {
            if store.loading && store.active.isEmpty {
                ProgressView().tint(ElmTheme.navy)
            }
        }
    }

    private var columns: [GridItem] {
        dynamicTypeSize.isAccessibilitySize
            ? [GridItem(.flexible(), spacing: 10)]
            : [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)]
    }

    private func card(_ entry: SeriesEntry, number: Int) -> some View {
        let color = ElmTheme.hex(entry.color)
        return NavigationLink {
            SeriesFeedScreen(chip: entry.asChip)
        } label: {
            VStack(alignment: .leading, spacing: 0) {
                Text(ElmFormat.twoDigit(number))
                    .font(ElmFonts.display(.footnote, weight: .heavy))
                    .foregroundStyle(color)
                    .elmLatin()
                Text(entry.name)
                    .font(ElmFonts.display(.headline, weight: .heavy))
                    .foregroundStyle(ElmTheme.ink)
                    .padding(.top, 3)
                Text(entry.description.isEmpty ? SeriesPalette.blurb(for: entry.slug) : entry.description)
                    .font(ElmFonts.text(.caption2))
                    .foregroundStyle(ElmTheme.ink3)
                    .multilineTextAlignment(.leading)
                    .lineSpacing(2)
                    .padding(.top, 4)
                Spacer(minLength: 6)
                Text(entry.count > 0 ? ElmFormat.materialLabel(entry.count) : "تصفّح السلسلة")
                    .font(ElmFonts.text(.caption2))
                    .foregroundStyle(ElmTheme.ink3)
                    .padding(.top, 9)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .frame(minHeight: dynamicTypeSize.isAccessibilitySize ? 0 : 132, alignment: .topLeading)
            .padding(14)
            .background(ElmTheme.surface)
            .overlay(alignment: .top) {
                Rectangle().fill(color).frame(height: 3)
            }
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(ElmTheme.line, lineWidth: 1))
            .shadow(color: .black.opacity(0.05), radius: 12, y: 4)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(entry.name)، \(entry.description)")
    }

    private var archiveBox: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("أرشيف حي")
                .font(ElmFonts.text(.caption2, weight: .bold))
                .foregroundStyle(ElmTheme.ink3)
            Text("سلاسل متقاعدة صفحاتها تعمل ومَوادها محفوظة، خارج حزام الاستكشاف.")
                .font(ElmFonts.text(.footnote))
                .foregroundStyle(ElmTheme.ink2)
                .lineSpacing(3)
                .padding(.top, 5)

            ElmFlow(spacing: 7) {
                ForEach(store.archived) { entry in
                    NavigationLink {
                        SeriesFeedScreen(chip: entry.asChip)
                    } label: {
                        Text(entry.name)
                            .font(ElmFonts.text(.footnote))
                            .foregroundStyle(ElmTheme.ink2)
                            .padding(.horizontal, 11)
                            .padding(.vertical, 5)
                            .background(ElmTheme.surface, in: Capsule())
                            .overlay(Capsule().stroke(ElmTheme.line, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.top, 10)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(ElmTheme.surface2, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(ElmTheme.line, lineWidth: 1))
    }
}

/// 1d↩ — تغذية سلسلة واحدة.
struct SeriesFeedScreen: View {
    let chip: SeriesChip
    @State private var feed: SeriesFeedPayload?
    @State private var loading = false
    @State private var errorMessage: String?

    private var header: SeriesEntry {
        feed?.series ?? SeriesEntry(
            slug: chip.slug, name: chip.name,
            description: chip.description.isEmpty ? SeriesPalette.blurb(for: chip.slug) : chip.description,
            color: chip.color, archived: false, count: 0, latest: nil
        )
    }

    var body: some View {
        ElmScreen(title: chip.name, showBack: true, onRefresh: { await load() }) {
            VStack(alignment: .leading, spacing: 14) {
                VStack(alignment: .leading, spacing: 7) {
                    Text(header.archived ? "من أرشيف العلم — اكتملت رسالتها" : "سلسلة معرفية")
                        .font(ElmFonts.text(.caption2, weight: .bold))
                        .foregroundStyle(ElmTheme.hex(header.color))
                    Text(header.name)
                        .font(ElmFonts.display(.title, weight: .heavy))
                        .foregroundStyle(ElmTheme.ink)
                    Text(header.description)
                        .font(ElmFonts.text(.footnote))
                        .foregroundStyle(ElmTheme.ink2)
                        .lineSpacing(3)
                    Text(countLabel)
                        .font(ElmFonts.text(.caption2, weight: .medium))
                        .foregroundStyle(ElmTheme.ink3)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(16)
                .background(ElmTheme.hex(header.color).opacity(0.12))
                .overlay(alignment: .top) {
                    Rectangle().fill(ElmTheme.hex(header.color)).frame(height: 3)
                }
                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))

                if let errorMessage {
                    Text(errorMessage)
                        .font(ElmFonts.text(.footnote))
                        .foregroundStyle(ElmTheme.ink2)
                }

                if let stories = feed?.stories, !stories.isEmpty {
                    LazyVStack(spacing: 12) {
                        ForEach(Array(stories.enumerated()), id: \.element.id) { index, story in
                            if index == 0 {
                                StoryTile(story: story, tall: true)
                            } else {
                                MiniStoryRow(story: story)
                            }
                        }
                    }
                } else if !loading {
                    Text("مواد هذه السلسلة في الطريق.")
                        .font(ElmFonts.text(.callout))
                        .foregroundStyle(ElmTheme.ink2)
                        .padding(.vertical, 24)
                }
            }
            .padding(.horizontal, 18)
            .padding(.top, 16)
        }
        .task { await load() }
        .overlay {
            if loading && feed == nil { ProgressView().tint(ElmTheme.navy) }
        }
    }

    private var countLabel: String {
        let total = feed?.total ?? header.count
        return total == 0 ? "لا مواد منشورة بعد" : "\(ElmFormat.materialLabel(total)) منشورة"
    }

    private func load() async {
        loading = true
        defer { loading = false }
        do {
            feed = try await APIClient.fetchSeriesFeed(slug: chip.slug)
            ImageStore.shared.prefetch((feed?.stories ?? []).compactMap(\.imageURL))
        } catch {
            errorMessage = "تعذر تحميل تغذية السلسلة."
        }
    }
}

extension SeriesPalette {
    /// وصف كل سلسلة كما في `lib/content/series.ts` — احتياطي حين لا يرسله الخادم.
    static func blurb(for slug: String) -> String {
        switch slug {
        case "absat": "شرح متدرج للمعقد"
        case "aghrab": "ما لا تتوقعه"
        case "efhamha-sah": "الحقيقة ضد الشائعة"
        case "bel-arqam": "البيانات تحكي"
        case "shakhsiat": "سِيَر صنعت أثرًا"
        case "limatha": "الأسباب خلف الظواهر"
        case "matha-law": "سيناريوهات واحتمالات"
        case "bel-tarikh": "الزمن يعطي السياق"
        default: ""
        }
    }
}

/// تخطيط يلفّ العناصر إلى سطر جديد — لشرائح الأرشيف والاهتمامات.
struct ElmFlow: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? .infinity
        var x: CGFloat = 0, y: CGFloat = 0, lineHeight: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x + size.width > width, x > 0 {
                x = 0
                y += lineHeight + spacing
                lineHeight = 0
            }
            x += size.width + spacing
            lineHeight = max(lineHeight, size.height)
        }
        return CGSize(width: width == .infinity ? x : width, height: y + lineHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x: CGFloat = 0, y: CGFloat = 0, lineHeight: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x + size.width > bounds.width, x > 0 {
                x = 0
                y += lineHeight + spacing
                lineHeight = 0
            }
            // التخطيطات المخصّصة لا ترث اتجاه القراءة — نضع من اليمين يدويًا.
            view.place(
                at: CGPoint(x: bounds.maxX - x - size.width, y: bounds.minY + y),
                proposal: ProposedViewSize(size)
            )
            x += size.width + spacing
            lineHeight = max(lineHeight, size.height)
        }
    }
}

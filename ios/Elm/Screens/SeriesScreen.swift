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
                        description: "",
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

/// 1b — دليل السلاسل الثماني.
struct SeriesScreen: View {
    @State private var store = SeriesIndexStore()
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("سلاسل العلم")
                        .font(ElmFonts.text(.caption, weight: .bold))
                        .foregroundStyle(ElmTheme.ink2)
                    Text("اختر زاوية الفهم")
                        .font(ElmFonts.display(.title2, weight: .heavy))
                        .foregroundStyle(ElmTheme.ink)
                    Text("لا نكتفي بتصنيف ما يحدث. نختار لكل قصة الطريقة الأنسب لفهمها.")
                        .font(ElmFonts.text(.body))
                        .foregroundStyle(ElmTheme.ink2)
                }

                if let error = store.errorMessage {
                    Text(error)
                        .font(ElmFonts.text(.caption))
                        .foregroundStyle(ElmTheme.ink2)
                }

                LazyVGrid(columns: seriesColumns, spacing: 10) {
                    ForEach(Array(store.active.enumerated()), id: \.element.id) { index, entry in
                        seriesCard(entry, index: index)
                    }
                }

                if !store.archived.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("من أرشيف العلم")
                            .font(ElmFonts.display(.title3, weight: .heavy))
                            .foregroundStyle(ElmTheme.ink)
                        Text("سلاسل اكتملت رسالتها — موادها باقية بروابطها.")
                            .font(ElmFonts.text(.footnote))
                            .foregroundStyle(ElmTheme.ink2)
                    }
                    .padding(.top, 8)
                    ForEach(store.archived) { entry in
                        NavigationLink {
                            SeriesFeedScreen(chip: entry.asChip)
                        } label: {
                            HStack {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(entry.name)
                                        .font(ElmFonts.display(.headline, weight: .bold))
                                        .foregroundStyle(ElmTheme.ink)
                                    Text("\(ElmFormat.latinDigits(String(entry.count))) مادة · أرشيف")
                                        .font(ElmFonts.text(.caption))
                                        .foregroundStyle(ElmTheme.ink2)
                                }
                                Spacer()
                            }
                            .padding(14)
                            .background(ElmTheme.hex(entry.color).opacity(0.12))
                            .clipShape(RoundedRectangle(cornerRadius: ElmTheme.radiusSm, style: .continuous))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .padding(14)
        }
        .background(ElmTheme.bg.ignoresSafeArea())
        .navigationTitle("السلاسل")
        .navigationBarTitleDisplayMode(.inline)
        .task { await store.load() }
        .refreshable { await store.load() }
        .overlay {
            if store.loading && store.active.isEmpty {
                ProgressView().tint(ElmTheme.navy)
            }
        }
    }

    private var seriesColumns: [GridItem] {
        [GridItem(.adaptive(minimum: dynamicTypeSize.isAccessibilitySize ? 260 : 155), spacing: 10)]
    }

    private func seriesCard(_ entry: SeriesEntry, index: Int) -> some View {
        NavigationLink {
            SeriesFeedScreen(chip: entry.asChip)
        } label: {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text(ElmFormat.twoDigit(index + 1))
                        .font(ElmFonts.text(.caption, weight: .bold))
                        .foregroundStyle(ElmTheme.ink2)
                        .environment(\.layoutDirection, .leftToRight)
                    Spacer()
                    Circle().fill(ElmTheme.hex(entry.color)).frame(width: 9, height: 9)
                }
                Text(entry.name)
                    .font(ElmFonts.display(.title3, weight: .heavy))
                    .foregroundStyle(ElmTheme.ink)
                Text(entry.description)
                    .font(ElmFonts.text(.caption))
                    .foregroundStyle(ElmTheme.ink2)
                    .lineLimit(3)
                Spacer(minLength: 2)
                HStack {
                    Text(ElmFormat.materialLabel(entry.count))
                    Spacer()
                    Image(systemName: "arrow.left")
                }
                .font(ElmFonts.text(.caption, weight: .bold))
                .foregroundStyle(ElmTheme.hex(entry.color))
            }
            .padding(14)
            .frame(maxWidth: .infinity, minHeight: dynamicTypeSize.isAccessibilitySize ? 0 : 174, alignment: .leading)
            .background(ElmTheme.surface)
            .overlay(alignment: .top) {
                Rectangle()
                    .fill(ElmTheme.hex(entry.color))
                    .frame(height: 4)
            }
            .clipShape(RoundedRectangle(cornerRadius: ElmTheme.radiusMd, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: ElmTheme.radiusMd, style: .continuous)
                    .stroke(ElmTheme.line, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(entry.name)، \(entry.description)")
    }
}

/// 1c — تغذية سلسلة.
struct SeriesFeedScreen: View {
    let chip: SeriesChip
    @State private var feed: SeriesFeedPayload?
    @State private var loading = false
    @State private var errorMessage: String?

    private var header: SeriesEntry {
        feed?.series ?? SeriesEntry(
            slug: chip.slug,
            name: chip.name,
            description: chip.description,
            color: chip.color,
            archived: false,
            count: 0,
            latest: nil
        )
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 8) {
                    Text(header.archived ? "من أرشيف العلم — اكتملت رسالتها" : "سلسلة معرفية")
                        .font(ElmFonts.text(.caption, weight: .bold))
                        .foregroundStyle(ElmTheme.hex(header.color))
                    Text(header.name)
                        .font(ElmFonts.display(.largeTitle, weight: .heavy))
                        .foregroundStyle(ElmTheme.ink)
                    Text(header.description)
                        .font(ElmFonts.text(.body))
                        .foregroundStyle(ElmTheme.ink2)
                    Text(countLabel)
                        .font(ElmFonts.text(.footnote, weight: .medium))
                        .foregroundStyle(ElmTheme.ink2)
                }
                .padding(18)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(ElmTheme.hex(header.color).opacity(0.12))
                .overlay(alignment: .bottom) {
                    Rectangle().fill(ElmTheme.hex(header.color)).frame(height: 4)
                }
                .clipShape(RoundedRectangle(cornerRadius: ElmTheme.radiusLg, style: .continuous))

                if let errorMessage {
                    Text(errorMessage)
                        .font(ElmFonts.text(.footnote))
                        .foregroundStyle(ElmTheme.ink2)
                }

                if let stories = feed?.stories, !stories.isEmpty {
                    LazyVStack(spacing: 12) {
                        ForEach(Array(stories.enumerated()), id: \.element.id) { index, story in
                            if index == 0 {
                                MosaicStoryCard(story: story, tall: true)
                            } else {
                                MiniStoryRow(story: story)
                            }
                        }
                    }
                } else if !loading {
                    Text("مواد هذه السلسلة في الطريق.")
                        .font(ElmFonts.text(.body))
                        .foregroundStyle(ElmTheme.ink2)
                        .padding(.vertical, 24)
                }
            }
            .padding(16)
        }
        .background(ElmTheme.bg.ignoresSafeArea())
        .navigationTitle(chip.name)
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
        .refreshable { await load() }
        .overlay {
            if loading && feed == nil {
                ProgressView().tint(ElmTheme.navy)
            }
        }
    }

    private var countLabel: String {
        let total = feed?.total ?? header.count
        if total == 0 { return "لا مواد منشورة بعد" }
        return "\(ElmFormat.materialLabel(total)) منشورة"
    }

    private func load() async {
        loading = true
        defer { loading = false }
        do {
            feed = try await APIClient.fetchSeriesFeed(slug: chip.slug)
        } catch {
            errorMessage = "تعذر تحميل تغذية السلسلة."
        }
    }
}

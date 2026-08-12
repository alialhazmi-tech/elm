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

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("سلاسل العلم")
                        .font(ElmFonts.text(.caption, weight: .bold))
                        .foregroundStyle(ElmTheme.ink2)
                    Text("ثماني طرق لرؤية الخبر كاملًا.")
                        .font(ElmFonts.display(.title, weight: .heavy))
                        .foregroundStyle(ElmTheme.ink)
                    Text("لا نكتفي بتصنيف ما يحدث. نختار لكل قصة الطريقة الأنسب لفهمها.")
                        .font(ElmFonts.text(.body))
                        .foregroundStyle(ElmTheme.ink2)
                }

                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(ElmFormat.latinDigits(String(max(store.active.count, 8))))
                        .font(ElmFonts.display(.largeTitle, weight: .heavy))
                        .foregroundStyle(ElmTheme.navy)
                        .environment(\.layoutDirection, .leftToRight)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("سلاسل معرفية")
                            .font(ElmFonts.display(.headline, weight: .bold))
                            .foregroundStyle(ElmTheme.ink)
                        Text("هوية واحدة، زوايا متعددة")
                            .font(ElmFonts.text(.caption))
                            .foregroundStyle(ElmTheme.ink2)
                    }
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(ElmTheme.surface)
                .clipShape(RoundedRectangle(cornerRadius: ElmTheme.radiusMd, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: ElmTheme.radiusMd, style: .continuous)
                        .stroke(ElmTheme.line, lineWidth: 1)
                )

                if let error = store.errorMessage {
                    Text(error)
                        .font(ElmFonts.text(.caption))
                        .foregroundStyle(ElmTheme.ink2)
                }

                ForEach(Array(store.active.enumerated()), id: \.element.id) { index, entry in
                    seriesCard(entry, index: index)
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
                        NavigationLink(value: entry.asChip) {
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
            .padding(16)
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

    private func seriesCard(_ entry: SeriesEntry, index: Int) -> some View {
        NavigationLink(value: entry.asChip) {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text(ElmFormat.twoDigit(index + 1))
                        .font(ElmFonts.text(.caption, weight: .bold))
                        .foregroundStyle(ElmTheme.ink2)
                        .environment(\.layoutDirection, .leftToRight)
                    Spacer()
                    Text("\(ElmFormat.latinDigits(String(entry.count))) مادة")
                        .font(ElmFonts.text(.caption, weight: .bold))
                        .foregroundStyle(ElmTheme.hex(entry.color))
                }
                Text(entry.name)
                    .font(ElmFonts.display(.title2, weight: .heavy))
                    .foregroundStyle(ElmTheme.ink)
                Text(entry.description)
                    .font(ElmFonts.text(.footnote))
                    .foregroundStyle(ElmTheme.ink2)
                if let latest = entry.latest {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("أحدث مادة")
                            .font(ElmFonts.text(.caption2, weight: .bold))
                            .foregroundStyle(ElmTheme.ink2)
                        Text(latest.title)
                            .font(ElmFonts.display(.subheadline, weight: .bold))
                            .foregroundStyle(ElmTheme.ink)
                            .lineLimit(2)
                            .multilineTextAlignment(.leading)
                    }
                }
                Text("ادخل السلسلة ←")
                    .font(ElmFonts.text(.subheadline, weight: .bold))
                    .foregroundStyle(ElmTheme.accent)
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
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
                    ForEach(Array(stories.enumerated()), id: \.element.id) { index, story in
                        MosaicStoryCard(story: story, tall: index == 0)
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
        return "\(ElmFormat.latinDigits(String(total))) مادة منشورة"
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

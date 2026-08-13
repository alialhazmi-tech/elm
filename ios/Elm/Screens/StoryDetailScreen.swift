import SwiftUI

/// 1d — المادة كاملة: متن، شائعة/حقيقة، شرائح جاك، ذات صلة.
struct StoryDetailScreen: View {
    let seed: StoryCard
    @Environment(LibraryStore.self) private var library
    @Environment(NarrationStore.self) private var narration
    @Environment(ConnectivityStore.self) private var connectivity
    @State private var detail: StoryDetailPayload?
    @State private var loading = false
    @State private var loadError: String?

    private var story: StoryCard { detail?.story ?? seed }
    private var series: SeriesChip? { detail?.series ?? seed.series.flatMap(chip(for:)) }
    private var factCheck: FactCheck? { detail?.factCheck ?? story.factCheck }
    private var slides: [StorySlide] { detail?.slides ?? [] }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                if let series {
                    NavigationLink {
                        SeriesFeedScreen(chip: series)
                    } label: {
                        SeriesChipLabel(name: series.name, color: ElmTheme.hex(series.color))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("سلسلة \(series.name)")
                }

                VStack(alignment: .leading, spacing: 11) {
                    Text(story.eyebrow.isEmpty ? ElmFormat.sectionName(story.section) : story.eyebrow)
                        .font(ElmFonts.text(.caption, weight: .bold))
                        .foregroundStyle(series.map { ElmTheme.hex($0.color) } ?? ElmTheme.accent)
                    Text(story.title)
                        .font(ElmFonts.display(.title2, weight: .heavy))
                        .foregroundStyle(ElmTheme.ink)
                        .accessibilityAddTraits(.isHeader)
                }

                if !story.excerpt.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("الموجز")
                            .font(ElmFonts.text(.caption, weight: .bold))
                            .foregroundStyle(ElmTheme.ink2)
                        Text(story.excerpt)
                            .font(ElmFonts.text(.body, weight: .medium))
                            .foregroundStyle(ElmTheme.ink)
                            .lineSpacing(5)
                    }
                    .accessibilityElement(children: .combine)
                    .accessibilityLabel("الموجز: \(story.excerpt)")
                }

                HStack(spacing: 8) {
                    Text(ElmFormat.sectionName(story.section))
                    if let date = ElmFormat.brandDate(story.publishedAt) {
                        Text(date)
                    }
                    Text(ElmFormat.readingLabel(story.readingMinutes))
                }
                .font(ElmFonts.text(.caption, weight: .medium))
                .foregroundStyle(ElmTheme.ink2)

                RemoteImage(url: story.imageURL, height: 220)
                    .clipShape(RoundedRectangle(cornerRadius: ElmTheme.radiusMd, style: .continuous))

                readerTools

                if let loadError {
                    Label(loadError, systemImage: connectivity.isOffline ? "wifi.slash" : "exclamationmark.triangle")
                        .font(ElmFonts.text(.footnote, weight: .medium))
                        .foregroundStyle(ElmTheme.ink2)
                        .padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(ElmTheme.surface2)
                        .clipShape(RoundedRectangle(cornerRadius: ElmTheme.radiusSm))
                }

                if !slides.isEmpty {
                    ForEach(slides) { slide in
                        slideCard(slide)
                    }
                } else {
                    ForEach(Array(ElmFormat.bodyParagraphs(story.body ?? "").enumerated()), id: \.offset) { _, para in
                        Text(para)
                            .font(ElmFonts.text(.body))
                            .foregroundStyle(ElmTheme.ink)
                            .lineSpacing(8)
                            .padding(.bottom, 4)
                    }
                }

                if let factCheck {
                    factBlock(factCheck)
                }

                if let series {
                    seriesNote(series)
                }

                if let related = detail?.related, !related.isEmpty {
                    SectionHead(title: "مواد ذات صلة", subtitle: "من السلسلة والقسم")
                    ForEach(related) { item in
                        MosaicStoryCard(story: item)
                    }
                }

                closingCard
            }
            .padding(14)
        }
        .background(ElmTheme.bg.ignoresSafeArea())
        .navigationBarTitleDisplayMode(.inline)
        .navigationTitle(ElmFormat.sectionName(story.section))
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    library.toggle(story)
                } label: {
                    Image(systemName: library.contains(story) ? "bookmark.fill" : "bookmark")
                }
                .accessibilityLabel(library.contains(story) ? "إزالة من المحفوظات" : "حفظ المادة")
            }
        }
        .overlay {
            if loading && detail == nil && (seed.body ?? "").isEmpty {
                ProgressView().tint(ElmTheme.navy)
            }
        }
        .task { await load() }
    }

    private func load() async {
        loading = true
        defer { loading = false }
        loadError = nil
        do {
            let fresh = try await APIClient.fetchStory(id: seed.apiId)
            detail = fresh
            AppCache.saveStory(fresh)
        } catch {
            if let cached = AppCache.loadStory(id: seed.apiId) {
                detail = cached
                loadError = "أنت تقرأ نسخة محفوظة من هذه المادة."
            } else if (seed.body ?? "").isEmpty {
                loadError = "تعذر تحميل متن المادة. جرّب مجددًا عند عودة الاتصال."
            }
        }
    }

    private var readerTools: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 8) { readerToolButtons }
            VStack(spacing: 8) { readerToolButtons }
        }
    }

    @ViewBuilder
    private var readerToolButtons: some View {
            Button {
                let paragraphs = ElmFormat.bodyParagraphs(story.body ?? "")
                if narration.storyId == story.apiId {
                    narration.toggle()
                } else {
                    narration.start(story: story, paragraphs: paragraphs)
                }
            } label: {
                Label(narration.storyId == story.apiId && narration.state == .playing ? "إيقاف مؤقت" : "استمع", systemImage: narration.storyId == story.apiId && narration.state == .playing ? "pause.fill" : "headphones")
            }
            .readerToolStyle()

            Button { library.toggle(story) } label: {
                Label(library.contains(story) ? "محفوظة" : "احفظ", systemImage: library.contains(story) ? "bookmark.fill" : "bookmark")
            }
            .readerToolStyle(active: library.contains(story))

            ShareLink(item: URLConstants.publicURL(path: story.path)) {
                Label("شارك", systemImage: "square.and.arrow.up")
            }
            .readerToolStyle()
            .labelStyle(.titleAndIcon)
    }

    private var closingCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("خرجت بصورة أوضح؟")
                .font(ElmFonts.display(.title3, weight: .heavy))
                .foregroundStyle(.white)
            Text("احفظ المادة للعودة إليها، أو شاركها مع من يهمه السياق لا العنوان فقط.")
                .font(ElmFonts.text(.footnote))
                .foregroundStyle(.white.opacity(0.74))
            HStack {
                Button { library.toggle(story) } label: {
                    Label(library.contains(story) ? "في مكتبتك" : "احفظها", systemImage: library.contains(story) ? "checkmark" : "bookmark")
                }
                ShareLink(item: URLConstants.publicURL(path: story.path)) {
                    Label("شاركها", systemImage: "square.and.arrow.up")
                }
            }
            .font(ElmFonts.text(.subheadline, weight: .bold))
            .foregroundStyle(ElmTheme.navyDeep)
            .buttonStyle(.borderedProminent)
            .tint(.white)
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(ElmTheme.navyDeep)
        .clipShape(RoundedRectangle(cornerRadius: ElmTheme.radiusLg, style: .continuous))
    }

    private func chip(for slug: String) -> SeriesChip? {
        guard let swatch = SeriesPalette.active.first(where: { $0.id == slug }) else { return nil }
        return SeriesChip(slug: swatch.id, name: swatch.name, description: "", color: swatch.colorHex)
    }

    private func factBlock(_ fact: FactCheck) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                Text("✕ الشائعة")
                    .font(ElmFonts.text(.caption, weight: .bold))
                    .foregroundStyle(Color(red: 0.75, green: 0.16, blue: 0.22))
                Text(fact.rumor)
                    .font(ElmFonts.text(.body))
                    .foregroundStyle(ElmTheme.ink)
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(red: 0.75, green: 0.16, blue: 0.22).opacity(0.08))
            .clipShape(RoundedRectangle(cornerRadius: ElmTheme.radiusSm, style: .continuous))

            VStack(alignment: .leading, spacing: 6) {
                Text("✓ الحقيقة")
                    .font(ElmFonts.text(.caption, weight: .bold))
                    .foregroundStyle(ElmTheme.success)
                Text(fact.truth)
                    .font(ElmFonts.text(.body))
                    .foregroundStyle(ElmTheme.ink)
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(ElmTheme.success.opacity(0.10))
            .clipShape(RoundedRectangle(cornerRadius: ElmTheme.radiusSm, style: .continuous))
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("الشائعة: \(fact.rumor). الحقيقة: \(fact.truth)")
    }

    private func seriesNote(_ series: SeriesChip) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("أنت تقرأ ضمن سلسلة")
                .font(ElmFonts.text(.caption, weight: .bold))
                .foregroundStyle(ElmTheme.hex(series.color))
            Text(series.name)
                .font(ElmFonts.display(.title3, weight: .heavy))
                .foregroundStyle(ElmTheme.ink)
            Text(series.description)
                .font(ElmFonts.text(.footnote))
                .foregroundStyle(ElmTheme.ink2)
            NavigationLink {
                SeriesFeedScreen(chip: series)
            } label: {
                Text("تصفح السلسلة كاملة ←")
                    .font(ElmFonts.text(.subheadline, weight: .bold))
                    .foregroundStyle(ElmTheme.accent)
            }
            if let next = detail?.nextInSeries {
                NavigationLink {
                    StoryDetailScreen(seed: next)
                } label: {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("أكمل الفهم")
                            .font(ElmFonts.text(.caption, weight: .bold))
                            .foregroundStyle(ElmTheme.ink2)
                        Text(next.title)
                            .font(ElmFonts.display(.headline, weight: .bold))
                            .foregroundStyle(ElmTheme.ink)
                            .multilineTextAlignment(.leading)
                        Text(ElmFormat.readingLabel(next.readingMinutes))
                            .font(ElmFonts.text(.caption))
                            .foregroundStyle(ElmTheme.ink2)
                    }
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(ElmTheme.surface2)
                    .clipShape(RoundedRectangle(cornerRadius: ElmTheme.radiusSm, style: .continuous))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(ElmTheme.hex(series.color).opacity(0.10))
        .overlay(alignment: .leading) {
            Rectangle()
                .fill(ElmTheme.hex(series.color))
                .frame(width: 4)
        }
        .clipShape(RoundedRectangle(cornerRadius: ElmTheme.radiusMd, style: .continuous))
    }

    private func slideCard(_ slide: StorySlide) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            if let url = slide.imageURL {
                RemoteImage(url: url, height: 180)
                    .clipShape(RoundedRectangle(cornerRadius: ElmTheme.radiusSm, style: .continuous))
            }
            if let stat = slide.stat, !stat.isEmpty {
                Text(ElmFormat.latinDigits(stat))
                    .font(ElmFonts.display(.largeTitle, weight: .heavy))
                    .foregroundStyle(ElmTheme.ink)
                    .environment(\.layoutDirection, .leftToRight)
                if let label = slide.statLabel, !label.isEmpty {
                    Text(label)
                        .font(ElmFonts.text(.footnote, weight: .medium))
                        .foregroundStyle(ElmTheme.ink2)
                }
            }
            if !slide.title.isEmpty {
                Text(slide.title)
                    .font(ElmFonts.display(.title3, weight: .bold))
                    .foregroundStyle(ElmTheme.ink)
            }
            if !slide.body.isEmpty {
                Text(ElmFormat.latinDigits(slide.body))
                    .font(ElmFonts.text(.body))
                    .foregroundStyle(ElmTheme.ink)
                    .lineSpacing(6)
            }
        }
        .padding(.bottom, 8)
        .accessibilityElement(children: .combine)
    }
}

private extension View {
    func readerToolStyle(active: Bool = false) -> some View {
        self
            .font(ElmFonts.text(.caption, weight: .bold))
            .foregroundStyle(active ? Color.white : ElmTheme.ink)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 11)
            .background(active ? ElmTheme.navy : ElmTheme.surface)
            .clipShape(RoundedRectangle(cornerRadius: ElmTheme.radiusSm, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: ElmTheme.radiusSm).stroke(active ? Color.clear : ElmTheme.line))
    }
}

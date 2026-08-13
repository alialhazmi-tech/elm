import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

/// 1b — قارئ المادة: مؤشر تقدّم بطيف السلاسل، الشائعة/الحقيقة قبل المتن،
/// استفتاء الختام، وشريط أدوات القراءة.
struct StoryDetailScreen: View {
    let seed: StoryCard

    @Environment(LibraryStore.self) private var library
    @Environment(NarrationStore.self) private var narration
    @Environment(PollStore.self) private var polls
    @Environment(ReadingStore.self) private var reading

    @State private var detail: StoryDetailPayload?
    @State private var loading = false
    @State private var loadError: String?
    @State private var progress: Double = 0
    @State private var reportPresented = false

    private var story: StoryCard { detail?.story ?? seed }
    private var series: SeriesChip? { detail?.series ?? seed.series.flatMap(Self.chip(for:)) }
    private var factCheck: FactCheck? { detail?.factCheck ?? story.factCheck }
    private var slides: [StorySlide] { detail?.slides ?? [] }
    private var accent: Color { series.map { ElmTheme.hex($0.color) } ?? ElmTheme.accent }

    var body: some View {
        ElmScreen(
            title: series?.name ?? ElmFormat.sectionName(story.section),
            showBack: true,
            progress: progress
        ) {
            VStack(alignment: .leading, spacing: 0) {
                RemoteImage(url: story.imageURL, height: 236)

                VStack(alignment: .leading, spacing: 0) {
                    // الكبسولة حاضرة دائمًا: باسم السلسلة إن وُجدت، وإلا بالقسم —
                    // المادة بلا سلسلة كانت تفتح بلا أي تصنيف فوق العنوان.
                    if let series {
                        NavigationLink { SeriesFeedScreen(chip: series) } label: {
                            SeriesChipLabel(name: series.name, color: accent, onDark: true)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("سلسلة \(series.name)")
                    } else {
                        SeriesChipLabel(
                            name: story.eyebrow.isEmpty ? ElmFormat.sectionName(story.section) : story.eyebrow,
                            color: accent,
                            onDark: true
                        )
                    }

                    Text(story.title)
                        .font(ElmFonts.display(.title, weight: .heavy))
                        .foregroundStyle(ElmTheme.ink)
                        .multilineTextAlignment(.leading)
                        .padding(.top, 12)
                        .accessibilityAddTraits(.isHeader)

                    metaLine.padding(.top, 11)

                    // الموجز والعاجل يصنعان بطاقة بلا حقل الشكل، فقد تصل المادة هنا
                    // وهي تقرير — وهذا مدخله الغامر.
                    if !slides.isEmpty {
                        Button { reportPresented = true } label: {
                            HStack(spacing: 9) {
                                Image(systemName: "rectangle.stack.fill")
                                    .font(.system(size: 13, weight: .semibold))
                                Text("شاهد التقرير كقصص")
                                    .font(ElmFonts.text(.footnote, weight: .bold))
                                Spacer(minLength: 0)
                                Text("\(ElmFormat.latinDigits(String(slides.count))) صفحة")
                                    .font(ElmFonts.text(.caption2))
                                    .opacity(0.75)
                                Image(systemName: "arrow.left").font(.system(size: 11, weight: .bold))
                            }
                            .foregroundStyle(.white)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 12)
                            .background(ElmTheme.navyDeep, in: RoundedRectangle(cornerRadius: 13, style: .continuous))
                        }
                        .buttonStyle(.plain)
                        .padding(.top, 16)
                    }

                    if let factCheck {
                        factBlock(factCheck).padding(.top, 18)
                    }

                    if let loadError {
                        Label(loadError, systemImage: "arrow.down.circle")
                            .font(ElmFonts.text(.footnote, weight: .medium))
                            .foregroundStyle(ElmTheme.ink2)
                            .padding(12)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(ElmTheme.surface2, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                            .padding(.top, 16)
                    }

                    body(of: story).padding(.top, 18)

                    readerTools.padding(.top, 22)

                    ClosingPoll(storyId: story.apiId, accent: accent).padding(.top, 22)

                    if let related = detail?.related, !related.isEmpty {
                        readAlso(related).padding(.top, 22)
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 18)
            }
            .reportsScroll()
        }
        .overlay {
            if loading && detail == nil && (seed.body ?? "").isEmpty {
                ProgressView().tint(ElmTheme.navy)
            }
        }
        .onPreferenceChange(ElmScrollKey.self) { metrics in
            let scrollable = max(1, metrics.contentHeight - UIScreen.main.bounds.height * 0.78)
            progress = max(0, min(1, Double(metrics.offset / scrollable)))
        }
        .task {
            reading.markRead()
            await load()
        }
        .fullScreenCover(isPresented: $reportPresented) {
            JakReportScreen(seed: story).elmRTL()
        }
    }

    // MARK: أجزاء

    private var metaLine: some View {
        HStack(spacing: 8) {
            Text(ElmFormat.sectionName(story.section))
            Text("·")
            Text(ElmFormat.readingLabel(story.readingMinutes))
            Text("·")
            Text("تحرير العلم")
            Spacer(minLength: 0)
        }
        .font(ElmFonts.text(.caption2))
        .foregroundStyle(ElmTheme.ink3)
        .lineLimit(1)
        .minimumScaleFactor(0.8)
    }

    @ViewBuilder
    private func body(of story: StoryCard) -> some View {
        if !slides.isEmpty {
            VStack(alignment: .leading, spacing: 16) {
                ForEach(slides) { slide in slideCard(slide) }
            }
        } else {
            let paragraphs = ElmFormat.bodyParagraphs(story.body ?? "")
            if paragraphs.isEmpty {
                Text(story.excerpt.isEmpty ? "متن هذه المادة غير متاح الآن." : story.excerpt)
                    .font(ElmFonts.text(.callout))
                    .foregroundStyle(ElmTheme.ink)
                    .lineSpacing(8)
            } else {
                VStack(alignment: .leading, spacing: 14) {
                    ForEach(Array(paragraphs.enumerated()), id: \.offset) { index, para in
                        // الفقرة القصيرة بعد الثالثة تُعامل كاقتباس: حدّ ذهبي على جهة القراءة.
                        if index > 2 && para.count < 110 && !para.hasSuffix(":") {
                            Text(para)
                                .font(ElmFonts.display(.callout, weight: .medium))
                                .foregroundStyle(ElmTheme.ink)
                                .lineSpacing(6)
                                .padding(.leading, 14)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .overlay(alignment: .leading) {
                                    RoundedRectangle(cornerRadius: 2)
                                        .fill(ElmTheme.hex("eda313"))
                                        .frame(width: 3)
                                }
                        } else {
                            Text(para)
                                .font(ElmFonts.text(.callout))
                                .foregroundStyle(ElmTheme.ink)
                                .lineSpacing(8)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                }
            }
        }
    }

    private func factBlock(_ fact: FactCheck) -> some View {
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 5) {
                Text("الشائعة")
                    .font(ElmFonts.text(.caption2, weight: .bold))
                    .foregroundStyle(ElmTheme.danger)
                Text(fact.rumor)
                    .font(ElmFonts.text(.footnote))
                    .foregroundStyle(ElmTheme.ink2)
                    .lineSpacing(5)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 15)
            .padding(.vertical, 13)
            .background(ElmTheme.danger.opacity(0.09))

            Divider().overlay(ElmTheme.line)

            VStack(alignment: .leading, spacing: 5) {
                Text("✓ الحقيقة — دقّقها العلم")
                    .font(ElmFonts.text(.caption2, weight: .bold))
                    .foregroundStyle(ElmTheme.tealInk)
                Text(fact.truth)
                    .font(ElmFonts.text(.footnote))
                    .foregroundStyle(ElmTheme.ink2)
                    .lineSpacing(5)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 15)
            .padding(.vertical, 13)
            .background(ElmTheme.teal.opacity(0.09))
        }
        .background(ElmTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(ElmTheme.line, lineWidth: 1))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("الشائعة: \(fact.rumor). الحقيقة: \(fact.truth)")
    }

    private var readerTools: some View {
        HStack(spacing: 8) {
            toolButton(
                title: isNarrating ? "إيقاف" : "استماع",
                symbol: isNarrating ? "pause.fill" : "headphones",
                active: isNarrating
            ) {
                let paragraphs = ElmFormat.bodyParagraphs(story.body ?? "")
                if narration.storyId == story.apiId {
                    narration.toggle()
                } else {
                    narration.start(story: story, paragraphs: paragraphs)
                }
            }

            toolButton(
                title: library.contains(story) ? "محفوظة" : "احفظ",
                symbol: library.contains(story) ? "bookmark.fill" : "bookmark",
                active: library.contains(story)
            ) {
                library.toggle(story)
            }

            ShareLink(item: URLConstants.publicURL(path: story.path)) {
                toolLabel(title: "شارك", symbol: "square.and.arrow.up", active: false)
            }
            .buttonStyle(.plain)
        }
    }

    private func readAlso(_ related: [StoryCard]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(series.map { "اقرأ أيضًا في «\($0.name)»" } ?? "اقرأ أيضًا")
                .font(ElmFonts.display(.headline, weight: .heavy))
                .foregroundStyle(ElmTheme.ink)
            ForEach(related.prefix(3)) { item in
                MiniStoryRow(story: item)
            }
        }
    }

    private func slideCard(_ slide: StorySlide) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            if let url = slide.imageURL {
                RemoteImage(url: url, height: 180)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            if let stat = slide.stat, !stat.isEmpty {
                Text(ElmFormat.latinDigits(stat))
                    .font(ElmFonts.display(.largeTitle, weight: .heavy))
                    .foregroundStyle(accent)
                    .elmLatin()
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
                    .font(ElmFonts.text(.callout))
                    .foregroundStyle(ElmTheme.ink)
                    .lineSpacing(7)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }

    // MARK: أدوات

    private var isNarrating: Bool {
        narration.storyId == story.apiId && narration.state == .playing
    }

    private func toolButton(title: String, symbol: String, active: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            toolLabel(title: title, symbol: symbol, active: active)
        }
        .buttonStyle(.plain)
    }

    private func toolLabel(title: String, symbol: String, active: Bool) -> some View {
        HStack(spacing: 6) {
            Image(systemName: symbol).font(.system(size: 12, weight: .semibold))
            Text(title).font(ElmFonts.text(.caption, weight: .bold))
        }
        .foregroundStyle(active ? Color.white : ElmTheme.ink)
        .frame(maxWidth: .infinity)
        .padding(.vertical, 11)
        .background(active ? ElmTheme.navyDeep : ElmTheme.surface, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(active ? Color.clear : ElmTheme.line, lineWidth: 1)
        )
    }

    private func load() async {
        loading = true
        defer { loading = false }
        loadError = nil
        do {
            let fresh = try await APIClient.fetchStory(id: seed.apiId)
            detail = fresh
            AppCache.saveStory(fresh)
            var urls = [fresh.story.imageURL].compactMap { $0 }
            urls.append(contentsOf: (fresh.slides ?? []).compactMap(\.imageURL))
            urls.append(contentsOf: fresh.related.compactMap(\.imageURL))
            ImageStore.shared.prefetch(urls)
        } catch {
            if let cached = AppCache.loadStory(id: seed.apiId) {
                detail = cached
                loadError = "أنت تقرأ نسخة محفوظة من هذه المادة."
            } else if (seed.body ?? "").isEmpty {
                loadError = "تعذر تحميل متن المادة. جرّب مجددًا عند عودة الاتصال."
            }
        }
    }

    private static func chip(for slug: String) -> SeriesChip? {
        guard let swatch = SeriesPalette.active.first(where: { $0.id == slug }) else { return nil }
        return SeriesChip(slug: swatch.id, name: swatch.name, description: "", color: swatch.colorHex)
    }
}

/// استفتاء الختام — الخيارات محلية حتى يصل عقد الاستفتاء، فلا نعرض نسبًا مُختلقة.
private struct ClosingPoll: View {
    let storyId: String
    let accent: Color
    @Environment(PollStore.self) private var polls

    private let options = ["نعم، صارت أوضح", "جزئيًا — أريد تفاصيل أكثر", "لا، كنت أعرفها"]

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("استفتاء الختام")
                .font(ElmFonts.text(.caption2, weight: .bold))
                .foregroundStyle(ElmTheme.ink3)
            Text("هل خرجت بصورة أوضح بعد هذه المادة؟")
                .font(ElmFonts.display(.subheadline, weight: .bold))
                .foregroundStyle(ElmTheme.ink)
                .multilineTextAlignment(.leading)
                .padding(.top, 6)

            VStack(spacing: 8) {
                ForEach(options, id: \.self) { option in
                    let chosen = polls.choice(for: storyId) == option
                    Button {
                        polls.vote(option, on: storyId)
                    } label: {
                        HStack(spacing: 8) {
                            Text(option)
                                .font(ElmFonts.text(.footnote))
                                .foregroundStyle(ElmTheme.ink)
                                .multilineTextAlignment(.leading)
                            Spacer(minLength: 0)
                            if chosen {
                                Image(systemName: "checkmark")
                                    .font(.system(size: 12, weight: .bold))
                                    .foregroundStyle(accent)
                            }
                        }
                        .padding(.horizontal, 13)
                        .padding(.vertical, 11)
                        .background(chosen ? accent.opacity(0.14) : ElmTheme.surface2, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .stroke(chosen ? accent : ElmTheme.line2, lineWidth: chosen ? 1.5 : 1)
                        )
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(chosen ? [.isButton, .isSelected] : .isButton)
                }
            }
            .padding(.top, 12)

            if polls.choice(for: storyId) != nil {
                Text("سُجّل رأيك على هذا الجهاز. النِّسَب تظهر عند وصول عقد الاستفتاء من الخادم.")
                    .font(ElmFonts.text(.caption2))
                    .foregroundStyle(ElmTheme.ink3)
                    .padding(.top, 10)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .elmCard(radius: 16)
    }
}

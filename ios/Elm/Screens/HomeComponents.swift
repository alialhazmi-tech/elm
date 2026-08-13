import SwiftUI

// MARK: - سطر اليوم

/// التاريخ الهجري/الميلادي يمينًا، وشارة التغطية يسارًا.
struct DayStrip: View {
    var body: some View {
        HStack(spacing: 10) {
            Text(ElmFormat.todayStrip())
                .font(ElmFonts.text(.caption2))
                .foregroundStyle(ElmTheme.ink3)
                .elmLatin()
                .lineLimit(1)
                .minimumScaleFactor(0.75)
            Spacer(minLength: 6)
            Text("تغطية مستمرة")
                .font(ElmFonts.text(.caption2, weight: .bold))
                .foregroundStyle(ElmTheme.navyInk)
                .padding(.horizontal, 10)
                .padding(.vertical, 3)
                .background(ElmTheme.surface2, in: Capsule())
                .overlay(Capsule().stroke(ElmTheme.line, lineWidth: 1))
                .fixedSize()
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(ElmFormat.todayStrip())، تغطية مستمرة")
    }
}

// MARK: - العاجل

/// شريط ساكن بلا زحف: نقطة نابضة، كلمة «عاجل»، ثم العنوان بسطر واحد.
struct BreakingBanner: View {
    let item: BreakingItem
    @State private var pulse = false

    var body: some View {
        NavigationLink {
            StoryDestination(seed: StoryCard(
                id: item.href, slug: item.href, section: "news",
                title: item.title, excerpt: "", eyebrow: "عاجل", href: item.href
            ))
        } label: {
            HStack(spacing: 9) {
                Circle()
                    .fill(ElmTheme.danger)
                    .frame(width: 7, height: 7)
                    .opacity(pulse ? 1 : 0.35)
                    .accessibilityHidden(true)
                Text("عاجل")
                    .font(ElmFonts.text(.caption2, weight: .bold))
                    .foregroundStyle(ElmTheme.danger)
                    .fixedSize()
                Text(item.title)
                    .font(ElmFonts.text(.footnote))
                    .foregroundStyle(ElmTheme.ink)
                    .lineLimit(1)
                    .multilineTextAlignment(.leading)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 9)
            .elmCard(radius: 12)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("عاجل: \(item.title)")
        .onAppear {
            withAnimation(.easeInOut(duration: 0.9).repeatForever(autoreverses: true)) { pulse = true }
        }
    }
}

// MARK: - حزام السلاسل

struct SeriesBelt: View {
    let series: [SeriesChip]

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(series) { item in
                    NavigationLink {
                        SeriesFeedScreen(chip: item)
                    } label: {
                        HStack(spacing: 7) {
                            RoundedRectangle(cornerRadius: 2, style: .continuous)
                                .fill(ElmTheme.hex(item.color))
                                .frame(width: 8, height: 8)
                            Text(item.name)
                                .font(ElmFonts.text(.footnote, weight: .semibold))
                                .foregroundStyle(ElmTheme.ink)
                                .lineLimit(1)
                                .fixedSize()
                        }
                        .padding(.horizontal, 13)
                        .padding(.vertical, 7)
                        .background(ElmTheme.surface, in: Capsule())
                        .overlay(Capsule().stroke(ElmTheme.line, lineWidth: 1))
                        .shadow(color: .black.opacity(0.05), radius: 10, y: 4)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("سلسلة \(item.name)")
                }
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 5)
        }
        .scrollClipDisabled()
    }
}

// MARK: - موجز العلم

/// بطاقة الموجز: ترويسة متدرجة، ثم ثلاث قصص مرقّمة بلون سلسلتها، ثم شريط منشأ.
struct BriefBlock: View {
    let items: [BriefItem]
    /// مواد الرئيسية المرتبطة — لاستعادة لون/اسم السلسلة إن سقطت من عقد الموجز.
    var related: [StoryCard] = []
    var onStories: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            header
            Divider().overlay(ElmTheme.line)
            ForEach(Array(items.prefix(3).enumerated()), id: \.element.id) { index, item in
                briefRow(item, number: index + 1)
                if index < min(items.count, 3) - 1 {
                    Divider().overlay(ElmTheme.line)
                }
            }
            footer
        }
        .background(ElmTheme.surface, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(ElmTheme.line, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .shadow(color: .black.opacity(0.06), radius: 16, y: 6)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 11) {
                Text("✦")
                    .font(.system(size: 16))
                    .foregroundStyle(ElmTheme.gold)
                    .frame(width: 38, height: 38)
                    .background(ElmTheme.navyDeep, in: RoundedRectangle(cornerRadius: 11, style: .continuous))
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 1) {
                    Text("موجز العلم")
                        .font(ElmFonts.display(.subheadline, weight: .black))
                        .foregroundStyle(ElmTheme.ink)
                    Text("يُحدّث على مدار اليوم")
                        .font(ElmFonts.text(.caption2, weight: .medium))
                        .foregroundStyle(ElmTheme.ink3)
                }
                Spacer(minLength: 6)
                Button(action: onStories) {
                    HStack(spacing: 5) {
                        Text("شاهد كقصص")
                        Image(systemName: "arrow.left").font(.system(size: 10, weight: .bold))
                    }
                    .font(ElmFonts.text(.caption2, weight: .bold))
                    .foregroundStyle(ElmTheme.navyInk)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(ElmTheme.surface2, in: Capsule())
                    .overlay(Capsule().stroke(ElmTheme.line, lineWidth: 1))
                    .fixedSize()
                }
                .buttonStyle(.plain)
                .accessibilityLabel("شاهد الموجز كقصص")
            }

            Text("المشهد اليوم، بوضوح.")
                .font(ElmFonts.display(size: 26, weight: .black, relativeTo: .title2))
                .foregroundStyle(ElmTheme.ink)
                .tracking(-0.6)
                .padding(.top, 14)
            Text("ثلاث قصص مختارة تمنحك الصورة الأهم قبل التفاصيل.")
                .font(ElmFonts.text(.footnote, weight: .medium))
                .foregroundStyle(ElmTheme.ink2)
                .padding(.top, 6)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 18)
        .padding(.top, 18)
        .padding(.bottom, 14)
        .background(
            LinearGradient(
                colors: [ElmTheme.navy.opacity(0.07), ElmTheme.surface.opacity(0)],
                startPoint: .topTrailing,
                endPoint: .bottomLeading
            )
        )
    }

    private func briefRow(_ item: BriefItem, number: Int) -> some View {
        let color = accent(for: item)
        let label = seriesLabel(for: item)
        return NavigationLink {
            StoryDestination(seed: StoryCard(
                id: item.href, slug: item.href, section: "news",
                title: item.title, excerpt: "", eyebrow: label, href: item.href
            ))
        } label: {
            VStack(alignment: .leading, spacing: 0) {
                Rectangle()
                    .fill(color)
                    .frame(height: 2)
                    .padding(.horizontal, 2)
                    .accessibilityHidden(true)

                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    Text(label)
                        .font(ElmFonts.text(.caption2, weight: .bold))
                        .foregroundStyle(color)
                    Spacer(minLength: 8)
                    Text(ElmFormat.twoDigit(number))
                        .font(ElmFonts.text(.caption2, weight: .bold))
                        .foregroundStyle(ElmTheme.ink3)
                        .tracking(1)
                        .elmLatin()
                }
                .padding(.top, 12)

                Text(item.title)
                    .font(ElmFonts.display(.headline, weight: .heavy))
                    .foregroundStyle(ElmTheme.ink)
                    .multilineTextAlignment(.leading)
                    .lineSpacing(3)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.top, 8)

                HStack(spacing: 6) {
                    Text("اقرأ القصة")
                        .font(ElmFonts.text(.caption2, weight: .semibold))
                        .foregroundStyle(ElmTheme.ink2)
                    Image(systemName: "arrow.left")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(color)
                }
                .padding(.top, 10)
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 14)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(label)، \(item.title)")
    }

    private func relatedStory(for item: BriefItem) -> StoryCard? {
        related.first { card in
            card.path == item.href || card.href == item.href
        }
    }

    private func seriesLabel(for item: BriefItem) -> String {
        if let slug = relatedStory(for: item)?.series,
           let name = SeriesPalette.active.first(where: { $0.id == slug })?.name {
            return name
        }
        return item.label
    }

    private func accent(for item: BriefItem) -> Color {
        if let slug = relatedStory(for: item)?.series {
            return SeriesPalette.color(for: slug)
        }
        if let swatch = SeriesPalette.matching(label: item.label) {
            return swatch.color
        }
        return ElmTheme.hex(item.color)
    }

    private var footer: some View {
        HStack {
            Text("مختار من مواد المحررين المنشورة")
            Spacer(minLength: 8)
            Text("بلا ضجيج")
        }
        .font(ElmFonts.text(.caption2))
        .foregroundStyle(ElmTheme.ink3)
        .padding(.horizontal, 18)
        .padding(.vertical, 9)
        .frame(maxWidth: .infinity)
        .background(ElmTheme.surface2)
        .accessibilityHidden(true)
    }
}

// MARK: - المادة الرئيسية

struct HeroCard: View {
    let story: StoryCard
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    private var ratio: CGFloat { dynamicTypeSize.isAccessibilitySize ? 1.05 : 0.86 }

    var body: some View {
        NavigationLink {
            StoryDestination(seed: story)
        } label: {
            // الحاوية الشفافة تحمل النسبة، والصورة والسكريم والنص طبقات فوقها.
            // GeometryReader هنا كان يُسقط رسم الصورة رغم نجاح تحميلها.
            Color.clear
                .aspectRatio(1 / ratio, contentMode: .fit)
                .frame(minHeight: 300)
                .overlay { RemoteImage(url: story.imageURL) }
                .overlay { ElmTheme.scrim }
                .overlay(alignment: .bottomLeading) {
                    VStack(alignment: .leading, spacing: 0) {
                        SeriesChipLabel(name: kicker, color: seriesColor, onDark: true)
                        Text(story.title)
                            .font(ElmFonts.display(.title2, weight: .heavy))
                            .foregroundStyle(.white)
                            .multilineTextAlignment(.leading)
                            .lineLimit(4)
                            .shadow(color: .black.opacity(0.35), radius: 12, y: 2)
                            .padding(.top, 11)
                        HStack(spacing: 14) {
                            Text(ElmFormat.sectionName(story.section))
                            Text(ElmFormat.readingLabel(story.readingMinutes))
                        }
                        .font(ElmFonts.text(.caption2))
                        .foregroundStyle(.white.opacity(0.75))
                        .padding(.top, 9)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(18)
                }
                .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                .shadow(color: .black.opacity(0.10), radius: 18, y: 8)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(kicker)، \(story.title)، \(ElmFormat.readingLabel(story.readingMinutes))")
    }

    private var kicker: String {
        if !story.eyebrow.isEmpty { return story.eyebrow }
        if let series = story.series, let name = SeriesPalette.active.first(where: { $0.id == series })?.name {
            return name
        }
        return ElmFormat.sectionName(story.section)
    }

    private var seriesColor: Color {
        story.series.map(SeriesPalette.color(for:)) ?? ElmTheme.gold
    }
}

// MARK: - البطاقات المصغّرة

/// نص أولًا وصورة صغيرة على الطرف — إيقاع مختلف عن الهيرو حتى لا تتشابه القوائم.
struct MiniStoryRow: View {
    let story: StoryCard

    var body: some View {
        NavigationLink {
            StoryDestination(seed: story)
        } label: {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 0) {
                    Text(kicker)
                        .font(ElmFonts.text(.caption2, weight: .bold))
                        .foregroundStyle(color)
                    Text(story.title)
                        .font(ElmFonts.display(.subheadline, weight: .bold))
                        .foregroundStyle(ElmTheme.ink)
                        .multilineTextAlignment(.leading)
                        .lineLimit(3)
                        .padding(.top, 5)
                    Text(meta)
                        .font(ElmFonts.text(.caption2))
                        .foregroundStyle(ElmTheme.ink3)
                        .elmLatin()
                        .padding(.top, 6)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                RemoteImage(url: story.imageURL, height: 74, maxPixel: 320)
                    .frame(width: 92)
                    .clipShape(RoundedRectangle(cornerRadius: 11, style: .continuous))
            }
            .padding(12)
            .elmCard(radius: 16)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(kicker)، \(story.title)")
    }

    private var kicker: String {
        if let series = story.series, let name = SeriesPalette.active.first(where: { $0.id == series })?.name {
            return name
        }
        return story.eyebrow.isEmpty ? ElmFormat.sectionName(story.section) : story.eyebrow
    }

    private var color: Color {
        story.series.map(SeriesPalette.color(for:)) ?? ElmTheme.accent
    }

    private var meta: String {
        if let relative = ElmFormat.relativeTime(story.publishedAt) {
            return "\(relative) · \(ElmFormat.readingLabel(story.readingMinutes))"
        }
        return ElmFormat.readingLabel(story.readingMinutes)
    }
}

/// بلاطة بصورة كاملة وسكريم — تُستعمل في تغذية السلسلة و«لك أنت».
struct StoryTile: View {
    let story: StoryCard
    var tall: Bool = false

    private var ratio: CGFloat { tall ? 1.28 : 0.62 }

    var body: some View {
        NavigationLink {
            StoryDestination(seed: story)
        } label: {
            Color.clear
                .aspectRatio(1 / ratio, contentMode: .fit)
                .overlay { RemoteImage(url: story.imageURL) }
                .overlay { ElmTheme.scrim }
                .overlay(alignment: .bottomLeading) {
                    VStack(alignment: .leading, spacing: 7) {
                        SeriesChipLabel(name: kicker, color: color, onDark: true)
                        Text(story.title)
                            .font(ElmFonts.display(.headline, weight: .bold))
                            .foregroundStyle(.white)
                            .multilineTextAlignment(.leading)
                            .lineLimit(3)
                            .shadow(color: .black.opacity(0.3), radius: 8, y: 1)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(14)
                }
                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(kicker)، \(story.title)")
    }

    private var kicker: String {
        if let series = story.series, let name = SeriesPalette.active.first(where: { $0.id == series })?.name {
            return name
        }
        return story.eyebrow.isEmpty ? ElmFormat.sectionName(story.section) : story.eyebrow
    }

    private var color: Color {
        story.series.map(SeriesPalette.color(for:)) ?? ElmTheme.gold
    }
}

// MARK: - بالأرقام

/// بطاقات أفقية: الرقم بلون سلسلته والنص تحته — لا لوح كحلي يبتلع القسم.
struct NumbersRail: View {
    let stats: [NumberStat]

    var body: some View {
        VStack(alignment: .leading, spacing: 11) {
            SectionHead(title: "بالأرقام", subtitle: "كل رقم يحيل لمصدره")
                .padding(.horizontal, 18)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(alignment: .top, spacing: 10) {
                    ForEach(Array(stats.enumerated()), id: \.element.id) { index, stat in
                        VStack(alignment: .leading, spacing: 10) {
                            HStack(alignment: .firstTextBaseline, spacing: 1) {
                                Text(ElmFormat.latinDigits(stat.value))
                                    .font(ElmFonts.display(.title, weight: .heavy))
                                if let suffix = stat.suffix, !suffix.isEmpty {
                                    Text(ElmFormat.latinDigits(suffix))
                                        .font(ElmFonts.display(.subheadline, weight: .heavy))
                                        .opacity(0.7)
                                }
                            }
                            .elmLatin()
                            .foregroundStyle(ElmTheme.spectrum[(index * 3) % ElmTheme.spectrum.count])
                            .lineLimit(1)
                            .minimumScaleFactor(0.6)

                            Spacer(minLength: 0)

                            Text(stat.label)
                                .font(ElmFonts.text(.footnote))
                                .foregroundStyle(ElmTheme.ink2)
                                .multilineTextAlignment(.leading)
                                .lineLimit(4)
                        }
                        .frame(width: 154, alignment: .leading)
                        .frame(minHeight: 132, alignment: .topLeading)
                        .padding(14)
                        .elmCard(radius: 16)
                        .accessibilityElement(children: .combine)
                        .accessibilityLabel("\(stat.value) \(stat.suffix ?? "")، \(stat.label)")
                    }
                }
                .padding(.horizontal, 18)
                .padding(.vertical, 4)
            }
            .scrollClipDisabled()
        }
    }
}

// MARK: - الأكثر قراءة

struct MostReadList: View {
    let stories: [StoryCard]

    var body: some View {
        VStack(alignment: .leading, spacing: 11) {
            SectionHead(title: "الأكثر قراءة", subtitle: "مواد أخرى تستحق الانتباه")

            VStack(spacing: 0) {
                ForEach(Array(stories.prefix(5).enumerated()), id: \.element.id) { index, story in
                    Divider().overlay(ElmTheme.line)
                    NavigationLink {
                        StoryDestination(seed: story)
                    } label: {
                        HStack(alignment: .top, spacing: 12) {
                            Text(ElmFormat.twoDigit(index + 1))
                                .font(ElmFonts.display(.headline, weight: .heavy))
                                .foregroundStyle(ElmTheme.ink3)
                                .elmLatin()
                                .frame(width: 26, alignment: .leading)
                            VStack(alignment: .leading, spacing: 3) {
                                Text(kicker(story))
                                    .font(ElmFonts.text(.caption2, weight: .bold))
                                    .foregroundStyle(story.series.map(SeriesPalette.color(for:)) ?? ElmTheme.accent)
                                Text(story.title)
                                    .font(ElmFonts.text(.footnote))
                                    .foregroundStyle(ElmTheme.ink)
                                    .multilineTextAlignment(.leading)
                                    .lineLimit(3)
                            }
                            Spacer(minLength: 0)
                        }
                        .padding(.vertical, 13)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("\(kicker(story))، \(story.title)")
                }
            }
        }
    }

    private func kicker(_ story: StoryCard) -> String {
        if let series = story.series, let name = SeriesPalette.active.first(where: { $0.id == series })?.name {
            return name
        }
        return story.eyebrow.isEmpty ? ElmFormat.sectionName(story.section) : story.eyebrow
    }
}

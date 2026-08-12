import SwiftUI

struct SectionHead: View {
    let title: String
    var subtitle: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(ElmFonts.display(.title3, weight: .heavy))
                .foregroundStyle(ElmTheme.ink)
            Rectangle()
                .fill(ElmTheme.gold)
                .frame(width: 36, height: 3)
                .clipShape(Capsule())
                .accessibilityHidden(true)
            if let subtitle {
                Text(subtitle)
                    .font(ElmFonts.text(.footnote))
                    .foregroundStyle(ElmTheme.ink2)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.bottom, 4)
        .overlay(alignment: .bottom) {
            Rectangle().fill(ElmTheme.line).frame(height: 1)
        }
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isHeader)
    }
}

struct SeriesChipLabel: View {
    let name: String
    let color: Color

    var body: some View {
        Text(name)
            .font(ElmFonts.text(.caption, weight: .bold))
            .foregroundStyle(.white)
            .padding(.horizontal, 12)
            .padding(.vertical, 4)
            .background(color)
            .clipShape(Capsule())
    }
}

struct DayStrip: View {
    var body: some View {
        HStack {
            Text(ElmFormat.todayStrip())
                .font(ElmFonts.text(.caption, weight: .medium))
                .foregroundStyle(ElmTheme.ink2)
                .environment(\.layoutDirection, .leftToRight)
            Spacer()
            Text("تغطية مستمرة")
                .font(ElmFonts.text(.caption2, weight: .bold))
                .foregroundStyle(ElmTheme.navy)
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .background(ElmTheme.surface2)
                .overlay(
                    Capsule().stroke(ElmTheme.line, lineWidth: 1)
                )
                .clipShape(Capsule())
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("تاريخ اليوم، تغطية مستمرة")
    }
}

struct BreakingBanner: View {
    let item: BreakingItem

    var body: some View {
        HStack(spacing: 10) {
            Circle()
                .fill(Color.red)
                .frame(width: 8, height: 8)
                .accessibilityHidden(true)
            Text("عاجل")
                .font(ElmFonts.text(.caption, weight: .bold))
                .foregroundStyle(.white)
            Text(item.title)
                .font(ElmFonts.text(.subheadline, weight: .semibold))
                .foregroundStyle(.white)
                .lineLimit(2)
            Spacer(minLength: 0)
        }
        .padding(12)
        .background(ElmTheme.navyDeep)
        .clipShape(RoundedRectangle(cornerRadius: ElmTheme.radiusSm, style: .continuous))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("عاجل: \(item.title)")
    }
}

struct SeriesLensesRow: View {
    let series: [SeriesChip]

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("مسارات العلم")
                .font(ElmFonts.text(.caption, weight: .bold))
                .foregroundStyle(ElmTheme.ink2)
            Text("اختر طريقتك في الفهم")
                .font(ElmFonts.display(.title3, weight: .heavy))
                .foregroundStyle(ElmTheme.ink)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(Array(series.enumerated()), id: \.element.id) { index, item in
                        NavigationLink(value: item) {
                            VStack(alignment: .leading, spacing: 6) {
                                Text(ElmFormat.twoDigit(index + 1))
                                    .font(ElmFonts.text(.caption2, weight: .bold))
                                    .foregroundStyle(ElmTheme.ink2)
                                    .environment(\.layoutDirection, .leftToRight)
                                Text(item.name)
                                    .font(ElmFonts.display(.subheadline, weight: .bold))
                                    .foregroundStyle(ElmTheme.ink)
                                Text(item.description)
                                    .font(ElmFonts.text(.caption2))
                                    .foregroundStyle(ElmTheme.ink2)
                                    .lineLimit(2)
                            }
                            .padding(12)
                            .frame(width: 148, alignment: .leading)
                            .background(
                                LinearGradient(
                                    colors: [ElmTheme.hex(item.color).opacity(0.16), ElmTheme.surface],
                                    startPoint: .top,
                                    endPoint: .bottom
                                )
                            )
                            .overlay(alignment: .top) {
                                Rectangle()
                                    .fill(ElmTheme.hex(item.color))
                                    .frame(height: 4)
                            }
                            .clipShape(RoundedRectangle(cornerRadius: ElmTheme.radiusSm, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: ElmTheme.radiusSm, style: .continuous)
                                    .stroke(ElmTheme.line, lineWidth: 1)
                            )
                            .accessibilityElement(children: .combine)
                            .accessibilityLabel("\(item.name)، \(item.description)")
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.vertical, 2)
            }
        }
    }
}

struct BriefBlock: View {
    let items: [BriefItem]

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 12) {
                Text("✦")
                    .font(.title3)
                    .foregroundStyle(ElmTheme.gold)
                    .frame(width: 42, height: 42)
                    .background(ElmTheme.navyDeep)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text("موجز العلم")
                        .font(ElmFonts.display(.headline, weight: .heavy))
                        .foregroundStyle(ElmTheme.ink)
                    Text("يُحدّث على مدار اليوم")
                        .font(ElmFonts.text(.caption2))
                        .foregroundStyle(ElmTheme.ink2)
                }
            }
            .padding(16)

            Text("المشهد اليوم، بوضوح.")
                .font(ElmFonts.display(.title2, weight: .heavy))
                .foregroundStyle(ElmTheme.ink)
                .padding(.horizontal, 16)
                .padding(.bottom, 12)

            ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                NavigationLink(value: StoryCard(
                    id: item.href,
                    slug: item.href,
                    section: "news",
                    title: item.title,
                    excerpt: "",
                    eyebrow: item.label,
                    href: item.href
                )) {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text(item.label)
                                .font(ElmFonts.text(.caption, weight: .bold))
                                .foregroundStyle(ElmTheme.hex(item.color))
                            Spacer()
                            Text(ElmFormat.twoDigit(index + 1))
                                .font(ElmFonts.text(.caption, weight: .bold))
                                .foregroundStyle(ElmTheme.ink2)
                                .environment(\.layoutDirection, .leftToRight)
                        }
                        Text(item.title)
                            .font(ElmFonts.display(.headline, weight: .bold))
                            .foregroundStyle(ElmTheme.ink)
                            .lineLimit(3)
                            .multilineTextAlignment(.leading)
                    }
                    .padding(16)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .overlay(alignment: .top) {
                        Rectangle()
                            .fill(ElmTheme.hex(item.color))
                            .frame(height: 2)
                            .padding(.horizontal, 16)
                    }
                }
                .buttonStyle(.plain)
                if index < items.count - 1 {
                    Divider().background(ElmTheme.line)
                }
            }
        }
        .background(ElmTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: ElmTheme.radiusLg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: ElmTheme.radiusLg, style: .continuous)
                .stroke(ElmTheme.line, lineWidth: 1)
        )
        .accessibilityElement(children: .contain)
        .accessibilityLabel("موجز العلم")
    }
}

struct HeroCard: View {
    let story: StoryCard

    var body: some View {
        NavigationLink(value: story) {
            ZStack(alignment: .bottomLeading) {
                RemoteImage(url: story.imageURL, minHeight: 320)
                LinearGradient(
                    colors: [.clear, ElmTheme.navyDeep.opacity(0.92)],
                    startPoint: .top,
                    endPoint: .bottom
                )
                VStack(alignment: .leading, spacing: 10) {
                    if let series = story.series {
                        SeriesChipLabel(name: SeriesPalette.active.first { $0.id == series }?.name ?? series,
                                        color: SeriesPalette.color(for: series))
                    }
                    Text(story.title)
                        .font(ElmFonts.display(.title2, weight: .heavy))
                        .foregroundStyle(.white)
                        .multilineTextAlignment(.leading)
                    HStack(spacing: 12) {
                        Text(ElmFormat.sectionName(story.section))
                        Text(ElmFormat.readingLabel(story.readingMinutes))
                    }
                    .font(ElmFonts.text(.caption, weight: .medium))
                    .foregroundStyle(.white.opacity(0.78))
                }
                .padding(20)
            }
            .clipShape(RoundedRectangle(cornerRadius: ElmTheme.radiusLg, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(story.title)، \(ElmFormat.sectionName(story.section))")
    }
}

struct MiniStoryRow: View {
    let story: StoryCard

    var body: some View {
        NavigationLink(value: story) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(kick)
                        .font(ElmFonts.text(.caption, weight: .bold))
                        .foregroundStyle(SeriesPalette.color(for: story.series ?? ""))
                    Text(story.title)
                        .font(ElmFonts.display(.subheadline, weight: .bold))
                        .foregroundStyle(ElmTheme.ink)
                        .lineLimit(3)
                        .multilineTextAlignment(.leading)
                    Text(meta)
                        .font(ElmFonts.text(.caption2))
                        .foregroundStyle(ElmTheme.ink2)
                }
                Spacer(minLength: 0)
                RemoteImage(url: story.imageURL, height: 72)
                    .frame(width: 92, height: 72)
                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            }
            .padding(12)
            .background(ElmTheme.surface)
            .clipShape(RoundedRectangle(cornerRadius: ElmTheme.radiusMd, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: ElmTheme.radiusMd, style: .continuous)
                    .stroke(ElmTheme.line, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel(story.title)
    }

    private var kick: String {
        SeriesPalette.active.first { $0.id == story.series }?.name
            ?? (story.eyebrow.isEmpty ? ElmFormat.sectionName(story.section) : story.eyebrow)
    }

    private var meta: String {
        let time = ElmFormat.relativeTime(story.publishedAt)
        let read = ElmFormat.readingLabel(story.readingMinutes)
        if let time { return "\(time) · \(read)" }
        return read
    }
}

struct DataStoryCard: View {
    let story: StoryCard

    var body: some View {
        NavigationLink(value: story) {
            VStack(alignment: .leading, spacing: 8) {
                Text(kick)
                    .font(ElmFonts.text(.caption, weight: .bold))
                    .foregroundStyle(Color(red: 0.56, green: 0.70, blue: 0.96))
                if let value = ElmFormat.percent(from: story.title) {
                    HStack(alignment: .firstTextBaseline, spacing: 2) {
                        Text(ElmFormat.latinDigits(value))
                            .font(ElmFonts.display(.largeTitle, weight: .heavy))
                        Text("%")
                            .font(ElmFonts.display(.title3, weight: .bold))
                            .foregroundStyle(Color(red: 0.56, green: 0.70, blue: 0.96))
                    }
                    .environment(\.layoutDirection, .leftToRight)
                    .foregroundStyle(.white)
                }
                Text(story.title)
                    .font(ElmFonts.text(.footnote, weight: .medium))
                    .foregroundStyle(.white.opacity(0.86))
                    .multilineTextAlignment(.leading)
                HStack(alignment: .bottom, spacing: 6) {
                    ForEach([18, 24, 30, 42, 58, 79, 100], id: \.self) { height in
                        RoundedRectangle(cornerRadius: 2)
                            .fill(LinearGradient(colors: [Color(red: 0.41, green: 0.64, blue: 1), Color(red: 0.18, green: 0.40, blue: 0.85)], startPoint: .top, endPoint: .bottom))
                            .frame(height: CGFloat(height) * 0.42)
                    }
                }
                .frame(height: 48, alignment: .bottom)
                .accessibilityHidden(true)
                HStack(spacing: 6) {
                    Text("✦").foregroundStyle(ElmTheme.gold)
                    Text("اللوحة مشتقة من أرقام المادة")
                        .foregroundStyle(.white.opacity(0.55))
                }
                .font(ElmFonts.text(.caption2))
            }
            .padding(18)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RadialGradient(
                    colors: [Color(red: 0.11, green: 0.25, blue: 0.49), ElmTheme.navyDeep],
                    center: .topTrailing,
                    startRadius: 10,
                    endRadius: 280
                )
            )
            .clipShape(RoundedRectangle(cornerRadius: ElmTheme.radiusMd, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(story.title)
    }

    private var kick: String {
        let series = SeriesPalette.active.first { $0.id == story.series }?.name
        if let series { return "\(series) · أسواق واقتصاد" }
        return "أسواق واقتصاد"
    }
}

struct MosaicStoryCard: View {
    let story: StoryCard
    var tall = false

    var body: some View {
        NavigationLink(value: story) {
            VStack(alignment: .leading, spacing: 0) {
                RemoteImage(url: story.imageURL, height: tall ? 210 : 160)
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text(kick)
                            .font(ElmFonts.text(.caption, weight: .bold))
                            .foregroundStyle(SeriesPalette.color(for: story.series ?? ""))
                        Spacer()
                        if let when = ElmFormat.relativeTime(story.publishedAt) {
                            Text(when)
                                .font(ElmFonts.text(.caption2))
                                .foregroundStyle(ElmTheme.ink2)
                        }
                    }
                    Text(story.title)
                        .font(ElmFonts.display(tall ? .title3 : .headline, weight: .bold))
                        .foregroundStyle(ElmTheme.ink)
                        .multilineTextAlignment(.leading)
                    if tall, !story.excerpt.isEmpty {
                        Text(story.excerpt)
                            .font(ElmFonts.text(.footnote))
                            .foregroundStyle(ElmTheme.ink2)
                            .lineLimit(3)
                    }
                }
                .padding(14)
            }
            .background(ElmTheme.surface)
            .clipShape(RoundedRectangle(cornerRadius: ElmTheme.radiusMd, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: ElmTheme.radiusMd, style: .continuous)
                    .stroke(ElmTheme.line, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel(story.title)
    }

    private var kick: String {
        let series = SeriesPalette.active.first { $0.id == story.series }?.name
        let section = ElmFormat.sectionName(story.section)
        if let series { return "\(series) · \(section)" }
        return section
    }
}

struct QuestionCard: View {
    let item: QuestionItem

    var body: some View {
        NavigationLink(value: item.asCard) {
            VStack(alignment: .leading, spacing: 10) {
                Text("؟")
                    .font(ElmFonts.display(.largeTitle, weight: .heavy))
                    .foregroundStyle(SeriesPalette.color(for: "limatha"))
                    .accessibilityHidden(true)
                Text(item.kick)
                    .font(ElmFonts.text(.caption, weight: .bold))
                    .foregroundStyle(SeriesPalette.color(for: "limatha"))
                Text(item.title)
                    .font(ElmFonts.display(.title3, weight: .heavy))
                    .foregroundStyle(ElmTheme.ink)
                    .multilineTextAlignment(.leading)
                Text(item.text)
                    .font(ElmFonts.text(.footnote))
                    .foregroundStyle(ElmTheme.ink2)
            }
            .padding(18)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(ElmTheme.surface)
            .clipShape(RoundedRectangle(cornerRadius: ElmTheme.radiusMd, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: ElmTheme.radiusMd, style: .continuous)
                    .stroke(ElmTheme.line, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel(item.title)
    }
}

struct MostReadList: View {
    let stories: [StoryCard]

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHead(title: "الأكثر قراءة", subtitle: "مواد أخرى تستحق الانتباه")
            ForEach(Array(stories.enumerated()), id: \.element.id) { index, story in
                NavigationLink(value: story) {
                    HStack(alignment: .top, spacing: 12) {
                        Text(ElmFormat.twoDigit(index + 1))
                            .font(ElmFonts.display(.title3, weight: .heavy))
                            .foregroundStyle(ElmTheme.ink2.opacity(0.7))
                            .environment(\.layoutDirection, .leftToRight)
                        VStack(alignment: .leading, spacing: 4) {
                            Text(SeriesPalette.active.first { $0.id == story.series }?.name
                                 ?? ElmFormat.sectionName(story.section))
                                .font(ElmFonts.text(.caption, weight: .bold))
                                .foregroundStyle(SeriesPalette.color(for: story.series ?? ""))
                            Text(story.title)
                                .font(ElmFonts.display(.subheadline, weight: .bold))
                                .foregroundStyle(ElmTheme.ink)
                                .lineLimit(3)
                                .multilineTextAlignment(.leading)
                        }
                        Spacer(minLength: 0)
                    }
                    .padding(14)
                    .background(ElmTheme.surface)
                    .clipShape(RoundedRectangle(cornerRadius: ElmTheme.radiusMd, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: ElmTheme.radiusMd, style: .continuous)
                            .stroke(ElmTheme.line, lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)
                .accessibilityLabel(story.title)
            }
        }
    }
}

struct NumbersGrid: View {
    let stats: [NumberStat]

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHead(title: "بالأرقام", subtitle: "أرقام من المواد — وكل رقم يحيل لمصدره")
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                ForEach(stats) { stat in
                    VStack(alignment: .leading, spacing: 6) {
                        HStack(alignment: .firstTextBaseline, spacing: 2) {
                            Text(ElmFormat.latinDigits(stat.value))
                                .font(ElmFonts.display(.title, weight: .heavy))
                            if let suffix = stat.suffix {
                                Text(ElmFormat.latinDigits(suffix))
                                    .font(ElmFonts.display(.headline, weight: .bold))
                                    .foregroundStyle(ElmTheme.accent)
                            }
                        }
                        .environment(\.layoutDirection, .leftToRight)
                        .foregroundStyle(ElmTheme.ink)
                        Text(stat.label)
                            .font(ElmFonts.text(.caption))
                            .foregroundStyle(ElmTheme.ink2)
                            .lineLimit(3)
                            .multilineTextAlignment(.leading)
                    }
                    .padding(14)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(ElmTheme.surface)
                    .clipShape(RoundedRectangle(cornerRadius: ElmTheme.radiusMd, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: ElmTheme.radiusMd, style: .continuous)
                            .stroke(ElmTheme.line, lineWidth: 1)
                    )
                    .accessibilityElement(children: .combine)
                }
            }
        }
    }
}

struct VideoStoryCard: View {
    let story: StoryCard

    var body: some View {
        NavigationLink(value: story) {
            ZStack(alignment: .bottomLeading) {
                RemoteImage(url: story.imageURL, height: 200)
                LinearGradient(colors: [.clear, ElmTheme.navyDeep.opacity(0.88)], startPoint: .center, endPoint: .bottom)
                Image(systemName: "play.fill")
                    .font(.title3)
                    .foregroundStyle(.white)
                    .padding(12)
                    .background(.black.opacity(0.45))
                    .clipShape(Circle())
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 6) {
                    Text("مرئي · فيديوجرافيك")
                        .font(ElmFonts.text(.caption, weight: .bold))
                        .foregroundStyle(ElmTheme.gold)
                    Text(story.title)
                        .font(ElmFonts.display(.headline, weight: .bold))
                        .foregroundStyle(.white)
                    Text("\(ElmFormat.latinDigits(String(story.readingMinutes))) دقائق مشاهدة")
                        .font(ElmFonts.text(.caption2))
                        .foregroundStyle(.white.opacity(0.75))
                }
                .padding(14)
            }
            .clipShape(RoundedRectangle(cornerRadius: ElmTheme.radiusMd, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(story.title)
    }
}

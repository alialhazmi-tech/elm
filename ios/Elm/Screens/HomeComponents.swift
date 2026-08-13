import SwiftUI

struct SectionHead: View {
    let title: String
    var subtitle: String? = nil

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text(title)
                .font(ElmFonts.display(.headline, weight: .heavy))
                .foregroundStyle(ElmTheme.ink)
            Spacer(minLength: 0)
            if let subtitle {
                Text(subtitle)
                    .font(ElmFonts.text(.caption2))
                    .foregroundStyle(ElmTheme.ink3)
                    .lineLimit(1)
            }
        }
        .padding(.top, 6)
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
        ViewThatFits(in: .horizontal) {
            HStack { date; Spacer(); status }
            VStack(alignment: .leading, spacing: 7) { date; status }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("تاريخ اليوم، تغطية مستمرة")
    }

    private var date: some View {
        Text(ElmFormat.todayStrip())
            .font(ElmFonts.text(.caption, weight: .medium))
            .foregroundStyle(ElmTheme.ink2)
            .environment(\.layoutDirection, .leftToRight)
    }

    private var status: some View {
        Text("تغطية مستمرة")
            .font(ElmFonts.text(.caption2, weight: .bold))
            .foregroundStyle(ElmTheme.navy)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(ElmTheme.surface2)
            .overlay(Capsule().stroke(ElmTheme.line, lineWidth: 1))
            .clipShape(Capsule())
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
        VStack(alignment: .leading, spacing: 9) {
            Text("اختر عدستك في الفهم")
                .font(ElmFonts.display(.subheadline, weight: .heavy))
                .foregroundStyle(ElmTheme.ink)
                .padding(.horizontal, 2)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(series) { item in
                        NavigationLink {
                            SeriesFeedScreen(chip: item)
                        } label: {
                            HStack(spacing: 7) {
                                Circle()
                                    .fill(ElmTheme.hex(item.color))
                                    .frame(width: 8, height: 8)
                                Text(item.name)
                                    .font(ElmFonts.text(.subheadline, weight: .medium))
                                    .foregroundStyle(ElmTheme.ink)
                                    .lineLimit(1)
                            }
                            .padding(.horizontal, 14)
                            .padding(.vertical, 8)
                            .background(ElmTheme.surface, in: Capsule())
                            .overlay(Capsule().stroke(ElmTheme.line, lineWidth: 1))
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("سلسلة \(item.name)")
                    }
                }
                .padding(.horizontal, 2)
                .padding(.vertical, 2)
            }
            .scrollClipDisabled()
        }
    }
}

struct BriefBlock: View {
    let items: [BriefItem]

    var body: some View {
        VStack(alignment: .leading, spacing: 11) {
            HStack(spacing: 9) {
                Text("✦")
                    .font(.system(size: 15))
                    .foregroundStyle(ElmTheme.gold)
                    .frame(width: 30, height: 30)
                    .background(ElmTheme.gold.opacity(0.16), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                VStack(alignment: .leading, spacing: 0) {
                    Text("موجز العلم")
                        .font(ElmFonts.display(.subheadline, weight: .heavy))
                        .foregroundStyle(.white)
                    Text("المشهد اليوم في ثلاث نقاط")
                        .font(ElmFonts.text(.caption2))
                        .foregroundStyle(Color.white.opacity(0.6))
                }
                Spacer(minLength: 0)
            }

            VStack(alignment: .leading, spacing: 9) {
                ForEach(items.prefix(3)) { item in
                    // نفس بذرة المادة السابقة: المسار المقدس هو المعرّف
                    let story = StoryCard(
                        id: item.href,
                        slug: item.href,
                        section: "news",
                        title: item.title,
                        excerpt: "",
                        eyebrow: item.label,
                        href: item.href
                    )
                    NavigationLink {
                        StoryDetailScreen(seed: story)
                    } label: {
                        HStack(alignment: .top, spacing: 9) {
                            Circle()
                                .fill(ElmTheme.hex(item.color))
                                .frame(width: 7, height: 7)
                                .padding(.top, 7)
                            Text(item.title)
                                .font(ElmFonts.text(.footnote))
                                .foregroundStyle(Color.white.opacity(0.92))
                                .multilineTextAlignment(.trailing)
                                .frame(maxWidth: .infinity, alignment: .trailing)
                        }
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("\(item.label)، \(item.title)")
                }
            }
        }
        .padding(15)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(ElmTheme.navy, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
    }
}

struct HeroCard: View {
    let story: StoryCard
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    /// نسبة قريبة من 4:5؛ وفي أحجام الوصول يعلو الإطار ليتسع النص.
    private var ratio: CGFloat { dynamicTypeSize.isAccessibilitySize ? 1.05 : 1.12 }

    var body: some View {
        NavigationLink {
            StoryDetailScreen(seed: story)
        } label: {
            // الحاوية الشفافة تحمل النسبة، والصورة والسكريم والنص طبقات فوقها.
            // GeometryReader هنا كان يُسقط رسم الصورة رغم نجاح تحميلها.
            Color.clear
                .aspectRatio(1 / ratio, contentMode: .fit)
                .overlay { RemoteImage(url: story.imageURL) }
                .overlay {
                    LinearGradient(
                        stops: [
                            .init(color: ElmTheme.navyDeep.opacity(0.94), location: 0.06),
                            .init(color: ElmTheme.navyDeep.opacity(0.55), location: 0.38),
                            .init(color: ElmTheme.navyDeep.opacity(0.02), location: 0.72),
                        ],
                        startPoint: .bottom,
                        endPoint: .top
                    )
                }
                .overlay(alignment: .bottomTrailing) {
                    VStack(alignment: .trailing, spacing: 8) {
                        HeroKicker(text: story.eyebrow.isEmpty ? "قصة اليوم" : story.eyebrow)
                        Text(story.title)
                            .font(ElmFonts.display(.title2, weight: .heavy))
                            .foregroundStyle(.white)
                            .multilineTextAlignment(.trailing)
                            .lineLimit(4)
                            .shadow(color: .black.opacity(0.35), radius: 12, y: 2)
                        HStack(spacing: 10) {
                            Text(ElmFormat.readingLabel(story.readingMinutes))
                            Text("·")
                            Text(ElmFormat.sectionName(story.section))
                        }
                        .font(ElmFonts.text(.caption, weight: .medium))
                        .foregroundStyle(.white.opacity(0.75))
                    }
                    .frame(maxWidth: .infinity, alignment: .trailing)
                    .padding(16)
                }
                .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(story.title)، \(ElmFormat.sectionName(story.section))")
    }
}

/// سطر تصنيفي بخط ذهبي قصير — نفس لغة تقارير «جاك العلم».
struct HeroKicker: View {
    let text: String
    var color: Color = ElmTheme.gold

    var body: some View {
        HStack(spacing: 6) {
            Text(text)
                .font(ElmFonts.display(.caption2, weight: .heavy))
            RoundedRectangle(cornerRadius: 2, style: .continuous)
                .fill(color)
                .frame(width: 14, height: 2.5)
        }
        .foregroundStyle(color)
    }
}

struct MiniStoryRow: View {
    let story: StoryCard

    var body: some View {
        NavigationLink {
            StoryDetailScreen(seed: story)
        } label: {
            HStack(alignment: .top, spacing: 12) {
                RemoteImage(url: story.imageURL, height: 78)
                    .frame(width: 104, height: 78)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

                VStack(alignment: .trailing, spacing: 5) {
                    HeroKicker(
                        text: story.eyebrow.isEmpty ? ElmFormat.sectionName(story.section) : story.eyebrow,
                        color: story.series.map(SeriesPalette.color(for:)) ?? ElmTheme.accent
                    )
                    Text(story.title)
                        .font(ElmFonts.display(.subheadline, weight: .bold))
                        .foregroundStyle(ElmTheme.ink)
                        .multilineTextAlignment(.trailing)
                        .lineLimit(3)
                    Text(ElmFormat.readingLabel(story.readingMinutes))
                        .font(ElmFonts.text(.caption2))
                        .foregroundStyle(ElmTheme.ink3)
                }
                .frame(maxWidth: .infinity, alignment: .trailing)
            }
            .padding(10)
            .background(ElmTheme.surface, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            .shadow(color: Color.black.opacity(0.05), radius: 12, y: 4)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(story.title)، \(ElmFormat.sectionName(story.section))")
    }
}

struct DataStoryCard: View {
    let story: StoryCard

    var body: some View {
        NavigationLink {
            StoryDetailScreen(seed: story)
        } label: {
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
        .contentShape(RoundedRectangle(cornerRadius: ElmTheme.radiusMd, style: .continuous))
    }

    private var kick: String {
        let series = SeriesPalette.active.first { $0.id == story.series }?.name
        if let series { return "\(series) · أسواق واقتصاد" }
        return "أسواق واقتصاد"
    }
}

struct MosaicStoryCard: View {
    let story: StoryCard
    var tall: Bool = false

    private var ratio: CGFloat { tall ? 1.34 : 1.0 }

    var body: some View {
        NavigationLink {
            StoryDetailScreen(seed: story)
        } label: {
            Color.clear
                .aspectRatio(1 / ratio, contentMode: .fit)
                .overlay { RemoteImage(url: story.imageURL) }
                .overlay {
                    LinearGradient(
                        stops: [
                            .init(color: ElmTheme.navyDeep.opacity(0.92), location: 0.08),
                            .init(color: ElmTheme.navyDeep.opacity(0.12), location: 0.62),
                        ],
                        startPoint: .bottom,
                        endPoint: .top
                    )
                }
                .overlay(alignment: .bottomTrailing) {
                    VStack(alignment: .trailing, spacing: 6) {
                        HeroKicker(text: story.eyebrow.isEmpty ? "وراء الخبر" : story.eyebrow)
                        Text(story.title)
                            .font(ElmFonts.display(.subheadline, weight: .bold))
                            .foregroundStyle(.white)
                            .multilineTextAlignment(.trailing)
                            .lineLimit(3)
                            .shadow(color: .black.opacity(0.3), radius: 8, y: 1)
                    }
                    .frame(maxWidth: .infinity, alignment: .trailing)
                    .padding(12)
                }
                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(story.title)، \(ElmFormat.sectionName(story.section))")
    }
}

struct QuestionCard: View {
    let item: QuestionItem

    var body: some View {
        NavigationLink {
            StoryDetailScreen(seed: item.asCard)
        } label: {
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
                NavigationLink {
                    StoryDetailScreen(seed: story)
                } label: {
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
        VStack(alignment: .leading, spacing: 13) {
            HStack(spacing: 8) {
                Text("بالأرقام")
                    .font(ElmFonts.display(.subheadline, weight: .heavy))
                    .foregroundStyle(.white)
                Spacer(minLength: 0)
                Text("كل رقم يحيل لمصدره")
                    .font(ElmFonts.text(.caption2))
                    .foregroundStyle(Color.white.opacity(0.55))
            }

            LazyVGrid(
                columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 3),
                alignment: .trailing,
                spacing: 12
            ) {
                ForEach(stats.prefix(3)) { stat in
                    VStack(alignment: .trailing, spacing: 6) {
                        HStack(alignment: .firstTextBaseline, spacing: 1) {
                            Text(ElmFormat.latinDigits(stat.value))
                                .font(ElmFonts.display(.title, weight: .heavy))
                            if let suffix = stat.suffix {
                                Text(ElmFormat.latinDigits(suffix))
                                    .font(ElmFonts.display(.subheadline, weight: .heavy))
                            }
                        }
                        .environment(\.layoutDirection, .leftToRight)
                        .foregroundStyle(
                            LinearGradient(
                                colors: [ElmTheme.hex("ffd35e"), ElmTheme.hex("c8901a")],
                                startPoint: .top,
                                endPoint: .bottom
                            )
                        )
                        .minimumScaleFactor(0.6)
                        .lineLimit(1)

                        Text(stat.label)
                            .font(ElmFonts.text(.caption2))
                            .foregroundStyle(Color.white.opacity(0.68))
                            .multilineTextAlignment(.trailing)
                            .lineLimit(3)
                    }
                    .frame(maxWidth: .infinity, alignment: .trailing)
                    .accessibilityElement(children: .combine)
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            LinearGradient(
                colors: [ElmTheme.navyDeep, ElmTheme.hex("16304f")],
                startPoint: .topTrailing,
                endPoint: .bottomLeading
            ),
            in: RoundedRectangle(cornerRadius: 22, style: .continuous)
        )
    }
}

struct VideoStoryCard: View {
    let story: StoryCard

    var body: some View {
        NavigationLink {
            StoryDetailScreen(seed: story)
        } label: {
            ZStack(alignment: .bottomLeading) {
                RemoteImage(url: story.imageURL, height: 180)
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
                    Text(ElmFormat.watchingLabel(story.readingMinutes))
                        .font(ElmFonts.text(.caption2))
                        .foregroundStyle(.white.opacity(0.75))
                }
                .padding(14)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .clipShape(RoundedRectangle(cornerRadius: ElmTheme.radiusMd, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(story.title)
    }
}

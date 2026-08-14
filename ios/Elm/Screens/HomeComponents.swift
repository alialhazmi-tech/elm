import SwiftUI

// MARK: - قطع الطبعة التحريرية المشتركة

/// كيكر «الطبعة»: شرطة 14×3 بلون السلسلة ثم النص بلونها — أوضح توقيع بصري في الويب.
struct KickerBar: View {
    let label: String
    let color: Color
    /// «· القسم» الخافت بعد الكيكر إن لزم.
    var trailing: String? = nil
    var barWidth: CGFloat = 14

    var body: some View {
        HStack(spacing: 7) {
            RoundedRectangle(cornerRadius: 1, style: .continuous)
                .fill(color)
                .frame(width: barWidth, height: 3)
                .accessibilityHidden(true)
            Text(label)
                .font(ElmFonts.text(size: 11.5, weight: .bold, relativeTo: .caption2))
                .foregroundStyle(color)
            if let trailing, !trailing.isEmpty {
                Text("· \(trailing)")
                    .font(ElmFonts.text(size: 11.5, weight: .medium, relativeTo: .caption2))
                    .foregroundStyle(ElmTheme.ink3)
            }
        }
        .lineLimit(1)
    }
}

/// سطر ميتا خافت: زمن نسبي ودقائق قراءة — دائمًا بأرقام لاتينية.
struct StoryMetaLine: View {
    let story: StoryCard

    var body: some View {
        Text(text)
            .font(ElmFonts.text(size: 11.5, relativeTo: .caption2))
            .foregroundStyle(ElmTheme.ink3)
            .elmLatin()
    }

    private var text: String {
        if let relative = ElmFormat.relativeTime(story.publishedAt) {
            return "\(relative) · \(ElmFormat.readingLabel(story.readingMinutes))"
        }
        return ElmFormat.readingLabel(story.readingMinutes)
    }
}

// MARK: - سطر اليوم

/// هجري · ميلادي يمينًا، ونقطة خضراء نابضة بعنوان «تغطية مستمرة» يسارًا — بلا كبسولة.
struct DayStrip: View {
    @State private var pulse = false

    var body: some View {
        HStack(spacing: 10) {
            Text(ElmFormat.todayStrip())
                .font(ElmFonts.text(size: 12, relativeTo: .caption))
                .foregroundStyle(ElmTheme.ink3)
                .elmLatin()
                .lineLimit(1)
                .minimumScaleFactor(0.75)
            Spacer(minLength: 6)
            HStack(spacing: 6) {
                Circle()
                    .fill(ElmTheme.success)
                    .frame(width: 7, height: 7)
                    .opacity(pulse ? 1 : 0.35)
                    .accessibilityHidden(true)
                Text("تغطية مستمرة")
                    .font(ElmFonts.text(size: 11.5, weight: .bold, relativeTo: .caption2))
                    .foregroundStyle(ElmTheme.ink2)
            }
            .fixedSize()
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(ElmFormat.todayStrip())، تغطية مستمرة")
        .onAppear {
            withAnimation(.easeInOut(duration: 1.1).repeatForever(autoreverses: true)) { pulse = true }
        }
    }
}

// MARK: - العاجل

/// شريط رقيق كما في الويب: تدرّج قرمزي خافت، نقطة نابضة، «عاجل»، ثم العنوان بسطر واحد.
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
                    .frame(width: 8, height: 8)
                    .opacity(pulse ? 1 : 0.3)
                    .accessibilityHidden(true)
                Text("عاجل")
                    .font(ElmFonts.display(size: 11, weight: .heavy, relativeTo: .caption2))
                    .tracking(0.8)
                    .foregroundStyle(ElmTheme.danger)
                    .fixedSize()
                Text(item.title)
                    .font(ElmFonts.text(size: 13, relativeTo: .footnote))
                    .foregroundStyle(ElmTheme.ink)
                    .lineLimit(1)
                    .multilineTextAlignment(.leading)
                Spacer(minLength: 0)
                Image(systemName: "arrow.left")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(ElmTheme.danger.opacity(0.7))
                    .accessibilityHidden(true)
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 10)
            .background(
                LinearGradient(
                    colors: [ElmTheme.danger.opacity(0.12), ElmTheme.danger.opacity(0.05), .clear],
                    startPoint: .leading, endPoint: .trailing
                )
            )
            .overlay(alignment: .top) { Rectangle().fill(ElmTheme.line).frame(height: 1) }
            .overlay(alignment: .bottom) { Rectangle().fill(ElmTheme.line).frame(height: 1) }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("عاجل: \(item.title)")
        .onAppear {
            withAnimation(.easeInOut(duration: 0.9).repeatForever(autoreverses: true)) { pulse = true }
        }
    }
}

// MARK: - سكة السلاسل

/// سكة الويب لا الكبسولات: شريط سطح بخطّين شعريين، وداخله نقطة 7px ملوّنة واسم السلسلة.
struct SeriesBelt: View {
    let series: [SeriesChip]

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 22) {
                ForEach(series) { item in
                    NavigationLink {
                        SeriesFeedScreen(chip: item)
                    } label: {
                        HStack(spacing: 7) {
                            Circle()
                                .fill(ElmTheme.hex(item.color))
                                .frame(width: 7, height: 7)
                            Text(item.name)
                                .font(ElmFonts.text(size: 12.5, weight: .semibold, relativeTo: .footnote))
                                .foregroundStyle(ElmTheme.ink2)
                                .lineLimit(1)
                                .fixedSize()
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("سلسلة \(item.name)")
                }
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 11)
        }
        .background(ElmTheme.surface)
        .overlay(alignment: .top) { Rectangle().fill(ElmTheme.line).frame(height: 1) }
        .overlay(alignment: .bottom) { Rectangle().fill(ElmTheme.line).frame(height: 1) }
    }
}

// MARK: - منطقة الصدارة

/// «منطقة الصدارة» كما في الويب: بلوك واحد محدود بخطّي بنية علويّ وسفليّ (line2)،
/// الصدارة نصّ على الورق لا فوق الصورة، ثم الموجز يفصله خط بنية مُزاح عن الحدّين.
struct LeadRegion: View {
    let hero: StoryCard
    let brief: [BriefItem]
    /// مواد الرئيسية المرتبطة — لاستعادة لون/اسم السلسلة إن سقطت من عقد الموجز.
    var related: [StoryCard] = []
    var onStories: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            leadStory
            if !brief.isEmpty {
                Rectangle()
                    .fill(ElmTheme.line2)
                    .frame(height: 1)
                    .padding(.horizontal, 18)
                briefing
            }
        }
        .overlay(alignment: .top) { Rectangle().fill(ElmTheme.line2).frame(height: 1) }
        .overlay(alignment: .bottom) { Rectangle().fill(ElmTheme.line2).frame(height: 1) }
    }

    private var leadStory: some View {
        NavigationLink {
            StoryDestination(seed: hero)
        } label: {
            VStack(alignment: .leading, spacing: 0) {
                Color.clear
                    .aspectRatio(16 / 10, contentMode: .fit)
                    .overlay { RemoteImage(url: hero.imageURL) }
                    .clipShape(RoundedRectangle(cornerRadius: ElmTheme.radiusUI, style: .continuous))

                KickerBar(label: kicker, color: seriesColor, trailing: ElmFormat.sectionName(hero.section))
                    .padding(.top, 14)

                Text(hero.title)
                    .font(ElmFonts.display(size: 23, weight: .heavy, relativeTo: .title2))
                    .foregroundStyle(ElmTheme.ink)
                    .multilineTextAlignment(.leading)
                    .lineSpacing(6)
                    .padding(.top, 9)

                if !hero.excerpt.isEmpty {
                    Text(hero.excerpt)
                        .font(ElmFonts.text(size: 14, relativeTo: .callout))
                        .foregroundStyle(ElmTheme.ink2)
                        .multilineTextAlignment(.leading)
                        .lineSpacing(7)
                        .lineLimit(3)
                        .padding(.top, 8)
                }

                StoryMetaLine(story: hero)
                    .padding(.top, 9)
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 16)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(kicker)، \(hero.title)")
    }

    private var briefing: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 8) {
                RoundedRectangle(cornerRadius: 1.5, style: .continuous)
                    .fill(ElmTheme.gold)
                    .frame(width: 20, height: 4)
                    .accessibilityHidden(true)
                Text("موجز العلم")
                    .font(ElmFonts.display(size: 16.5, weight: .heavy, relativeTo: .headline))
                    .foregroundStyle(ElmTheme.ink)
                Spacer(minLength: 6)
                Button(action: onStories) {
                    HStack(spacing: 5) {
                        Text("شاهد كقصص")
                        Image(systemName: "arrow.left").font(.system(size: 9, weight: .bold))
                    }
                    .font(ElmFonts.text(size: 12, weight: .bold, relativeTo: .caption))
                    .foregroundStyle(ElmTheme.accent)
                    .fixedSize()
                }
                .buttonStyle(.plain)
                .accessibilityLabel("شاهد الموجز كقصص")
            }

            ForEach(Array(brief.prefix(3).enumerated()), id: \.element.id) { index, item in
                briefRow(item, first: index == 0)
            }
        }
        .padding(.horizontal, 18)
        .padding(.top, 16)
        .padding(.bottom, 18)
    }

    private func briefRow(_ item: BriefItem, first: Bool) -> some View {
        let color = accent(for: item)
        let label = seriesLabel(for: item)
        return NavigationLink {
            StoryDestination(seed: StoryCard(
                id: item.href, slug: item.href, section: "news",
                title: item.title, excerpt: "", eyebrow: label, href: item.href
            ))
        } label: {
            VStack(alignment: .leading, spacing: 6) {
                KickerBar(label: label, color: color, barWidth: 10)
                Text(item.title)
                    .font(ElmFonts.text(size: 14, weight: .bold, relativeTo: .subheadline))
                    .foregroundStyle(ElmTheme.ink)
                    .multilineTextAlignment(.leading)
                    .lineSpacing(5)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.top, first ? 14 : 16)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(label)، \(item.title)")
    }

    private var kicker: String {
        if !hero.eyebrow.isEmpty { return hero.eyebrow }
        if let series = hero.series, let name = SeriesPalette.active.first(where: { $0.id == series })?.name {
            return name
        }
        return ElmFormat.sectionName(hero.section)
    }

    private var seriesColor: Color {
        hero.series.map(SeriesPalette.color(for:)) ?? ElmTheme.gold
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
}

// MARK: - صفوف السياق (المصغّرات)

/// صف الويب `ctx-row`: نص أولًا ومصغّرة 4:3 بعرض 92 وزاوية 4 — يفصل الصفوف خط شعري.
struct MiniStoryRow: View {
    let story: StoryCard
    var first: Bool = false

    var body: some View {
        NavigationLink {
            StoryDestination(seed: story)
        } label: {
            VStack(alignment: .leading, spacing: 0) {
                if !first {
                    Rectangle().fill(ElmTheme.line).frame(height: 1)
                }
                HStack(alignment: .top, spacing: 12) {
                    VStack(alignment: .leading, spacing: 5) {
                        KickerBar(label: kicker, color: color, barWidth: 9)
                        Text(story.title)
                            .font(ElmFonts.text(size: 13.5, weight: .bold, relativeTo: .footnote))
                            .foregroundStyle(ElmTheme.ink)
                            .multilineTextAlignment(.leading)
                            .lineSpacing(4)
                            .lineLimit(2)
                        StoryMetaLine(story: story)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)

                    RemoteImage(url: story.imageURL, height: 69, maxPixel: 320)
                        .frame(width: 92)
                        .clipShape(RoundedRectangle(cornerRadius: ElmTheme.radiusUI, style: .continuous))
                }
                .padding(.vertical, 13)
            }
            .contentShape(Rectangle())
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
}

/// بلاطة وسائط بأسلوب الويب: مصغّرة 16:9 بزاوية 4، ثم كيكر وعنوان على الورق — بلا سكريم.
struct StoryTile: View {
    let story: StoryCard
    var tall: Bool = false

    var body: some View {
        NavigationLink {
            StoryDestination(seed: story)
        } label: {
            VStack(alignment: .leading, spacing: 0) {
                Color.clear
                    .aspectRatio(16 / 9, contentMode: .fit)
                    .overlay { RemoteImage(url: story.imageURL) }
                    .clipShape(RoundedRectangle(cornerRadius: ElmTheme.radiusUI, style: .continuous))
                KickerBar(label: kicker, color: color, barWidth: 11)
                    .padding(.top, 10)
                Text(story.title)
                    .font(ElmFonts.text(size: 15, weight: .bold, relativeTo: .subheadline))
                    .foregroundStyle(ElmTheme.ink)
                    .multilineTextAlignment(.leading)
                    .lineSpacing(5)
                    .lineLimit(3)
                    .padding(.top, 7)
            }
            .contentShape(Rectangle())
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

// MARK: - سؤال الأسبوع

/// لوح «لماذا» من الويب: غسل سماوي 4٪، شرطة 3px بلون السلسلة أعلاه، وشارة بنقطة.
struct WhyPanel: View {
    let question: QuestionItem

    private var tint: Color { SeriesPalette.color(for: "limatha") }

    var body: some View {
        NavigationLink {
            StoryDestination(seed: question.asCard)
        } label: {
            VStack(alignment: .leading, spacing: 0) {
                HStack(spacing: 6) {
                    Circle().fill(tint).frame(width: 6, height: 6).accessibilityHidden(true)
                    Text(question.kick.isEmpty ? "سؤال الأسبوع" : question.kick)
                        .font(ElmFonts.text(size: 11.5, weight: .bold, relativeTo: .caption2))
                        .foregroundStyle(tint)
                }
                Text(question.title)
                    .font(ElmFonts.display(size: 17, weight: .heavy, relativeTo: .headline))
                    .foregroundStyle(ElmTheme.ink)
                    .multilineTextAlignment(.leading)
                    .lineSpacing(5)
                    .padding(.top, 9)
                Text(question.text)
                    .font(ElmFonts.text(size: 13.5, relativeTo: .footnote))
                    .foregroundStyle(ElmTheme.ink2)
                    .multilineTextAlignment(.leading)
                    .lineSpacing(6)
                    .lineLimit(3)
                    .padding(.top, 7)
                HStack(spacing: 6) {
                    Text("اقرأ التحليل")
                        .font(ElmFonts.text(size: 12.5, weight: .bold, relativeTo: .caption))
                    Image(systemName: "arrow.left").font(.system(size: 10, weight: .bold))
                }
                .foregroundStyle(tint)
                .padding(.top, 12)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(18)
            .background(
                LinearGradient(
                    colors: [tint.opacity(0.06), ElmTheme.surface.opacity(0)],
                    startPoint: .top, endPoint: .bottom
                )
            )
            .overlay(alignment: .top) { Rectangle().fill(tint).frame(height: 3) }
            .overlay(
                Rectangle().stroke(ElmTheme.line, lineWidth: 1)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(question.kick)، \(question.title)")
    }
}

// MARK: - بالأرقام

/// بلوك «الأرقام» يكسر إيقاع المسطرة عمدًا: غسل ذهبي خفيف وزاوية 26 وبلا فواصل داخلية.
struct NumbersRail: View {
    let stats: [NumberStat]

    private let columns = [
        GridItem(.flexible(), spacing: 24, alignment: .topLeading),
        GridItem(.flexible(), spacing: 24, alignment: .topLeading),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            SectionHead(title: "بالأرقام", subtitle: "كل رقم يحيل لمصدره")

            LazyVGrid(columns: columns, alignment: .leading, spacing: 22) {
                ForEach(stats.prefix(4)) { stat in
                    VStack(alignment: .leading, spacing: 6) {
                        HStack(alignment: .firstTextBaseline, spacing: 2) {
                            Text(ElmFormat.latinDigits(stat.value))
                                .font(ElmFonts.display(size: 32, weight: .semibold, relativeTo: .title))
                                .foregroundStyle(ElmTheme.ink)
                            if let suffix = stat.suffix, !suffix.isEmpty {
                                Text(ElmFormat.latinDigits(suffix))
                                    .font(ElmFonts.display(size: 15, weight: .bold, relativeTo: .subheadline))
                                    .foregroundStyle(ElmTheme.gold)
                            }
                        }
                        .elmLatin()
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)

                        Text(stat.label)
                            .font(ElmFonts.text(size: 12.5, relativeTo: .caption))
                            .foregroundStyle(ElmTheme.ink2)
                            .multilineTextAlignment(.leading)
                            .lineSpacing(4)
                            .lineLimit(3)
                    }
                    .accessibilityElement(children: .combine)
                    .accessibilityLabel("\(stat.value) \(stat.suffix ?? "")، \(stat.label)")
                }
            }
            .padding(20)
            .background {
                RoundedRectangle(cornerRadius: ElmTheme.radiusLg, style: .continuous)
                    .fill(ElmTheme.surface2)
                    .overlay(
                        RoundedRectangle(cornerRadius: ElmTheme.radiusLg, style: .continuous)
                            .fill(ElmTheme.gold.opacity(0.04))
                    )
            }
            .padding(.top, 16)
        }
    }
}

// MARK: - الأكثر قراءة

/// ترتيب الويب: أرقام شبحية 01–05 بوزن خفيف تفصل الصفوف بدل أي إطارات.
struct MostReadList: View {
    let stories: [StoryCard]

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            SectionHead(title: "الأكثر قراءة", subtitle: "مواد أخرى تستحق الانتباه")

            VStack(spacing: 0) {
                ForEach(Array(stories.prefix(5).enumerated()), id: \.element.id) { index, story in
                    if index > 0 {
                        Rectangle().fill(ElmTheme.line).frame(height: 1)
                    }
                    NavigationLink {
                        StoryDestination(seed: story)
                    } label: {
                        HStack(alignment: .top, spacing: 14) {
                            Text(ElmFormat.twoDigit(index + 1))
                                .font(ElmFonts.display(size: 22, weight: .light, relativeTo: .title3))
                                .foregroundStyle(ElmTheme.ink3)
                                .elmLatin()
                                .frame(width: 34, alignment: .leading)
                            VStack(alignment: .leading, spacing: 4) {
                                KickerBar(label: kicker(story), color: color(story), barWidth: 9)
                                Text(story.title)
                                    .font(ElmFonts.text(size: 13.5, weight: .bold, relativeTo: .footnote))
                                    .foregroundStyle(ElmTheme.ink)
                                    .multilineTextAlignment(.leading)
                                    .lineSpacing(4)
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

    private func color(_ story: StoryCard) -> Color {
        story.series.map(SeriesPalette.color(for:)) ?? ElmTheme.accent
    }
}

// MARK: - ختام الرئيسية

/// القطع التونالي الحاد من الويب: كحلي شبه أسود يفتتحه خط الطيف الثماني بسماكة 3.
struct HomeFooter: View {
    private let paperDark = ElmTheme.hex("060e1a")
    private let mist = ElmTheme.hex("9ab0cc")

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Rectangle()
                .fill(ElmTheme.spectrumGradient)
                .frame(height: 3)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 12) {
                Text("العلم")
                    .font(ElmFonts.display(size: 26, weight: .heavy, relativeTo: .title2))
                    .foregroundStyle(.white)
                Text("صحافة سياق · بيانات موثقة · بلا ضوضاء")
                    .font(ElmFonts.text(size: 12.5, weight: .medium, relativeTo: .caption))
                    .foregroundStyle(mist)
                Rectangle()
                    .fill(.white.opacity(0.08))
                    .frame(height: 1)
                    .padding(.vertical, 6)
                Text("المعرفة بسلاسة — تصدر من الرياض")
                    .font(ElmFonts.text(size: 12, relativeTo: .caption2))
                    .foregroundStyle(mist.opacity(0.75))
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 18)
            .padding(.top, 26)
            .padding(.bottom, 30)
        }
        .background(paperDark)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("العلم — صحافة سياق، بيانات موثقة، بلا ضوضاء")
    }
}

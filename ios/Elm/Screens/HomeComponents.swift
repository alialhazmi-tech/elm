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
            if let trailing, !trailing.isEmpty, trailing != label {
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

/// التاريخ والتغطية يتراصان رأسيًا عند تكبير النص.
struct DayStrip: View {
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        let layout = typeSize.isAccessibilitySize
            ? AnyLayout(VStackLayout(alignment: .leading, spacing: 8))
            : AnyLayout(HStackLayout(spacing: 10))
        layout {
            Text(ElmFormat.todayStrip())
                .font(ElmFonts.text(size: 12, relativeTo: .caption))
                .foregroundStyle(ElmTheme.ink3)
                .fixedSize(horizontal: false, vertical: true)
            if !typeSize.isAccessibilitySize { Spacer(minLength: 6) }
            Label {
                Text("تغطية مستمرة")
                    .font(ElmFonts.text(size: 11.5, weight: .bold, relativeTo: .caption2))
                    .foregroundStyle(ElmTheme.ink2)
            } icon: {
                Circle().fill(ElmTheme.success).frame(width: 7, height: 7)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
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
                            .font(ElmFonts.text(size: 16, weight: .semibold, relativeTo: .body))
                            .foregroundStyle(ElmTheme.ink)
                            .multilineTextAlignment(.leading)
                            .lineSpacing(4)
                            .lineLimit(3)
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

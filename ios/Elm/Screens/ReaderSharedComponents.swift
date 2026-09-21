import SwiftUI
import SafariServices
import AVFoundation

/// Canonical web pages that do not yet have a native destination.
struct PublicPageLink<Label: View>: View {
    let path: String
    @ViewBuilder var label: () -> Label
    @State private var presented = false
    var body: some View {
        Button { presented = true } label: { label() }
            .buttonStyle(.plain)
            .sheet(isPresented: $presented) {
                SafariSheet(url: URLConstants.publicURL(path: path)).ignoresSafeArea()
            }
    }
}

/// Safari داخل التطبيق لأي رابط خارجي — الروابط الداخلية تُوجَّه أصلًا عبر `ElmLinks`.
struct SafariSheet: UIViewControllerRepresentable {
    let url: URL
    func makeUIViewController(context: Context) -> SFSafariViewController {
        let safe = ["http", "https"].contains(url.scheme?.lowercased() ?? "") ? url : URLConstants.publicSite
        return SFSafariViewController(url: safe)
    }
    func updateUIViewController(_ controller: SFSafariViewController, context: Context) {}
}

/// عنصر قابل للعرض في `.sheet(item:)` — `URL` ليست Identifiable.
struct SafariItem: Identifiable {
    let url: URL
    var id: String { url.absoluteString }
}

struct HomeNewsStrip: View {
    let items: [NewsStripItem]
    @State private var index = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.dynamicTypeSize) private var typeSize
    var body: some View {
        if !items.isEmpty {
            let item = items[index % items.count]
            let urgent = item.isUrgentNow
            NavigationLink {
                StoryDestination(seed: StoryCard(id: item.href, slug: item.href, section: "news", title: item.title, excerpt: "", eyebrow: item.label ?? "", href: item.href))
            } label: {
                HStack(spacing: 8) {
                    Circle().fill(urgent ? ElmTheme.danger : ElmTheme.success).frame(width: 7, height: 7)
                        .accessibilityHidden(true)
                    Text(urgent ? "عاجل" : "الأحدث")
                        .font(ElmFonts.text(.caption, weight: .bold))
                        .foregroundStyle(urgent ? ElmTheme.danger : ElmTheme.navyInk)
                    Text(item.title).font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink)
                        .lineLimit(typeSize.isAccessibilitySize ? nil : 1)
                        .id(item.id)
                        .transition(reduceMotion ? .identity : .opacity)
                    Spacer(minLength: 0)
                }
                .frame(minHeight: 40)
                .padding(.horizontal, 18)
                .background(ElmTheme.surface3)
                .animation(reduceMotion ? nil : .easeInOut(duration: 0.25), value: index)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("\(urgent ? "عاجل" : "الأحدث"): \(item.title)")
            .accessibilityHint(items.count > 1 ? "\(ElmFormat.latinDigits(String(items.count))) عناوين تتناوب" : "")
            .task(id: items.map(\.id)) {
                index = 0
                guard !reduceMotion, items.count > 1 else { return }
                while !Task.isCancelled {
                    do { try await Task.sleep(for: .seconds(6)) } catch { return }
                    index = (index + 1) % items.count
                }
            }
        }
    }
}

struct StoryCategoryLabel: View {
    let story: StoryCard
    var body: some View {
        HStack(spacing: 7) {
            if let series = story.series, let swatch = SeriesPalette.active.first(where: { $0.id == series }) {
                Circle().fill(swatch.color).frame(width: 6, height: 6)
                Text(swatch.name).foregroundStyle(swatch.color)
                Text(ElmFormat.sectionName(story.section)).foregroundStyle(ElmTheme.ink3)
            } else {
                Text(ElmFormat.sectionName(story.section)).foregroundStyle(ElmTheme.ink2)
            }
        }
        .font(ElmFonts.text(.caption, weight: .semibold))
    }
}

struct HomeBriefCard: View {
    let items: [BriefItem]
    let presentation: HomePresentation?
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 6) {
                Text("✦").foregroundStyle(ElmTheme.gold)
                Text("موجز العلم").font(ElmFonts.display(.headline, weight: .heavy)).foregroundStyle(ElmTheme.ink)
            }
            if let count = presentation?.briefFrom {
                // كما على الويب: «تحديث منذ N، مختار من M» — التحديث من أحدث مادة في الموجز.
                let latest = items.compactMap(\.publishedAt).sorted().last
                let updated = ElmFormat.relativeTime(latest).map { "تحديث \($0)، " } ?? ""
                Text("\(updated)مختار من \(ElmFormat.latinDigits(String(count))) مادة منشورة في أرشيفنا")
                    .font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink3)
            }
            HomeBriefListen().id(presentation?.briefScript ?? items.map(\.title).joined())
            ForEach(Array(items.prefix(5).enumerated()), id: \.element.id) { index, item in
                Rectangle().fill(ElmTheme.line).frame(height: 1)
                NavigationLink {
                    StoryDestination(seed: StoryCard(id: item.href, slug: item.href, section: "news", title: item.title, excerpt: "", eyebrow: item.label, href: item.href))
                } label: {
                    HStack(alignment: .top, spacing: 10) {
                        Text(String(index + 1)).font(ElmFonts.text(.footnote, weight: .bold))
                            .foregroundStyle(ElmTheme.navyInk).frame(width: 18)
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(item.label).foregroundStyle(ElmTheme.hex(item.color))
                                if let time = ElmFormat.relativeTime(item.publishedAt) { Text(time).foregroundStyle(ElmTheme.ink3) }
                            }.font(ElmFonts.text(.caption))
                            Text(item.title).font(ElmFonts.text(size: 14, weight: .medium, relativeTo: .body))
                                .foregroundStyle(ElmTheme.ink).fixedSize(horizontal: false, vertical: true)
                        }.frame(maxWidth: .infinity, alignment: .leading)
                    }
                }.buttonStyle(.plain)
            }
            Divider()
            Text("لماذا هذه المواد؟ مختارات آلية من أحدث المواد عبر الأقسام. كل عنوان يحيل إلى مادته المنشورة.")
                .font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink3)
            if let script = presentation?.briefScript, !script.isEmpty {
                DisclosureGroup("نص النشرة الصوتية") {
                    Text(script).font(ElmFonts.text(.footnote)).foregroundStyle(ElmTheme.ink2).padding(.top, 8)
                }.font(ElmFonts.text(.footnote, weight: .semibold)).tint(ElmTheme.navyInk)
            }
        }
        .padding(18).background(ElmTheme.surface, in: RoundedRectangle(cornerRadius: 22))
        .overlay(RoundedRectangle(cornerRadius: 22).stroke(ElmTheme.line, lineWidth: 1))
    }
}

private struct HomeBriefListen: View {
    var body: some View {
        // يستمر صوت الموجز أثناء التصفح — الشريط المصغّر العالمي في RootTabView يعرضه.
        SummaryListenView(kind: .home)
    }
}

/// صيغ القارئ التي لا تملكها `ElmFormat`: طابع النشر «d MMMM yyyy، HH:mm» ميلاديًا بتوقيت الرياض وبأرقام لاتينية.
enum ElmReaderFormat {
    static func articleTimestamp(_ iso: String?) -> String? {
        guard let date = ElmDates.parse(iso) else { return nil }
        var cal = Calendar(identifier: .gregorian)
        cal.locale = Locale(identifier: "ar_SA")
        cal.timeZone = TimeZone(identifier: "Asia/Riyadh") ?? .current
        let formatter = DateFormatter()
        formatter.calendar = cal
        formatter.timeZone = cal.timeZone
        formatter.locale = Locale(identifier: "ar_SA@numbers=latn")
        formatter.dateFormat = "d MMMM yyyy، HH:mm"
        return ElmFormat.latinDigits(formatter.string(from: date))
    }

    /// الموجز التحريري كما في `formatArticleDek` على الويب: مسافات مطوية وبلا نقاط ختامية.
    static func articleDek(_ excerpt: String) -> String {
        let collapsed = excerpt.split(whereSeparator: \.isWhitespace).joined(separator: " ")
        var scalars = Array(collapsed.unicodeScalars)
        while let last = scalars.last, last == "." || last == "…" || CharacterSet.whitespaces.contains(last) { scalars.removeLast() }
        return String(String.UnicodeScalarView(scalars)).trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// الموجز مقصوص عند 200 حرف على حدود الكلمات كما في `trimExcerpt` على الويب.
    static func trimExcerpt(_ text: String, limit: Int = 200) -> String {
        let clean = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard clean.count > limit else { return clean }
        let cut = String(clean.prefix(limit))
        let trimmed = cut.lastIndex(of: " ").map { String(cut[..<$0]) } ?? cut
        return trimmed.trimmingCharacters(in: .whitespacesAndNewlines) + "…"
    }
}

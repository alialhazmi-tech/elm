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
            NavigationLink {
                StoryDestination(seed: StoryCard(id: item.href, slug: item.href, section: "news", title: item.title, excerpt: "", eyebrow: "", href: item.href))
            } label: {
                HStack(spacing: 8) {
                    Circle().fill(item.urgent ? ElmTheme.danger : ElmTheme.success).frame(width: 7, height: 7)
                    Text("الأحدث").font(ElmFonts.text(.caption, weight: .bold)).foregroundStyle(ElmTheme.navyInk)
                    Text(item.title).font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink)
                        .lineLimit(typeSize.isAccessibilitySize ? nil : 1)
                    Spacer(minLength: 0)
                }
                .frame(minHeight: 40)
                .padding(.horizontal, 18)
                .background(ElmTheme.surface3)
            }
            .buttonStyle(.plain)
            .task(id: items.map(\.id)) {
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
                Text("مختار من \(count) مادة منشورة في أرشيفنا")
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
    @State private var player: AVAudioPlayer?
    @State private var loading = false
    @State private var error: String?
    @State private var task: Task<Void, Never>?
    @Environment(NarrationStore.self) private var narration
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            TimelineView(.periodic(from: .now, by: 1)) { _ in
                Button {
                    if loading { task?.cancel(); loading = false; return }
                    if let player {
                        if player.isPlaying { player.pause() } else { player.play() }
                        return
                    }
                    narration.stop()
                    loading = true; error = nil
                    task = Task { await load() }
                } label: {
                    HStack(spacing: 12) {
                        Image(systemName: loading ? "stop.fill" : player?.isPlaying == true ? "pause.fill" : "play.fill")
                            .foregroundStyle(.white).frame(width: 44, height: 44).background(ElmTheme.navy, in: Circle())
                        Text(loading ? "جارٍ تجهيز الصوت…" : player?.isPlaying == true ? "إيقاف مؤقت" : "استمع للموجز")
                            .font(ElmFonts.text(.subheadline, weight: .semibold)).foregroundStyle(ElmTheme.navyInk)
                    }
                }.buttonStyle(.plain)
            }
            if player != nil {
                Text("تم توليد الصوت عبر HUMAIN").font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink3)
            }
            if let error { Text(error).font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink2) }
        }
        .onDisappear { task?.cancel(); player?.stop(); loading = false }
    }
    @MainActor private func load() async {
        defer { loading = false }
        var request = URLRequest(url: URLConstants.contentAPI.appending(path: "api/content/listen"))
        request.httpMethod = "POST"
        request.timeoutInterval = 115
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(URLConstants.contentAPI.absoluteString, forHTTPHeaderField: "Origin")
        request.httpBody = Data(#"{"kind":"home"}"#.utf8)
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            try Task.checkCancellation()
            guard let response = response as? HTTPURLResponse,
                  response.statusCode == 200, response.mimeType == "audio/wav" else {
                error = "تعذر تجهيز الصوت الآن. حاول مرة أخرى."; return
            }
            let audio = try AVAudioPlayer(data: data)
            guard audio.prepareToPlay(), audio.play() else { error = "تعذر تشغيل الصوت."; return }
            player = audio
        } catch is CancellationError { return }
        catch { if !Task.isCancelled { self.error = "تعذر تجهيز الصوت الآن. حاول مرة أخرى." } }
    }
}

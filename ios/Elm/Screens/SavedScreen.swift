import SwiftUI

/// 1h — المحفوظات والتنزيلات: حالة كل مادة، وحجم الحزمة، ومفتاح التنزيل التلقائي.
struct SavedScreen: View {
    @Environment(LibraryStore.self) private var library
    @Environment(ReadingStore.self) private var reading
    @State private var tab: SavedTab = .all

    private enum SavedTab: String, CaseIterable, Identifiable {
        case all, offline, later
        var id: String { rawValue }
        var label: String {
            switch self {
            case .all: "الكل"
            case .offline: "متاح بلا اتصال"
            case .later: "لاحقًا"
            }
        }
    }

    private var items: [StoryCard] {
        switch tab {
        case .all: library.items
        case .offline: library.items.filter { AppCache.loadStory(id: $0.apiId) != nil }
        case .later: library.items.filter { AppCache.loadStory(id: $0.apiId) == nil }
        }
    }

    var body: some View {
        ElmScreen(title: "المحفوظات", showBack: true) {
            VStack(alignment: .leading, spacing: 0) {
                Text("المحفوظات")
                    .font(ElmFonts.display(.title, weight: .heavy))
                    .foregroundStyle(ElmTheme.ink)

                HStack(spacing: 7) {
                    ForEach(SavedTab.allCases) { item in
                        ElmChip(label: item.label, selected: tab == item) { tab = item }
                    }
                    Spacer(minLength: 0)
                }
                .padding(.top, 12)

                autoDownloadRow.padding(.top, 14)
                if let notice = library.mergeNotice {
                    HStack(spacing: 10) {
                        Label(notice, systemImage: "checkmark.circle.fill")
                            .font(ElmFonts.text(.footnote, weight: .medium))
                            .foregroundStyle(ElmTheme.ink)
                        Spacer(minLength: 0)
                        Button { library.dismissMergeNotice() } label: {
                            Image(systemName: "xmark").font(.system(size: 11, weight: .semibold)).foregroundStyle(ElmTheme.ink3).frame(width: 32, height: 32)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("إخفاء الإشعار")
                    }
                    .padding(.horizontal, 12).padding(.vertical, 8)
                    .background(ElmTheme.success.opacity(0.10), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .padding(.top, 10)
                }
                if let error = library.syncError {
                    VStack(alignment: .leading, spacing: 8) {
                        Label(error, systemImage: "wifi.slash").font(ElmFonts.text(.footnote)).foregroundStyle(ElmTheme.ink2).lineSpacing(3)
                        Button("إعادة المحاولة") { Task { await library.synchronize() } }
                            .font(ElmFonts.text(.footnote, weight: .semibold)).frame(minHeight: 44)
                    }
                    .padding(12).frame(maxWidth: .infinity, alignment: .leading)
                    .background(ElmTheme.surface2, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .padding(.top, 10)
                }

                if items.isEmpty {
                    emptyState.padding(.top, 30)
                } else {
                    VStack(spacing: 10) {
                        ForEach(items) { story in
                            row(story)
                        }
                    }
                    .padding(.top, 12)
                }
            }
            .padding(.horizontal, 18)
            .padding(.top, 16)
        }
        .task { await library.synchronize() }
        .refreshable { await library.synchronize() }
    }

    private var autoDownloadRow: some View {
        HStack(spacing: 11) {
            Image(systemName: "arrow.down")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(ElmTheme.tealInk)
                .frame(width: 36, height: 36)
                .background(ElmTheme.teal.opacity(0.14), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            VStack(alignment: .leading, spacing: 2) {
                Text("التنزيل التلقائي")
                    .font(ElmFonts.text(.footnote, weight: .bold))
                    .foregroundStyle(ElmTheme.ink)
                Text(bundleLine)
                    .font(ElmFonts.text(.caption2))
                    .foregroundStyle(ElmTheme.ink3)
            }
            Spacer(minLength: 0)
            ElmToggle(isOn: reading.autoDownload) { reading.autoDownload.toggle() }
                .accessibilityLabel("التنزيل التلقائي")
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 13)
        .elmCard(radius: 14, elevated: false)
    }

    private var bundleLine: String {
        let count = library.items.count
        let offline = library.items.filter { AppCache.loadStory(id: $0.apiId) != nil }.count
        if count == 0 { return "موجز اليوم فقط — لم تحفظ موادّ بعد" }
        return "موجز اليوم + \(ElmFormat.materialLabel(count)) · \(ElmFormat.latinDigits(String(offline))) جاهزة بلا اتصال"
    }

    private func row(_ story: StoryCard) -> some View {
        let offline = AppCache.loadStory(id: story.apiId) != nil
        return NavigationLink {
            StoryDestination(seed: story)
        } label: {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 0) {
                    Text(kicker(story))
                        .font(ElmFonts.text(.caption2, weight: .bold))
                        .foregroundStyle(story.series.map(SeriesPalette.color(for:)) ?? ElmTheme.accent)
                    Text(story.title)
                        .font(ElmFonts.text(.footnote))
                        .foregroundStyle(ElmTheme.ink)
                        .multilineTextAlignment(.leading)
                        .lineLimit(3)
                        .padding(.top, 4)
                    HStack(spacing: 5) {
                        Image(systemName: offline ? "arrow.down.circle.fill" : "clock")
                            .font(.system(size: 10, weight: .semibold))
                        Text(offline
                             ? "متاح بلا اتصال · \(ElmFormat.readingLabel(story.readingMinutes))"
                             : "محفوظ للقراءة لاحقًا · \(ElmFormat.readingLabel(story.readingMinutes))")
                    }
                    .font(ElmFonts.text(.caption2))
                    .foregroundStyle(offline ? ElmTheme.tealInk : ElmTheme.ink3)
                    .padding(.top, 6)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                Button { library.toggle(story) } label: {
                    Image(systemName: "bookmark.slash")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(ElmTheme.ink3)
                        .frame(width: 30, height: 30)
                        .background(ElmTheme.surface2, in: Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("إزالة من المحفوظات")
            }
            .padding(12)
            .elmCard(radius: 16, elevated: false)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(story.title)
    }

    private var emptyState: some View {
        VStack(spacing: 14) {
            Image(systemName: "bookmark")
                .font(.system(size: 34, weight: .light))
                .foregroundStyle(ElmTheme.accent)
                .frame(width: 96, height: 96)
                .background(ElmTheme.surface2, in: Circle())
            Text("مكتبتك تنتظرك")
                .font(ElmFonts.display(.title3, weight: .heavy))
                .foregroundStyle(ElmTheme.ink)
            Text("احفظ أي مادة من زر الإشارة أثناء القراءة. وبعد فتحها مرة، تعود إليها حتى بلا اتصال.")
                .font(ElmFonts.text(.footnote))
                .foregroundStyle(ElmTheme.ink2)
                .multilineTextAlignment(.center)
                .lineSpacing(4)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 30)
    }

    private func kicker(_ story: StoryCard) -> String {
        story.series.flatMap { slug in SeriesPalette.active.first { $0.id == slug }?.name }
            ?? (story.eyebrow.isEmpty ? ElmFormat.sectionName(story.section) : story.eyebrow)
    }
}

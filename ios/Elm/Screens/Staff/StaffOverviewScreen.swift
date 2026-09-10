import SwiftUI

/// نظرة اليوم — نظير `app/tahrir/(app)/page.tsx`: العدّادات، طابور الاعتماد، آخر المنشور، الجدولة.
struct StaffOverviewScreen: View {
    @Environment(StaffSessionStore.self) private var staff
    var unread: Int = 0
    @State private var payload: StaffOverviewPayload?
    @State private var error: ElmAPIError?
    @State private var loading = false

    var body: some View {
        StaffScreen(title: "نظرة اليوم", onRefresh: { await load() }) {
            VStack(alignment: .leading, spacing: 22) {
                greeting
                if let payload {
                    tiles(payload)
                    attention(payload)
                    if let review = payload.review, !review.isEmpty {
                        panel("طابور الاعتماد", detail: StaffFormat.storiesCount(payload.counts?["review"] ?? review.count)) {
                            ForEach(review) { row in storyLink(row) }
                        }
                    }
                    if let scheduled = payload.scheduled, !scheduled.isEmpty {
                        panel("مجدولة للنشر", detail: payload.nextScheduledAt.map { "الأقرب \(StaffFormat.smart($0))" }) {
                            ForEach(scheduled.prefix(6)) { row in storyLink(row) }
                        }
                    }
                    if let drafts = payload.latestDraft, !drafts.isEmpty {
                        panel("آخر المسودات") { ForEach(drafts) { row in storyLink(row) } }
                    }
                    if let published = payload.latestPublished, !published.isEmpty {
                        panel("آخر ما نُشر") { ForEach(published.prefix(8)) { row in storyLink(row) } }
                    }
                    if let perDay = payload.perDay, !perDay.isEmpty { rhythm(perDay) }
                } else if let error {
                    StaffErrorView(error: error) { Task { await load() } }
                } else {
                    ProgressView("جارٍ تحميل النظرة").frame(maxWidth: .infinity).padding(40)
                }
            }
            .padding(.horizontal, 18)
            .padding(.top, 10)
        }
        .task { if payload == nil { await load() } }
        .navigationDestination(for: StaffStoryRow.self) { row in StaffStoryScreen(id: row.id, seed: row) }
    }

    private var greeting: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(hourGreeting).font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink3)
            Text(staff.actor?.displayName ?? "").font(ElmFonts.display(.title2, weight: .heavy)).foregroundStyle(ElmTheme.ink)
            Text(ElmFormat.todayStrip()).font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink2)
        }
    }

    private var hourGreeting: String {
        let hour = Calendar.current.component(.hour, from: Date())
        return hour >= 5 && hour < 12 ? "صباح المعرفة" : "مساء المعرفة"
    }

    private func tiles(_ payload: StaffOverviewPayload) -> some View {
        let counts = payload.counts ?? [:]
        let columns = [GridItem(.flexible()), GridItem(.flexible())]
        return LazyVGrid(columns: columns, spacing: 10) {
            StaffStatTile(value: String(payload.todayCount ?? 0), label: "نُشر اليوم", tint: ElmTheme.tealInk)
            StaffStatTile(value: String(counts["review"] ?? 0), label: "بانتظار الاعتماد", tint: ElmTheme.hex("b8760a"))
            StaffStatTile(value: String(counts["scheduled"] ?? 0), label: "مجدولة", tint: ElmTheme.focus)
            StaffStatTile(value: String(counts["draft"] ?? 0), label: "مسودات", tint: ElmTheme.ink2)
        }
    }

    @ViewBuilder
    private func attention(_ payload: StaffOverviewPayload) -> some View {
        let pendingMedia = payload.media?.pending ?? 0
        if unread > 0 || pendingMedia > 0 {
            StaffCard {
                Text("يحتاج انتباهك").font(ElmFonts.text(.caption, weight: .bold)).foregroundStyle(ElmTheme.ink3)
                if unread > 0 {
                    NavigationLink { StaffNotificationsScreen(onRead: nil) } label: {
                        Label("\(ElmFormat.countedNoun(unread, one: "تنبيه واحد", two: "تنبيهان", few: "تنبيهات", many: "تنبيهًا")) غير مقروء", systemImage: "bell.badge")
                            .font(ElmFonts.text(.footnote, weight: .medium)).foregroundStyle(ElmTheme.ink).frame(minHeight: 40)
                    }
                }
                if pendingMedia > 0, staff.can("media.rights") {
                    NavigationLink { StaffMediaScreen(showBack: true, initialFilter: "pending") } label: {
                        Label("\(ElmFormat.countedNoun(pendingMedia, one: "صورة واحدة", two: "صورتان", few: "صور", many: "صورة")) بلا توثيق حقوق", systemImage: "photo.badge.exclamationmark")
                            .font(ElmFonts.text(.footnote, weight: .medium)).foregroundStyle(ElmTheme.ink).frame(minHeight: 40)
                    }
                }
            }
        }
    }

    private func panel<Content: View>(_ title: String, detail: String? = nil, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            StaffSectionTitle(title: title, detail: detail)
            VStack(spacing: 0) { content() }
                .padding(.horizontal, 14)
                .background(ElmTheme.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(ElmTheme.line, lineWidth: 1))
        }
    }

    private func storyLink(_ row: StaffStoryRow) -> some View {
        VStack(spacing: 0) {
            NavigationLink(value: row) { StaffStoryRowView(row: row) }.buttonStyle(.plain)
            Divider().overlay(ElmTheme.line)
        }
    }

    private func rhythm(_ perDay: [StaffPerDay]) -> some View {
        let peak = max(1, perDay.map(\.count).max() ?? 1)
        return VStack(alignment: .leading, spacing: 8) {
            StaffSectionTitle(title: "إيقاع النشر", detail: "آخر \(ElmFormat.latinDigits(String(perDay.count))) يومًا")
            HStack(alignment: .bottom, spacing: 4) {
                ForEach(perDay) { day in
                    VStack(spacing: 3) {
                        RoundedRectangle(cornerRadius: 3, style: .continuous)
                            .fill(day.count == 0 ? ElmTheme.line2 : ElmTheme.navyInk)
                            .frame(height: max(4, CGFloat(day.count) / CGFloat(peak) * 64))
                        Text(ElmFormat.latinDigits(String(day.count))).font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink3)
                    }
                    .frame(maxWidth: .infinity)
                    .accessibilityLabel("\(StaffFormat.day(day.day + "T12:00:00Z")): \(StaffFormat.storiesCount(day.count))")
                }
            }
            .padding(14)
            .background(ElmTheme.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(ElmTheme.line, lineWidth: 1))
        }
    }

    private func load() async {
        loading = true
        defer { loading = false }
        do {
            payload = try await StaffAPI.overview()
            error = nil
        } catch {
            let api = staff.handle(error)
            if payload == nil { self.error = api }
        }
    }
}

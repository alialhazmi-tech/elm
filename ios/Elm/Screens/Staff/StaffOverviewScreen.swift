import SwiftUI

/// نظرة اليوم — نظير `app/tahrir/(app)/page.tsx`: البطاقات الأربع، بنود الانتباه، طابور الاعتماد،
/// المجدول للأيام القادمة (بترتيب الموعد)، آخر المسودات والمنشور، وإيقاع النشر. كل الأوقات بساعة الرياض.
struct StaffOverviewScreen: View {
    @Environment(StaffSessionStore.self) private var staff
    var unread: Int = 0
    @State private var payload: StaffOverviewPayload?
    @State private var error: ElmAPIError?
    @State private var loading = false

    private static var riyadhCalendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "Asia/Riyadh")!
        return calendar
    }

    var body: some View {
        StaffScreen(title: "نظرة اليوم", onRefresh: { await load() }) {
            VStack(alignment: .leading, spacing: 22) {
                greeting
                if let payload {
                    tiles(payload)
                    attention(payload)
                    if let review = payload.review, !review.isEmpty {
                        panel("بانتظار الاعتماد", detail: StaffFormat.storiesCount(payload.counts?["review"] ?? review.count)) {
                            ForEach(review) { row in storyLink(row) }
                        }
                    }
                    let upcoming = upcomingScheduled(payload)
                    if !upcoming.isEmpty {
                        panel("المجدول للأيام القادمة", detail: payload.nextScheduledAt.map { "الأقرب \(StaffFormat.smart($0))" }) {
                            ForEach(upcoming) { row in storyLink(row) }
                        }
                    }
                    if let drafts = payload.latestDraft, !drafts.isEmpty {
                        panel("المسودات قيد التحرير") { ForEach(drafts) { row in storyLink(row) } }
                    }
                    if let published = payload.latestPublished, !published.isEmpty {
                        panel("آخر ما نُشر") { ForEach(published.prefix(8)) { row in storyLink(row) } }
                    }
                    if let perDay = payload.perDay, !perDay.isEmpty { rhythm(perDay) }
                    if let error { StaffInlineError(message: error.message, retry: { Task { await load() } }) }
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

    /// التحية بساعة الرياض لا ساعة الجهاز — صباحًا حتى الظهر ثم مساء المعرفة (كما الويب).
    private var hourGreeting: String {
        let hour = Self.riyadhCalendar.component(.hour, from: Date())
        return hour >= 5 && hour < 12 ? "صباح المعرفة" : "مساء المعرفة"
    }

    // MARK: الحسابات المشتقة

    private func blockingInReview(_ payload: StaffOverviewPayload) -> Int {
        (payload.review ?? []).filter { $0.guardChip?.tone == "block" }.count
    }

    private func totalStories(_ payload: StaffOverviewPayload) -> Int {
        (payload.counts ?? [:]).filter { $0.key != "archived" && $0.key != "active" }.values.reduce(0, +)
    }

    /// المجدول لما بعد اليوم (بتوقيت الرياض) مرتبًا بالموعد — 5 عناصر كما الويب.
    private func upcomingScheduled(_ payload: StaffOverviewPayload) -> [StaffStoryRow] {
        let calendar = Self.riyadhCalendar
        return (payload.scheduled ?? [])
            .filter { row in
                guard let at = StaffFormat.parse(row.scheduledAt) else { return false }
                return !calendar.isDateInToday(at) && at > Date()
            }
            .sorted { ($0.scheduledAt ?? "") < ($1.scheduledAt ?? "") }
            .prefix(5)
            .map { $0 }
    }

    /// الموعد التالي اليوم: أقرب مادة مجدولة ضمن يوم الرياض الحالي.
    private func nextToday(_ payload: StaffOverviewPayload) -> StaffStoryRow? {
        let calendar = Self.riyadhCalendar
        return (payload.scheduled ?? [])
            .filter { row in StaffFormat.parse(row.scheduledAt).map { calendar.isDateInToday($0) } ?? false }
            .sorted { ($0.scheduledAt ?? "") < ($1.scheduledAt ?? "") }
            .first
    }

    // MARK: البطاقات

    private func tiles(_ payload: StaffOverviewPayload) -> some View {
        let counts = payload.counts ?? [:]
        let review = counts["review"] ?? 0
        let blocking = blockingInReview(payload)
        let columns = [GridItem(.flexible()), GridItem(.flexible())]
        return LazyVGrid(columns: columns, spacing: 10) {
            StaffStatTile(value: String(payload.todayCount ?? 0), label: "نُشر اليوم", tint: ElmTheme.tealInk)
            StaffStatTile(value: String(review), label: "بانتظار الاعتماد", tint: blocking > 0 ? ElmTheme.danger : ElmTheme.warn,
                          hint: blocking > 0 ? "\(ElmFormat.latinDigits(String(blocking))) فيها مخالفة قاطعة" : review > 0 ? "تحتاج قرار معتمد" : "الطابور فارغ")
            StaffStatTile(value: String(counts["draft"] ?? 0), label: "مسودات", tint: ElmTheme.ink2)
            StaffStatTile(value: String(totalStories(payload)), label: "إجمالي المواد", tint: ElmTheme.navyInk)
        }
    }

    /// بنود الانتباه كما الويب: قاطع في الاعتماد، أو طابور ينتظر قرارك؛ الموعد التالي اليوم؛ صور بلا توثيق؛ وتنبيهات غير مقروءة.
    @ViewBuilder
    private func attention(_ payload: StaffOverviewPayload) -> some View {
        let pendingMedia = payload.media?.pending ?? 0
        let blocking = blockingInReview(payload)
        let review = payload.counts?["review"] ?? 0
        let canSeeMedia = staff.can("media.rights") || staff.can("media.upload")
        let next = nextToday(payload)
        let showReview = blocking > 0 || (review > 0 && staff.can("story.approve"))
        if showReview || next != nil || (canSeeMedia && pendingMedia > 0) || unread > 0 {
            StaffCard {
                Text("يحتاج انتباهك").font(ElmFonts.text(.caption, weight: .bold)).foregroundStyle(ElmTheme.ink3)
                if blocking > 0 {
                    NavigationLink { StaffStoriesScreen(showBack: true, initialStatus: "review") } label: {
                        attentionRow("\(StaffFormat.storiesCount(blocking)) في الاعتماد فيها مخالفة قاطعة", detail: "لا تُنشر قبل الإصلاح", symbol: "exclamationmark.octagon", tint: ElmTheme.danger)
                    }
                } else if review > 0, staff.can("story.approve") {
                    NavigationLink { StaffStoriesScreen(showBack: true, initialStatus: "review") } label: {
                        attentionRow("\(StaffFormat.storiesCount(review)) بانتظار قرارك", detail: payload.review?.first?.displayTitle, symbol: "checkmark.circle", tint: ElmTheme.warn)
                    }
                }
                if let next {
                    NavigationLink(value: next) {
                        attentionRow("الموعد التالي \(StaffFormat.time(next.scheduledAt))", detail: next.displayTitle, symbol: "calendar.badge.clock", tint: ElmTheme.focus)
                    }
                }
                if canSeeMedia, pendingMedia > 0 {
                    NavigationLink { StaffMediaScreen(showBack: true, initialFilter: "pending") } label: {
                        attentionRow("\(ElmFormat.countedNoun(pendingMedia, one: "صورة واحدة", two: "صورتان", few: "صور", many: "صورة")) بلا توثيق حقوق", detail: "التوثيق شرط للنشر والجدولة", symbol: "photo.badge.exclamationmark", tint: ElmTheme.warn)
                    }
                }
                if unread > 0 {
                    NavigationLink { StaffNotificationsScreen(onRead: nil) } label: {
                        attentionRow("\(ElmFormat.countedNoun(unread, one: "تنبيه واحد", two: "تنبيهان", few: "تنبيهات", many: "تنبيهًا")) غير مقروء", detail: nil, symbol: "bell.badge", tint: ElmTheme.navyInk)
                    }
                }
            }
        } else {
            StaffInlineNotice(message: "لا شيء عالق الآن — طابور الاعتماد فارغ، ولا صور بانتظار التوثيق.", symbol: "checkmark.circle")
        }
    }

    private func attentionRow(_ label: String, detail: String?, symbol: String, tint: Color) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: symbol).font(.system(size: 15, weight: .semibold)).foregroundStyle(tint).frame(width: 22)
            VStack(alignment: .leading, spacing: 2) {
                Text(label).font(ElmFonts.text(.footnote, weight: .semibold)).foregroundStyle(ElmTheme.ink)
                if let detail, !detail.isEmpty { Text(detail).font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink3).lineLimit(1) }
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.left").font(.system(size: 11, weight: .semibold)).foregroundStyle(ElmTheme.ink3)
        }
        .frame(minHeight: 40)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
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
            self.error = staff.handle(error)
        }
    }
}

import SwiftUI

/// الجدولة — `GET /api/tahrir/schedule`: المواد المجدولة والأقرب موعدًا.
struct StaffScheduleScreen: View {
    @Environment(StaffSessionStore.self) private var staff
    var showBack = false
    @State private var payload: StaffSchedulePayload?
    @State private var error: ElmAPIError?

    var body: some View {
        StaffScreen(title: "الجدولة", showBack: showBack, onRefresh: { await load() }) {
            VStack(alignment: .leading, spacing: 14) {
                VStack(alignment: .leading, spacing: 3) {
                    Text("الجدولة").font(ElmFonts.display(.title2, weight: .heavy)).foregroundStyle(ElmTheme.ink)
                    Text("النشر يتم من الخادم في موعده بتوقيت الرياض بعد تجاوز الحارس.").font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink3)
                }
                if let payload {
                    if let next = payload.nextScheduledAt {
                        StaffInlineNotice(message: "أقرب موعد: \(StaffFormat.dateTime(next))", symbol: "clock")
                    }
                    if payload.scheduled.isEmpty {
                        StaffEmptyView(title: "لا مواد مجدولة", symbol: "calendar")
                    } else {
                        VStack(spacing: 0) {
                            ForEach(payload.scheduled) { row in
                                NavigationLink { StaffStoryScreen(id: row.id, seed: row) } label: { StaffStoryRowView(row: row, showStatus: false) }.buttonStyle(.plain)
                                Divider().overlay(ElmTheme.line)
                            }
                        }
                        .padding(.horizontal, 14)
                        .background(ElmTheme.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(ElmTheme.line, lineWidth: 1))
                    }
                } else if let error {
                    StaffErrorView(error: error) { Task { await load() } }
                } else {
                    ProgressView().frame(maxWidth: .infinity).padding(30)
                }
            }
            .padding(.horizontal, 18)
            .padding(.top, 8)
        }
        .task { if payload == nil { await load() } }
    }

    private func load() async {
        do {
            payload = try await StaffAPI.schedule()
            error = nil
        } catch {
            let api = staff.handle(error)
            if payload == nil { self.error = api }
        }
    }
}

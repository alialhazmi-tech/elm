import SwiftUI

/// تنبيهات الفريق الداخلية (إسناد/ملاحظة/إعادة) — `GET/POST /api/tahrir/notifications` بـETag.
struct StaffNotificationsScreen: View {
    @Environment(StaffSessionStore.self) private var staff
    var onRead: (() -> Void)?
    @State private var items: [StaffNotification] = []
    @State private var etag: String?
    @State private var loading = false
    @State private var error: ElmAPIError?

    var body: some View {
        StaffScreen(title: "التنبيهات", showBack: true, onRefresh: { await load() }) {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    Text("التنبيهات").font(ElmFonts.display(.title2, weight: .heavy)).foregroundStyle(ElmTheme.ink)
                    Spacer()
                    if items.contains(where: { $0.readAt == nil }) {
                        Button("تعليم الكل كمقروء") { Task { await markRead(items.filter { $0.readAt == nil }.map(\.id)) } }
                            .font(ElmFonts.text(.footnote, weight: .semibold)).foregroundStyle(ElmTheme.navyInk)
                    }
                }
                if let error, items.isEmpty {
                    StaffErrorView(error: error) { Task { await load() } }
                } else if items.isEmpty && !loading {
                    StaffEmptyView(title: "لا تنبيهات", detail: "تصلك هنا الإسنادات والملاحظات وإعادة المواد.", symbol: "bell.slash")
                } else {
                    VStack(spacing: 0) {
                        ForEach(items) { item in
                            NavigationLink {
                                if let storyId = item.storyId { StaffStoryScreen(id: storyId) } else { StaffTasksScreen(showBack: true) }
                            } label: { row(item) }
                            .buttonStyle(.plain)
                            .simultaneousGesture(TapGesture().onEnded { if item.readAt == nil { Task { await markRead([item.id]) } } })
                            Divider().overlay(ElmTheme.line)
                        }
                    }
                    .padding(.horizontal, 14)
                    .background(ElmTheme.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(ElmTheme.line, lineWidth: 1))
                }
                if let error, !items.isEmpty { StaffInlineError(message: error.message, retry: { Task { await load() } }) }
                if loading { ProgressView().frame(maxWidth: .infinity) }
            }
            .padding(.horizontal, 18)
            .padding(.top, 8)
        }
        .task { await load() }
    }

    private func row(_ item: StaffNotification) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Circle().fill(item.readAt == nil ? ElmTheme.danger : Color.clear).frame(width: 8, height: 8).padding(.top, 6)
            VStack(alignment: .leading, spacing: 4) {
                Text(item.message).font(ElmFonts.text(.footnote, weight: item.readAt == nil ? .semibold : .regular)).foregroundStyle(ElmTheme.ink)
                Text(StaffFormat.smart(item.createdAt)).font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink3)
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, 10)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(item.readAt == nil ? "غير مقروء: " : "")\(item.message)")
    }

    private func load() async {
        loading = true
        error = nil
        defer { loading = false }
        do {
            let (payload, tag) = try await StaffAPI.notifications(etag: etag)
            if let payload { items = payload.notifications }
            etag = tag
        } catch {
            self.error = staff.handle(error)
        }
    }

    private func markRead(_ ids: [String]) async {
        guard !ids.isEmpty else { return }
        do {
            try await StaffAPI.markNotificationsRead(ids: ids)
            let now = StaffFormat.iso(Date())
            items = items.map { item in
                var copy = item
                if ids.contains(item.id), copy.readAt == nil { copy.readAt = now }
                return copy
            }
            etag = nil
            onRead?()
        } catch {
            self.error = staff.handle(error)
        }
    }
}

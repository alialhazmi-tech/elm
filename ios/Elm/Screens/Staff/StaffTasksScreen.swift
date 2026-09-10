import SwiftUI

/// مهامي — نظير `/tahrir/tasks`: موادّي والمسندة إليّ في المسودة/المراجعة/الجدولة.
struct StaffTasksScreen: View {
    @Environment(StaffSessionStore.self) private var staff
    var showBack = false
    @State private var filter = "all"
    @State private var rows: [StaffTask] = []
    @State private var page = 1
    @State private var hasMore = false
    @State private var loading = false
    @State private var error: ElmAPIError?
    @State private var newStoryId: String?

    private let filters = [("all", "كل مهامي"), ("assigned", "مسندة إليّ"), ("returned", "أُعيدت للتعديل"), ("own", "موادي")]

    var body: some View {
        StaffScreen(title: "مهامي", showBack: showBack, onRefresh: { await load(page: 1) }) {
            VStack(alignment: .leading, spacing: 14) {
                VStack(alignment: .leading, spacing: 3) {
                    Text("مهامي").font(ElmFonts.display(.title2, weight: .heavy)).foregroundStyle(ElmTheme.ink)
                    Text("موادك قيد العمل والمواد المسندة إليك، مرتبة حسب أقرب موعد تسليم.").font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink3)
                }
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 7) {
                        ForEach(filters, id: \.0) { item in
                            ElmChip(label: item.1, selected: filter == item.0) { filter = item.0; Task { await load(page: 1) } }
                        }
                    }.padding(.horizontal, 18)
                }.padding(.horizontal, -18)
                if let error, rows.isEmpty {
                    StaffErrorView(error: error) { Task { await load(page: page) } }
                } else if rows.isEmpty && !loading {
                    VStack(spacing: 12) {
                        StaffEmptyView(title: "لا توجد مهام في هذه القائمة", symbol: "checkmark.circle")
                        if staff.can("story.create") {
                            StaffSecondaryButton(title: "إنشاء مادة جديدة", symbol: "plus") { newStoryId = UUID().uuidString.lowercased() }
                        }
                    }
                } else {
                    VStack(spacing: 0) {
                        ForEach(rows) { task in
                            NavigationLink { StaffStoryScreen(id: task.id) } label: { taskRow(task) }.buttonStyle(.plain)
                            Divider().overlay(ElmTheme.line)
                        }
                    }
                    .padding(.horizontal, 14)
                    .background(ElmTheme.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(ElmTheme.line, lineWidth: 1))
                    if loading { ProgressView().frame(maxWidth: .infinity) }
                    HStack {
                        if page > 1 { Button("السابقة") { Task { await load(page: page - 1) } } }
                        Spacer()
                        if hasMore { Button("التالية") { Task { await load(page: page + 1) } } }
                    }
                    .font(ElmFonts.text(.footnote, weight: .semibold)).foregroundStyle(ElmTheme.navyInk)
                }
            }
            .padding(.horizontal, 18)
            .padding(.top, 8)
        }
        .task { if rows.isEmpty { await load(page: 1) } }
        .navigationDestination(item: $newStoryId) { id in StaffEditorScreen(storyId: id, isNew: true) }
    }

    private func taskRow(_ task: StaffTask) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(task.displayTitle).font(ElmFonts.text(.subheadline, weight: .semibold)).foregroundStyle(ElmTheme.ink).lineLimit(3)
            ElmFlow(spacing: 6) {
                StatusPill(status: task.storyStatus, label: task.statusLabel)
                if task.revisionOf != nil { Text("مسودة تعديل").font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink3) }
                if task.assignedTo == staff.actor?.userId { Text("مسندة إليك").font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink3) }
                if task.returnedAt != nil { Text("أُعيدت للتعديل — راجع الملاحظات").font(ElmFonts.text(.caption2, weight: .semibold)).foregroundStyle(ElmTheme.hex("b8760a")) }
            }
            if let due = task.dueAt {
                Text("التسليم: \(StaffFormat.dateTime(due)) (الرياض)\(task.overdue == true ? " · متأخرة" : "")")
                    .font(ElmFonts.text(.caption2)).foregroundStyle(task.overdue == true ? ElmTheme.danger : ElmTheme.ink3)
            }
        }
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }

    private func load(page target: Int) async {
        loading = true
        error = nil
        defer { loading = false }
        do {
            let payload = try await StaffAPI.tasks(filter: filter, page: target)
            rows = payload.rows
            page = payload.page ?? target
            hasMore = payload.hasMore ?? false
        } catch {
            self.error = staff.handle(error)
        }
    }
}

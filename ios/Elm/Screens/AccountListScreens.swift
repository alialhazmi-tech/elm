import SwiftUI

/// قوائم الحساب من `/api/me/account?tab=liked|history` بترقيم 12/صفحة.
/// الزائر (401) يرى دعوة دخول لا خطأ.
enum AccountListTab: String {
    case liked, history

    var title: String {
        switch self {
        case .liked: "الإعجابات"
        case .history: "سجل القراءة"
        }
    }
    var subtitle: String {
        switch self {
        case .liked: "المواد التي أعجبتك — من أي جهاز."
        case .history: "ما قرأته مؤخرًا ونسبة تقدّمك فيه."
        }
    }
    var emptyTitle: String {
        switch self {
        case .liked: "لم تُعجب بمادة بعد"
        case .history: "لم تقرأ مادة بعد"
        }
    }
    var symbol: String {
        switch self {
        case .liked: "heart"
        case .history: "clock.arrow.circlepath"
        }
    }
}

struct AccountLikedScreen: View {
    var body: some View { AccountListScreen(tab: .liked) }
}

struct AccountHistoryScreen: View {
    var body: some View { AccountListScreen(tab: .history) }
}

struct AccountListScreen: View {
    let tab: AccountListTab
    @Environment(MemberSessionStore.self) private var member
    @Environment(\.horizontalSizeClass) private var sizeClass
    @Environment(\.dynamicTypeSize) private var typeSize
    @State private var items: [AccountItem] = []
    @State private var page = 0
    @State private var pageCount = 1
    @State private var loading = false
    @State private var error: String?
    @State private var guest = false
    @State private var removing: Set<String> = []

    private var columns: [GridItem] {
        let count = sizeClass == .regular && !typeSize.isAccessibilitySize ? 2 : 1
        return Array(repeating: GridItem(.flexible(), spacing: 16, alignment: .top), count: count)
    }

    var body: some View {
        ElmScreen(title: tab.title, showBack: true, onRefresh: { await load(reset: true) }) {
            LazyVStack(alignment: .leading, spacing: 16) {
                Text(tab.title).font(ElmFonts.display(.largeTitle, weight: .bold)).foregroundStyle(ElmTheme.ink)
                Text(tab.subtitle).font(ElmFonts.text(.body)).foregroundStyle(ElmTheme.ink2)

                if guest || !member.isSignedIn {
                    GuestGate(text: "سجّل الدخول لترى \(tab.title) في حسابك من أي جهاز.")
                } else {
                    LazyVGrid(columns: columns, alignment: .leading, spacing: 12) {
                        ForEach(items) { item in row(item) }
                    }
                    if let error {
                        Text(error).font(ElmFonts.text(.footnote)).foregroundStyle(ElmTheme.ink2)
                        Button("إعادة المحاولة") { Task { await load(reset: items.isEmpty) } }.frame(minHeight: 44)
                    } else if items.isEmpty && !loading && page > 0 {
                        ContentUnavailableView(tab.emptyTitle, systemImage: tab.symbol)
                    }
                    if loading { ProgressView().frame(maxWidth: .infinity).padding(20) }
                    else if page < pageCount && error == nil && !items.isEmpty {
                        Button("عرض المزيد") { Task { await load(reset: false) } }
                            .font(ElmFonts.text(.body, weight: .semibold)).frame(maxWidth: .infinity, minHeight: 48)
                            .background(ElmTheme.surface2, in: Capsule())
                    }
                }
            }
            .padding(20)
            .frame(maxWidth: sizeClass == .regular ? 1000 : .infinity)
            .frame(maxWidth: .infinity)
        }
        .task(id: member.user?.id) {
            items = []; page = 0; guest = false
            if member.isSignedIn { await load(reset: true) }
        }
    }

    private func row(_ item: AccountItem) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            NativeStoryRow(story: item.story)
            HStack(spacing: 10) {
                switch tab {
                case .history:
                    if let progress = item.progress {
                        ProgressView(value: Double(max(0, min(100, progress))), total: 100).tint(ElmTheme.tealInk)
                            .accessibilityLabel("تقدّم القراءة \(progress) بالمئة")
                        Text("\(ElmFormat.latinDigits(String(progress)))%").font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink3).elmLatin()
                    }
                    if let date = ElmFormat.brandDate(item.lastVisitAt) { Text(date).font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink3) }
                case .liked:
                    if let date = ElmFormat.brandDate(item.savedAt) { Text("أُعجبت به في \(date)").font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink3) }
                    Spacer(minLength: 0)
                    Button { Task { await unlike(item) } } label: {
                        Label(removing.contains(item.id) ? "لحظة…" : "إزالة الإعجاب", systemImage: "heart.slash")
                            .font(ElmFonts.text(.caption, weight: .semibold)).foregroundStyle(ElmTheme.ink2).frame(minHeight: 40)
                    }.buttonStyle(.plain).disabled(removing.contains(item.id))
                }
            }
        }
    }

    @MainActor private func load(reset: Bool) async {
        guard !loading else { return }
        let next = reset ? 1 : page + 1
        guard reset || next <= pageCount else { return }
        loading = true
        error = nil
        defer { loading = false }
        do {
            let payload = try await APIClient.fetchAccount(tab: tab.rawValue, page: next)
            try Task.checkCancellation()
            var seen = Set<String>()
            items = ((reset ? [] : items) + payload.items).filter { seen.insert($0.id).inserted }
            page = payload.page
            pageCount = payload.pageCount
            guest = false
            ImageStore.shared.prefetch(payload.items.compactMap(\.story.imageURL))
        } catch is CancellationError { }
        catch let api as ElmAPIError where api.isUnauthorized { guest = true; page = 1 }
        catch { self.error = ElmAPIError.wrap(error).message }
    }

    @MainActor private func unlike(_ item: AccountItem) async {
        removing.insert(item.id)
        defer { removing.remove(item.id) }
        do {
            try await APIClient.setLiked(storyId: item.story.apiId, liked: false)
            items.removeAll { $0.id == item.id }
        } catch {
            self.error = ElmAPIError.wrap(error).message
        }
    }
}

/// حالة الزائر الموحّدة لشاشات العضوية.
struct GuestGate: View {
    let text: String
    @Environment(MemberSessionStore.self) private var member
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Image(systemName: "person.crop.circle.badge.plus").font(.system(size: 30, weight: .light)).foregroundStyle(ElmTheme.accent)
            Text(text).font(ElmFonts.text(.body)).foregroundStyle(ElmTheme.ink).lineSpacing(4)
            Button { member.authPresented = true } label: {
                Text("الدخول أو إنشاء حساب").font(ElmFonts.text(.subheadline, weight: .bold)).foregroundStyle(.white)
                    .frame(maxWidth: .infinity, minHeight: 48).background(ElmTheme.navyDeep, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            }.buttonStyle(.plain)
        }
        .padding(18).frame(maxWidth: .infinity, alignment: .leading)
        .background(ElmTheme.surface2, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

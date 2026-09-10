import SwiftUI

/// السلاسل والمقترحات — `GET /api/tahrir/series` + `series/proposals` + `series/visibility`.
struct StaffSeriesScreen: View {
    @Environment(StaffSessionStore.self) private var staff
    var showBack = false
    @State private var payload: StaffSeriesPayload?
    @State private var error: ElmAPIError?
    @State private var proposing = false
    @State private var name = ""
    @State private var valueCase = ""
    @State private var gapCase = ""
    @State private var impactCase = ""
    @State private var notice: String?

    var body: some View {
        StaffScreen(title: "السلاسل", showBack: showBack, onRefresh: { await load() }) {
            VStack(alignment: .leading, spacing: 16) {
                Text("السلاسل").font(ElmFonts.display(.title2, weight: .heavy)).foregroundStyle(ElmTheme.ink)
                if let notice { StaffInlineNotice(message: notice, symbol: "checkmark.circle") }
                if let error, payload != nil { StaffInlineError(message: error.message, retry: { Task { await load() } }) }
                if let payload {
                    if let rows = payload.rows, !rows.isEmpty {
                        StaffSectionTitle(title: "السلاسل الحالية")
                        VStack(spacing: 0) {
                            ForEach(rows) { row in
                                HStack(spacing: 10) {
                                    Circle().fill(ElmTheme.hex(row.color ?? "1a4282")).frame(width: 10, height: 10)
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(row.name).font(ElmFonts.text(.footnote, weight: .semibold)).foregroundStyle(ElmTheme.ink)
                                        Text([row.count.map { StaffFormat.storiesCount($0) }, row.archived == true ? (row.hidden == true ? "متقاعدة · مخفية" : "متقاعدة · ظاهرة") : "نشطة"].compactMap { $0 }.joined(separator: " · ")).font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink3)
                                    }
                                    Spacer()
                                    // مفتاح الإظهار للسلاسل المتقاعدة فقط (كما `series/page.tsx`)؛ النشطة ظاهرة دائمًا.
                                    if row.archived == true, staff.can("series.visibility") {
                                        ElmToggle(isOn: row.hidden != true) { Task { await setHidden(row) } }.accessibilityLabel("إظهار \(row.name)")
                                    }
                                }
                                .padding(.vertical, 10)
                                Divider().overlay(ElmTheme.line)
                            }
                        }
                        .padding(.horizontal, 14)
                        .background(ElmTheme.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(ElmTheme.line, lineWidth: 1))
                    }
                    let proposals = payload.proposals ?? []
                    StaffSectionTitle(title: "مقترحات السلاسل", detail: proposals.isEmpty ? nil : ElmFormat.latinDigits(String(proposals.count)))
                    if proposals.isEmpty { StaffEmptyView(title: "لا مقترحات", symbol: "lightbulb") }
                    ForEach(proposals) { proposal in
                        StaffCard {
                            HStack {
                                Text(proposal.name).font(ElmFonts.text(.footnote, weight: .bold)).foregroundStyle(ElmTheme.ink)
                                Spacer()
                                Text(statusLabel(proposal.status)).font(ElmFonts.text(.caption2, weight: .semibold)).foregroundStyle(ElmTheme.ink3)
                            }
                            if let value = proposal.valueCase, !value.isEmpty { Text("القيمة: \(value)").font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink2) }
                            if let gap = proposal.gapCase, !gap.isEmpty { Text("الفجوة: \(gap)").font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink2) }
                            if let impact = proposal.impactCase, !impact.isEmpty { Text("الأثر: \(impact)").font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink2) }
                            if let by = proposal.proposedBy { Text("اقترحها \(by)").font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink3) }
                            if staff.can("series.decide"), (proposal.status ?? "pending") == "pending" {
                                HStack(spacing: 8) {
                                    StaffSecondaryButton(title: "قبول", symbol: "checkmark") { Task { await decide(proposal, "accepted") } }
                                    StaffSecondaryButton(title: "رفض", symbol: "xmark", destructive: true) { Task { await decide(proposal, "rejected") } }
                                }
                            }
                        }
                    }
                    if staff.can("series.propose") {
                        Button { proposing.toggle() } label: {
                            Label(proposing ? "إخفاء النموذج" : "اقتراح سلسلة جديدة", systemImage: "plus.circle").font(ElmFonts.text(.footnote, weight: .semibold)).frame(minHeight: 44)
                        }
                        if proposing {
                            StaffCard {
                                StaffField(label: "اسم السلسلة", text: $name)
                                StaffField(label: "ما القيمة التي تضيفها؟", text: $valueCase, axis: .vertical)
                                StaffField(label: "ما الفجوة التي تسدّها؟", text: $gapCase, axis: .vertical)
                                StaffField(label: "ما الأثر المتوقع؟", text: $impactCase, axis: .vertical)
                                Text("شروط الإنشاء من الدستور — باب السلاسل: القيمة المعرفية، وتغطية ما لا تغطيه القائمة، وأثر متوقع. الحقول الأربعة مطلوبة.")
                                    .font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink3)
                                StaffPrimaryButton(title: "رفع المقترح لاعتماد رئيس التحرير", symbol: "paperplane") { Task { await propose() } }
                                    .disabled(!proposalComplete)
                                    .opacity(proposalComplete ? 1 : 0.55)
                            }
                        }
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

    /// كما `series-client.tsx`: الاسم والقيمة والفجوة والأثر كلها `required`.
    private var proposalComplete: Bool {
        [name, valueCase, gapCase, impactCase].allSatisfy { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
    }

    private func statusLabel(_ status: String?) -> String {
        switch status {
        case "accepted": "مقبول"
        case "rejected": "مرفوض"
        default: "قيد الدراسة"
        }
    }

    private func load() async {
        do { payload = try await StaffAPI.series(); error = nil } catch { let api = staff.handle(error); if payload == nil { self.error = api } }
    }

    private func setHidden(_ row: StaffSeriesRow) async {
        do { try await StaffAPI.setSeriesHidden(slug: row.slug, hidden: row.hidden != true); await load() } catch { self.error = staff.handle(error) }
    }

    private func decide(_ proposal: StaffProposal, _ decision: String) async {
        do { try await StaffAPI.decideProposal(id: proposal.id, decision: decision); notice = decision == "accepted" ? "قُبل المقترح." : "رُفض المقترح."; await load() } catch { self.error = staff.handle(error) }
    }

    private func propose() async {
        do {
            try await StaffAPI.proposeSeries(name: name, valueCase: valueCase, gapCase: gapCase, impactCase: impactCase)
            notice = "أُرسل المقترح."
            name = ""; valueCase = ""; gapCase = ""; impactCase = ""
            proposing = false
            await load()
        } catch { self.error = staff.handle(error) }
    }
}

/// سجل التدقيق — `GET /api/tahrir/audit` (200 صف).
struct StaffAuditScreen: View {
    @Environment(StaffSessionStore.self) private var staff
    var showBack = false
    @State private var rows: [StaffAuditEntry] = []
    @State private var error: ElmAPIError?
    @State private var loading = false
    @State private var query = ""

    private var filtered: [StaffAuditEntry] {
        let needle = query.trimmingCharacters(in: .whitespaces)
        guard !needle.isEmpty else { return rows }
        return rows.filter { [$0.actor, $0.actorName ?? "", $0.action, $0.storyTitle ?? "", $0.detail ?? ""].joined(separator: " ").localizedCaseInsensitiveContains(needle) }
    }

    var body: some View {
        StaffScreen(title: "سجل التدقيق", showBack: showBack, onRefresh: { await load() }) {
            VStack(alignment: .leading, spacing: 14) {
                Text("سجل التدقيق").font(ElmFonts.display(.title2, weight: .heavy)).foregroundStyle(ElmTheme.ink)
                HStack(spacing: 8) {
                    Image(systemName: "magnifyingglass").foregroundStyle(ElmTheme.ink3)
                    TextField("تصفية بالاسم أو الإجراء أو المادة", text: $query).font(ElmFonts.text(.callout))
                }
                .padding(.horizontal, 12).frame(minHeight: 44)
                .background(ElmTheme.surface, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(ElmTheme.line2, lineWidth: 1))
                if let error, rows.isEmpty { StaffErrorView(error: error) { Task { await load() } } }
                else if let error { StaffInlineError(message: error.message, retry: { Task { await load() } }) }
                else if filtered.isEmpty && !loading { StaffEmptyView(title: "لا سجلات مطابقة", symbol: "list.bullet.rectangle") }
                VStack(spacing: 0) {
                    ForEach(filtered) { entry in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(entry.actorName ?? entry.actor).font(ElmFonts.text(.footnote, weight: .bold)).foregroundStyle(ElmTheme.ink)
                                Text(entry.action).font(ElmFonts.text(.caption2, weight: .semibold)).foregroundStyle(ElmTheme.navyInk)
                                Spacer()
                                Text(StaffFormat.smart(entry.at)).font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink3)
                            }
                            if let title = entry.storyTitle, !title.isEmpty { Text(title).font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink2).lineLimit(2) }
                            if let detail = entry.detail, !detail.isEmpty { Text(detail).font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink3).lineLimit(3) }
                        }
                        .padding(.vertical, 10)
                        .accessibilityElement(children: .combine)
                        Divider().overlay(ElmTheme.line)
                    }
                }
                .padding(.horizontal, 14)
                .background(ElmTheme.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(ElmTheme.line, lineWidth: 1))
                if loading { ProgressView().frame(maxWidth: .infinity) }
            }
            .padding(.horizontal, 18)
            .padding(.top, 8)
        }
        .task { if rows.isEmpty { await load() } }
    }

    private func load() async {
        loading = true
        defer { loading = false }
        do { rows = try await StaffAPI.audit().rows; error = nil } catch { self.error = staff.handle(error) }
    }
}

/// الإحصاءات — `GET /api/tahrir/stats`.
struct StaffStatsScreen: View {
    @Environment(StaffSessionStore.self) private var staff
    var showBack = false
    @State private var payload: StaffStatsPayload?
    @State private var error: ElmAPIError?

    var body: some View {
        StaffScreen(title: "الإحصاءات", showBack: showBack, onRefresh: { await load() }) {
            VStack(alignment: .leading, spacing: 18) {
                Text("الإحصاءات").font(ElmFonts.display(.title2, weight: .heavy)).foregroundStyle(ElmTheme.ink)
                if let payload {
                    let counts = payload.counts ?? [:]
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                        StaffStatTile(value: String(counts["published"] ?? 0), label: "منشورة", tint: ElmTheme.tealInk)
                        StaffStatTile(value: String(counts["review"] ?? 0), label: "بانتظار الاعتماد", tint: ElmTheme.warn)
                        StaffStatTile(value: String(counts["scheduled"] ?? 0), label: "مجدولة", tint: ElmTheme.focus)
                        StaffStatTile(value: String(counts["draft"] ?? 0), label: "مسودات", tint: ElmTheme.ink2)
                    }
                    if let perDay = payload.perDay, !perDay.isEmpty { bars("النشر اليومي", perDay.map { ($0.day.suffix(5).description, $0.count, ElmTheme.navyInk) }) }
                    if let series = payload.seriesDistribution, !series.isEmpty { bars("توزيع السلاسل", series.map { ($0.display, $0.count, $0.color.map { ElmTheme.hex($0) } ?? SeriesPalette.color(for: $0.seriesSlug ?? $0.slug ?? "")) }) }
                    if let formats = payload.formatDistribution, !formats.isEmpty { bars("توزيع الأشكال", formats.map { (formatLabel($0.format ?? $0.display), $0.count, ElmTheme.focus) }) }
                    if let authors = payload.topAuthors, !authors.isEmpty { bars("أعلى الكتّاب", authors.map { ($0.display, $0.count, ElmTheme.gold) }) }
                    if let reading = payload.readingTime {
                        bars("زمن القراءة", [("سريعة (أقل من 3 دقائق)", reading.quick, ElmTheme.tealInk), ("متوسطة (3–5 دقائق)", reading.medium, ElmTheme.navyInk), ("مطولة (أكثر من 5 دقائق)", reading.long, ElmTheme.hex("6b5a96"))])
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

    private func formatLabel(_ value: String) -> String {
        StaffTaxonomyPayload.formatLabel(value)
    }

    private func bars(_ title: String, _ items: [(String, Int, Color)]) -> some View {
        let peak = max(1, items.map(\.1).max() ?? 1)
        return VStack(alignment: .leading, spacing: 8) {
            StaffSectionTitle(title: title)
            VStack(spacing: 8) {
                ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                    HStack(spacing: 10) {
                        Text(item.0).font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink2).frame(width: 120, alignment: .leading).lineLimit(2).minimumScaleFactor(0.8)
                        GeometryReader { proxy in
                            RoundedRectangle(cornerRadius: 4).fill(item.2).frame(width: max(4, proxy.size.width * CGFloat(item.1) / CGFloat(peak)))
                        }
                        .frame(height: 14)
                        Text(ElmFormat.latinDigits(String(item.1))).font(ElmFonts.text(.caption, weight: .bold)).foregroundStyle(ElmTheme.ink).frame(width: 40, alignment: .trailing).monospacedDigit()
                    }
                    .accessibilityElement(children: .combine)
                    .accessibilityLabel("\(item.0): \(ElmFormat.latinDigits(String(item.1)))")
                }
            }
            .padding(14)
            .background(ElmTheme.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(ElmTheme.line, lineWidth: 1))
        }
    }

    private func load() async {
        do { payload = try await StaffAPI.stats(); error = nil } catch { let api = staff.handle(error); if payload == nil { self.error = api } }
    }
}

/// إعدادات النظام: بوابتا النشر وإظهار/إخفاء التصنيفات — `settings` + `taxonomy`.
struct StaffSettingsScreen: View {
    @Environment(StaffSessionStore.self) private var staff
    var showBack = false
    @State private var governance: StaffGovernance?
    @State private var taxonomy: StaffTaxonomyPayload?
    @State private var error: ElmAPIError?
    @State private var busy = false

    var body: some View {
        StaffScreen(title: "إعدادات النظام", showBack: showBack, onRefresh: { await load() }) {
            VStack(alignment: .leading, spacing: 16) {
                Text("إعدادات النظام").font(ElmFonts.display(.title2, weight: .heavy)).foregroundStyle(ElmTheme.ink)
                if let error { StaffInlineError(message: error.message, retry: { Task { await load() } }) }
                if let governance {
                    StaffCard {
                        Text("بوابات النشر").font(ElmFonts.text(.caption, weight: .bold)).foregroundStyle(ElmTheme.ink3)
                        toggleRow("حارس السياسة التحريرية", detail: "المخالفة القاطعة تمنع الرفع والجدولة والنشر من الخادم.", isOn: governance.editorialGuard) {
                            Task { await update(editorialGuard: !governance.editorialGuard, requireImageRights: nil) }
                        }
                        Divider().overlay(ElmTheme.line)
                        toggleRow("اشتراط توثيق حقوق الصورة", detail: "لا تُنشر مادة بصورة غير موثّقة من المكتبة.", isOn: governance.requireImageRights) {
                            Task { await update(editorialGuard: nil, requireImageRights: !governance.requireImageRights) }
                        }
                    }
                }
                if let taxonomy {
                    StaffCard {
                        Text("ظهور الأقسام").font(ElmFonts.text(.caption, weight: .bold)).foregroundStyle(ElmTheme.ink3)
                        ForEach(taxonomy.sections) { section in
                            // قسم «أخبار» عام وظاهر دائمًا — المفتاح معطّل كما `taxonomy-client.tsx`.
                            let fixed = section.slug == "news"
                            let hidden = taxonomy.visibility?["section:\(section.slug)"] ?? false
                            toggleRow(section.label, detail: fixed ? "قسم عام — ظاهر دائمًا" : hidden ? "مخفي من القوائم والتوليد" : "ظاهر في القوائم والتوليد", isOn: !hidden, disabled: fixed) {
                                Task { await setHidden("section", section.slug, hidden: !hidden) }
                            }
                        }
                    }
                    StaffCard {
                        Text("ظهور السلاسل").font(ElmFonts.text(.caption, weight: .bold)).foregroundStyle(ElmTheme.ink3)
                        ForEach(taxonomy.series) { series in
                            let hidden = taxonomy.visibility?["series:\(series.slug)"] ?? false
                            toggleRow(series.name, detail: hidden ? "مخفية من القوائم والتوليد" : "ظاهرة في القوائم والتوليد", isOn: !hidden) {
                                Task { await setHidden("series", series.slug, hidden: !hidden) }
                            }
                        }
                    }
                }
                if governance == nil && error == nil { ProgressView().frame(maxWidth: .infinity).padding(30) }
                if busy { ProgressView().frame(maxWidth: .infinity) }
            }
            .padding(.horizontal, 18)
            .padding(.top, 8)
        }
        .task { if governance == nil { await load() } }
    }

    private func toggleRow(_ title: String, detail: String, isOn: Bool, disabled: Bool = false, action: @escaping () -> Void) -> some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(ElmFonts.text(.footnote, weight: .semibold)).foregroundStyle(ElmTheme.ink)
                Text(detail).font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink3)
            }
            Spacer()
            ElmToggle(isOn: isOn, action: action)
                .disabled(disabled || busy)
                .opacity(disabled ? 0.45 : 1)
                .accessibilityLabel("إظهار \(title)")
        }
        .padding(.vertical, 4)
    }

    private func load() async {
        do {
            governance = try await StaffAPI.settings().governance
            taxonomy = try await StaffAPI.taxonomy()
            error = nil
        } catch { self.error = staff.handle(error) }
    }

    private func update(editorialGuard: Bool?, requireImageRights: Bool?) async {
        busy = true
        defer { busy = false }
        do { governance = try await StaffAPI.updateGovernance(editorialGuard: editorialGuard, requireImageRights: requireImageRights).governance; error = nil } catch { self.error = staff.handle(error) }
    }

    private func setHidden(_ kind: String, _ slug: String, hidden: Bool) async {
        busy = true
        defer { busy = false }
        do { try await StaffAPI.setTaxonomyHidden(kind: kind, slug: slug, hidden: hidden); taxonomy = try await StaffAPI.taxonomy(); error = nil } catch { self.error = staff.handle(error) }
    }
}

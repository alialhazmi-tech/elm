import SwiftUI

/// تواريخ وأوقات اللوحة بتوقيت الرياض وأرقام لاتينية — نظير `formatRiyadh*` على الويب.
enum StaffFormat {
    private static let riyadh = TimeZone(identifier: "Asia/Riyadh")!
    private static let locale = Locale(identifier: "ar-SA@calendar=gregorian;numbers=latn")

    static func parse(_ iso: String?) -> Date? {
        guard let iso, !iso.isEmpty else { return nil }
        let withFraction = ISO8601DateFormatter()
        withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = withFraction.date(from: iso) { return date }
        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]
        if let date = plain.date(from: iso) { return date }
        // «2026-09-10 05:00:00+03» من Postgres.
        let sql = DateFormatter()
        sql.locale = Locale(identifier: "en_US_POSIX")
        sql.dateFormat = "yyyy-MM-dd HH:mm:ssXXX"
        return sql.date(from: iso)
    }

    static func dateTime(_ iso: String?) -> String {
        guard let date = parse(iso) else { return "—" }
        let formatter = DateFormatter()
        formatter.locale = locale
        formatter.timeZone = riyadh
        formatter.dateFormat = "d MMM yyyy، HH:mm"
        return formatter.string(from: date)
    }

    static func time(_ iso: String?) -> String {
        guard let date = parse(iso) else { return "—" }
        let formatter = DateFormatter()
        formatter.locale = locale
        formatter.timeZone = riyadh
        formatter.dateFormat = "HH:mm"
        return formatter.string(from: date)
    }

    static func day(_ iso: String?) -> String {
        guard let date = parse(iso) else { return "—" }
        let formatter = DateFormatter()
        formatter.locale = locale
        formatter.timeZone = riyadh
        formatter.dateFormat = "EEE d MMM"
        return formatter.string(from: date)
    }

    /// «اليوم 14:05» أو «أمس» أو تاريخ قصير.
    static func smart(_ iso: String?) -> String {
        guard let date = parse(iso) else { return "—" }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = riyadh
        if calendar.isDateInToday(date) { return "اليوم \(time(iso))" }
        if calendar.isDateInYesterday(date) { return "أمس \(time(iso))" }
        return day(iso)
    }

    static func iso(_ date: Date) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.string(from: date)
    }

    static func count(_ n: Int, one: String, two: String, few: String, many: String) -> String {
        ElmFormat.countedNoun(n, one: one, two: two, few: few, many: many)
    }

    static func storiesCount(_ n: Int) -> String {
        count(n, one: "مادة واحدة", two: "مادتان", few: "مواد", many: "مادة")
    }

    static func bytes(_ value: Int?) -> String {
        guard let value else { return "" }
        let mb = Double(value) / 1_048_576
        if mb >= 1 { return String(format: "%.1f م.ب", mb) }
        return "\(max(1, value / 1024)) ك.ب"
    }
}

/// شارة حالة المادة بألوان دلالية هادئة.
struct StatusPill: View {
    let status: StoryStatus
    var label: String? = nil

    var body: some View {
        HStack(spacing: 5) {
            Image(systemName: status.symbol).font(.system(size: 10, weight: .semibold))
            Text(label ?? status.label)
        }
        .font(ElmFonts.text(.caption2, weight: .bold))
        .foregroundStyle(tint)
        .padding(.horizontal, 9)
        .padding(.vertical, 4)
        .background(tint.opacity(0.12), in: Capsule())
        .accessibilityLabel("الحالة: \(label ?? status.label)")
    }

    private var tint: Color {
        switch status {
        case .draft: ElmTheme.ink2
        case .review: ElmTheme.warn
        case .scheduled: ElmTheme.focus
        case .published: ElmTheme.tealInk
        case .archived: ElmTheme.ink3
        }
    }
}

/// شارة الحارس التحريري: سليم / تحذير / قاطع.
struct GuardChipView: View {
    let chip: StaffGuardChip

    var body: some View {
        Text(chip.label)
            .font(ElmFonts.text(.caption2, weight: .semibold))
            .foregroundStyle(tint)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(tint.opacity(0.1), in: Capsule())
            .accessibilityLabel("الحارس: \(chip.label)")
    }

    private var tint: Color {
        switch chip.tone {
        case "block": ElmTheme.danger
        case "warn": ElmTheme.warn
        default: ElmTheme.tealInk
        }
    }
}

/// صف مادة في قوائم اللوحة.
struct StaffStoryRowView: View {
    let row: StaffStoryRow
    var showStatus = true
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 7) {
                Text(row.displayTitle)
                    .font(ElmFonts.text(.subheadline, weight: .semibold))
                    .foregroundStyle(ElmTheme.ink)
                    .fixedSize(horizontal: false, vertical: true)
                    .lineLimit(3)
                ElmFlow(spacing: 6) {
                    if showStatus { StatusPill(status: row.storyStatus, label: row.statusLabel) }
                    if let chip = row.guardChip { GuardChipView(chip: chip) }
                    if let series = row.series {
                        HStack(spacing: 4) {
                            Circle().fill(ElmTheme.hex(series.color)).frame(width: 6, height: 6)
                            Text(series.name)
                        }
                        .font(ElmFonts.text(.caption2, weight: .medium))
                        .foregroundStyle(ElmTheme.ink2)
                    }
                    if row.revisionOf != nil {
                        Text("مسودة تعديل").font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink3)
                    }
                    if row.isJak == true {
                        Text("جاك العلم").font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.gold)
                    }
                }
                Text(meta)
                    .font(ElmFonts.text(.caption2))
                    .foregroundStyle(ElmTheme.ink3)
                    .lineLimit(2)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            if row.imageURL != nil && !typeSize.isAccessibilitySize {
                RemoteImage(url: row.imageURL, height: 64, maxPixel: 240)
                    .frame(width: 84)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            }
        }
        .padding(.vertical, 10)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }

    private var meta: String {
        var parts: [String] = []
        if let archive = row.archive {
            parts.append("أُرشفت \(StaffFormat.smart(archive.at))" + (archive.actor.map { " · \($0)" } ?? "") + " — \(archive.reason)")
            return parts.joined(separator: " · ")
        }
        if let author = row.authorName, !author.isEmpty { parts.append(author) }
        if let section = row.sectionName ?? row.section { parts.append(ElmFormat.sectionName(section)) }
        if row.storyStatus == .scheduled, let at = row.scheduledAt { parts.append("موعد النشر \(StaffFormat.dateTime(at))") }
        else if let updated = row.updatedAt ?? row.publishedAt { parts.append(StaffFormat.smart(updated)) }
        if let due = row.dueAt { parts.append("التسليم \(StaffFormat.smart(due))") }
        return parts.joined(separator: " · ")
    }
}

/// عنوان قسم داخل اللوحة.
struct StaffSectionTitle: View {
    let title: String
    var detail: String? = nil
    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(title).font(ElmFonts.display(.headline, weight: .bold)).foregroundStyle(ElmTheme.ink)
            Spacer()
            if let detail { Text(detail).font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink3) }
        }
        .accessibilityAddTraits(.isHeader)
    }
}

/// حالة خطأ موحدة مع إعادة محاولة.
struct StaffErrorView: View {
    let error: ElmAPIError
    var retry: (() -> Void)? = nil
    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: error.isConnectivity ? "wifi.slash" : "exclamationmark.triangle")
                .font(.system(size: 28)).foregroundStyle(ElmTheme.ink3)
            Text(error.message)
                .font(ElmFonts.text(.footnote)).foregroundStyle(ElmTheme.ink2)
                .multilineTextAlignment(.center)
            if let retry {
                Button("إعادة المحاولة", action: retry)
                    .font(ElmFonts.text(.footnote, weight: .semibold))
                    .frame(minHeight: 44)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(24)
    }
}

struct StaffEmptyView: View {
    let title: String
    var detail: String? = nil
    var symbol = "tray"
    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: symbol).font(.system(size: 28)).foregroundStyle(ElmTheme.ink3)
            Text(title).font(ElmFonts.text(.subheadline, weight: .semibold)).foregroundStyle(ElmTheme.ink)
            if let detail { Text(detail).font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink3).multilineTextAlignment(.center) }
        }
        .frame(maxWidth: .infinity)
        .padding(28)
    }
}

/// لافتة خطأ مضمّنة (لا تحجب المحتوى).
struct StaffInlineError: View {
    let message: String
    /// إعادة المحاولة عند توفرها — كل خطأ تحميل في اللوحة يعرض هذا الزر.
    var retry: (() -> Void)? = nil
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label(message, systemImage: "exclamationmark.circle.fill")
                .font(ElmFonts.text(.footnote, weight: .medium))
                .foregroundStyle(ElmTheme.danger)
                .accessibilityLabel("خطأ: \(message)")
            if let retry {
                Button("إعادة المحاولة", action: retry)
                    .font(ElmFonts.text(.footnote, weight: .semibold))
                    .foregroundStyle(ElmTheme.navyInk)
                    .frame(minHeight: 36)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(ElmTheme.danger.opacity(0.08), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

struct StaffInlineNotice: View {
    let message: String
    var symbol = "info.circle"
    var body: some View {
        Label(message, systemImage: symbol)
            .font(ElmFonts.text(.footnote))
            .foregroundStyle(ElmTheme.ink2)
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(ElmTheme.surface2, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

/// بطاقة مجموعة بسطح أبيض وحدّ — نمط «تحرير العلم».
struct StaffCard<Content: View>: View {
    var padding: CGFloat = 14
    @ViewBuilder var content: () -> Content
    var body: some View {
        VStack(alignment: .leading, spacing: 10) { content() }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(padding)
            .background(ElmTheme.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(ElmTheme.line, lineWidth: 1))
    }
}

/// بلاطة رقم.
struct StaffStatTile: View {
    let value: String
    let label: String
    var tint: Color = ElmTheme.navyInk
    /// سطر تفسيري صغير تحت التسمية (مثل «3 فيها مخالفة قاطعة»).
    var hint: String? = nil
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(ElmFormat.latinDigits(value))
                .font(ElmFonts.display(.title2, weight: .heavy))
                .foregroundStyle(tint)
                .monospacedDigit()
            Text(label).font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink2).lineLimit(2)
            if let hint { Text(hint).font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink3).lineLimit(2) }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(ElmTheme.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(ElmTheme.line, lineWidth: 1))
        .accessibilityElement(children: .combine)
    }
}

/// زر أساسي كحلي بعرض كامل.
struct StaffPrimaryButton: View {
    let title: String
    var symbol: String? = nil
    var busy = false
    var tint: Color = ElmTheme.navy
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if busy { ProgressView().tint(.white) }
                else if let symbol { Image(systemName: symbol) }
                Text(title)
            }
            .font(ElmFonts.text(.subheadline, weight: .bold))
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity, minHeight: 48)
            .background(tint, in: RoundedRectangle(cornerRadius: 13, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(busy)
    }
}

struct StaffSecondaryButton: View {
    let title: String
    var symbol: String? = nil
    var destructive = false
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if let symbol { Image(systemName: symbol) }
                Text(title)
            }
            .font(ElmFonts.text(.subheadline, weight: .semibold))
            .foregroundStyle(destructive ? ElmTheme.danger : ElmTheme.ink)
            .frame(maxWidth: .infinity, minHeight: 46)
            .background(ElmTheme.surface, in: RoundedRectangle(cornerRadius: 13, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 13, style: .continuous).stroke(ElmTheme.line2, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}

/// حقل نص باسم — نمط نموذج اللوحة.
struct StaffField: View {
    let label: String
    var placeholder = ""
    @Binding var text: String
    var axis: Axis = .horizontal
    var keyboard: UIKeyboardType = .default
    var ltr = false
    var hint: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).font(ElmFonts.text(.caption, weight: .bold)).foregroundStyle(ElmTheme.ink)
            TextField(placeholder, text: $text, axis: axis)
                .font(ElmFonts.text(.callout))
                .keyboardType(keyboard)
                .autocorrectionDisabled(ltr)
                .textInputAutocapitalization(ltr ? .never : .sentences)
                .padding(12)
                .background(ElmTheme.surface, in: RoundedRectangle(cornerRadius: 11, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 11, style: .continuous).stroke(ElmTheme.line2, lineWidth: 1))
                .environment(\.layoutDirection, ltr ? .leftToRight : .rightToLeft)
            if let hint { Text(hint).font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink3) }
        }
    }
}

struct StaffSecureField: View {
    let label: String
    @Binding var text: String
    var contentType: UITextContentType = .password
    var submitLabel: SubmitLabel = .done
    var onSubmit: (() -> Void)? = nil
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).font(ElmFonts.text(.caption, weight: .bold)).foregroundStyle(ElmTheme.ink)
            SecureField("", text: $text)
                .font(ElmFonts.text(.callout))
                .textContentType(contentType)
                .submitLabel(submitLabel)
                .onSubmit { onSubmit?() }
                .padding(12)
                .background(ElmTheme.surface, in: RoundedRectangle(cornerRadius: 11, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 11, style: .continuous).stroke(ElmTheme.line2, lineWidth: 1))
                .environment(\.layoutDirection, .leftToRight)
        }
    }
}

/// صف قائمة بسهم للتنقل داخل اللوحة.
struct StaffMenuRow: View {
    let title: String
    var detail: String? = nil
    var symbol: String
    var badge: Int? = nil
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: symbol)
                .font(.system(size: 16, weight: .medium))
                .foregroundStyle(ElmTheme.navyInk)
                .frame(width: 34, height: 34)
                .background(ElmTheme.navyInk.opacity(0.08), in: RoundedRectangle(cornerRadius: 9, style: .continuous))
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(ElmFonts.text(.subheadline, weight: .semibold)).foregroundStyle(ElmTheme.ink)
                if let detail { Text(detail).font(ElmFonts.text(.caption2)).foregroundStyle(ElmTheme.ink3).lineLimit(1) }
            }
            Spacer(minLength: 6)
            if let badge, badge > 0 {
                Text(ElmFormat.latinDigits(String(badge)))
                    .font(ElmFonts.text(.caption2, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 7).padding(.vertical, 2)
                    .background(ElmTheme.danger, in: Capsule())
            }
            Image(systemName: "chevron.left").font(.system(size: 12, weight: .semibold)).foregroundStyle(ElmTheme.ink3)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 11)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }
}

/// حاوية شاشة داخل اللوحة: شريط نظامي مخفي، رأس العلم، وتمرير مع تحديث بالسحب.
struct StaffScreen<Content: View>: View {
    let title: String
    var showBack = false
    var onRefresh: (() async -> Void)? = nil
    @ViewBuilder var content: () -> Content

    var body: some View {
        ElmScreen(title: title, showBack: showBack, showTools: false, bottomInset: 36, onRefresh: onRefresh) {
            content()
                .frame(maxWidth: 760)
                .frame(maxWidth: .infinity)
        }
    }
}

extension View {
    /// منتقي التاريخ بتوقيت الرياض والتقويم الميلادي وأرقام لاتينية — كما يُعرض نص التأكيد.
    func riyadhPicker() -> some View {
        environment(\.timeZone, TimeZone(identifier: "Asia/Riyadh")!)
            .environment(\.calendar, Calendar(identifier: .gregorian))
            .environment(\.locale, Locale(identifier: "ar-SA@calendar=gregorian;numbers=latn"))
    }
}

/// ورقة سبب (الأرشفة/الإعادة للتعديل): رقائق أسباب جاهزة اختيارية، حقل حر، وحد أدنى/أقصى يعطّل الزر قبل الإرسال.
struct StaffReasonSheet: View {
    @Environment(\.dismiss) private var dismiss
    let title: String
    let message: String
    var placeholder: String
    var chips: [String] = []
    var minLength = 8
    var maxLength = 4000
    var confirmTitle: String
    var destructive = false
    @Binding var reason: String
    let onConfirm: () -> Void

    private var collapsed: String { reason.replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression).trimmingCharacters(in: .whitespaces) }
    private var valid: Bool { collapsed.count >= minLength && collapsed.count <= maxLength }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    Text(title).font(ElmFonts.display(.title3, weight: .heavy)).foregroundStyle(ElmTheme.ink)
                    Text(message).font(ElmFonts.text(.footnote)).foregroundStyle(ElmTheme.ink2).lineSpacing(3)
                    if !chips.isEmpty {
                        ElmFlow(spacing: 6) {
                            ForEach(chips, id: \.self) { chip in
                                ElmChip(label: chip, selected: collapsed == chip) { reason = chip }
                            }
                        }
                    }
                    StaffField(label: "السبب", placeholder: placeholder, text: $reason, axis: .vertical,
                               hint: "\(ElmFormat.latinDigits(String(collapsed.count))) حرفًا · \(ElmFormat.latinDigits(String(minLength))) أحرف على الأقل\(maxLength < 100_000 ? " و\(ElmFormat.latinDigits(String(maxLength))) على الأكثر" : "")")
                    StaffPrimaryButton(title: confirmTitle, symbol: destructive ? "archivebox" : "arrow.uturn.right", tint: destructive ? ElmTheme.danger : ElmTheme.navy) {
                        dismiss()
                        onConfirm()
                    }
                    .disabled(!valid)
                    .opacity(valid ? 1 : 0.55)
                }
                .padding(22)
            }
            .background(ElmTheme.bg.ignoresSafeArea())
            .toolbar { ToolbarItem(placement: .topBarLeading) { Button("إلغاء") { dismiss() } } }
        }
        .presentationDetents([.medium, .large])
    }
}

import Foundation

enum ElmFormat {
    static let sections: [String: String] = [
        "politics": "سياسة",
        "sport": "رياضة",
        "economy": "اقتصاد",
        "health": "صحة",
        "technology": "تقنية",
        "culture": "ثقافة",
        "business": "أعمال",
        "art": "فن",
        "sciences": "علوم",
        "varieties": "منوعات",
        "news": "أخبار",
        "current-events": "أحداث جارية",
        "world": "عالم",
        "ksa": "السعودية",
        "infographics": "إنفوجرافيك",
        "videos": "مرئي",
    ]

    static func sectionName(_ slug: String) -> String {
        sections[slug] ?? slug
    }

    static func latinDigits(_ input: String) -> String {
        let map: [Character: Character] = [
            "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
            "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
            "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
            "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
        ]
        return String(input.map { map[$0] ?? $0 }).replacingOccurrences(of: "٪", with: "%")
    }

    static func twoDigit(_ value: Int) -> String {
        String(format: "%02d", value)
    }

    static func readingLabel(_ minutes: Int) -> String {
        switch minutes {
        case ...1: "دقيقة قراءة"
        case 2: "دقيقتا قراءة"
        case 3...10: "\(latinDigits(String(minutes))) دقائق قراءة"
        default: "\(latinDigits(String(minutes))) دقيقة قراءة"
        }
    }

    static func watchingLabel(_ minutes: Int) -> String {
        switch minutes {
        case ...1: "دقيقة مشاهدة"
        case 2: "دقيقتا مشاهدة"
        case 3...10: "\(latinDigits(String(minutes))) دقائق مشاهدة"
        default: "\(latinDigits(String(minutes))) دقيقة مشاهدة"
        }
    }

    static func dayLabel(_ count: Int) -> String {
        switch count {
        case 0: "لم تبدأ بعد"
        case 1: "يوم واحد"
        case 2: "يومان"
        case 3...10: "\(latinDigits(String(count))) أيام"
        default: "\(latinDigits(String(count))) يومًا"
        }
    }

    static func materialLabel(_ count: Int) -> String {
        switch count {
        case 0: "لا مواد"
        case 1: "مادة واحدة"
        case 2: "مادتان"
        case 3...10: "\(latinDigits(String(count))) مواد"
        default: "\(latinDigits(String(count))) مادة"
        }
    }

    static func relativeTime(_ iso: String?) -> String? {
        guard let iso, let date = parseDate(iso) else { return nil }
        let hours = Int(Date().timeIntervalSince(date) / 3600)
        if hours < 1 { return "قبل قليل" }
        if hours < 24 { return "منذ \(countedNoun(hours, one: "ساعة", two: "ساعتين", few: "ساعات", many: "ساعة"))" }
        let days = max(1, hours / 24)
        if days == 1 { return "أمس" }
        return "منذ \(countedNoun(days, one: "يوم", two: "يومين", few: "أيام", many: "يومًا"))"
    }

    /// تمييز العدد العربي: مفرد، مثنى، جمع قلة (3–10)، ثم تمييز مفرد منصوب.
    static func countedNoun(_ count: Int, one: String, two: String, few: String, many: String) -> String {
        switch count {
        case 1: one
        case 2: two
        case 3...10: "\(latinDigits(String(count))) \(few)"
        default: "\(latinDigits(String(count))) \(many)"
        }
    }

    /// تاريخ اليوم ميلاديًا بتوقيت الرياض مع اسم اليوم — أرقام لاتينية كما على الموقع.
    static func todayStrip() -> String {
        format(Date(), calendar: Calendar(identifier: .gregorian), withWeekday: true)
    }

    static func brandDate(_ iso: String?) -> String? {
        guard let iso, let date = parseDate(iso) else { return nil }
        return format(date, calendar: Calendar(identifier: .gregorian))
    }

    /// مدة الحلقة: ثوانٍ ("4228") أو "mm:ss"/"h:mm:ss" كما تصل من الخلاصة — تُعرض h:mm:ss بأرقام لاتينية.
    static func durationLabel(_ raw: String?) -> String? {
        guard let raw = raw.map(latinDigits)?.trimmingCharacters(in: .whitespaces), !raw.isEmpty else { return nil }
        let seconds: Int
        if raw.contains(":") {
            let parts = raw.split(separator: ":").compactMap { Int($0) }
            guard !parts.isEmpty else { return nil }
            seconds = parts.reduce(0) { $0 * 60 + $1 }
        } else if let value = Double(raw) {
            seconds = Int(value)
        } else {
            return nil
        }
        return clock(seconds)
    }

    /// h:mm:ss أو m:ss.
    static func clock(_ totalSeconds: Int) -> String {
        let total = max(0, totalSeconds)
        let hours = total / 3600, minutes = (total % 3600) / 60, seconds = total % 60
        if hours > 0 { return "\(hours):\(twoDigit(minutes)):\(twoDigit(seconds))" }
        return "\(minutes):\(twoDigit(seconds))"
    }

    static func bodyParagraphs(_ raw: String) -> [String] {
        var text = raw
        if raw.range(of: #"<(p|h2|h3|ul|ol|li|blockquote|strong|em|br)\b"#, options: [.regularExpression, .caseInsensitive]) != nil {
            text = raw.replacingOccurrences(
                of: #"(?i)</(p|h2|h3|li|blockquote|ul|ol)>|<br\s*/?>"#,
                with: "\n",
                options: .regularExpression
            )
            text = text.replacingOccurrences(of: #"<[^>]+>"#, with: "", options: .regularExpression)
            let entities = [
                "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">",
                "&quot;": "\"", "&#39;": "'", "&hellip;": "…",
            ]
            for (entity, value) in entities {
                text = text.replacingOccurrences(of: entity, with: value)
            }
        }
        return text
            .components(separatedBy: .newlines)
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .map(latinDigits)
    }

    static func percent(from title: String) -> String? {
        let pattern = /(\d{2,4})\s*%/
        guard let match = title.firstMatch(of: pattern) else { return nil }
        return String(match.1)
    }

    private static func format(_ date: Date, calendar: Calendar, withWeekday: Bool = false) -> String {
        var cal = calendar
        cal.locale = Locale(identifier: "ar_SA")
        cal.timeZone = TimeZone(identifier: "Asia/Riyadh") ?? .current
        let formatter = DateFormatter()
        formatter.calendar = cal
        formatter.timeZone = cal.timeZone
        formatter.locale = Locale(identifier: "ar_SA@numbers=latn")
        formatter.dateFormat = withWeekday ? "EEEE d MMMM yyyy" : "d MMMM yyyy"
        return latinDigits(formatter.string(from: date))
    }

    private static func parseDate(_ iso: String) -> Date? {
        let isoFrac = ISO8601DateFormatter()
        isoFrac.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = isoFrac.date(from: iso) { return date }
        let isoPlain = ISO8601DateFormatter()
        isoPlain.formatOptions = [.withInternetDateTime]
        return isoPlain.date(from: iso)
    }
}

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
        "\(latinDigits(String(minutes))) دقائق قراءة"
    }

    static func relativeTime(_ iso: String?) -> String? {
        guard let iso, let date = parseDate(iso) else { return nil }
        let hours = Int(Date().timeIntervalSince(date) / 3600)
        if hours < 1 { return "قبل قليل" }
        if hours < 24 { return "منذ \(latinDigits(String(hours))) ساعات" }
        let days = max(1, hours / 24)
        return "منذ \(latinDigits(String(days))) أيام"
    }

    static func todayStrip() -> String {
        let now = Date()
        return "\(format(now, calendar: Calendar(identifier: .islamicUmmAlQura))) · \(format(now, calendar: Calendar(identifier: .gregorian)))"
    }

    static func brandDate(_ iso: String?) -> String? {
        guard let iso, let date = parseDate(iso) else { return nil }
        return "\(format(date, calendar: Calendar(identifier: .islamicUmmAlQura))) — \(format(date, calendar: Calendar(identifier: .gregorian)))"
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

    private static func format(_ date: Date, calendar: Calendar) -> String {
        var cal = calendar
        cal.locale = Locale(identifier: "ar_SA")
        let formatter = DateFormatter()
        formatter.calendar = cal
        formatter.locale = Locale(identifier: "ar_SA@numbers=latn")
        formatter.dateFormat = "d MMMM yyyy"
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

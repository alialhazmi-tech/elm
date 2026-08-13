import Foundation
import Observation

/// أصوات استفتاء الختام — على الجهاز حتى يصل عقد `/me/events`.
@MainActor
@Observable
final class PollStore {
    private let key = "elm.polls.v1"
    private(set) var votes: [String: String] = [:]

    init() {
        votes = UserDefaults.standard.dictionary(forKey: key) as? [String: String] ?? [:]
    }

    func vote(_ option: String, on storyId: String) {
        votes[storyId] = option
        UserDefaults.standard.set(votes, forKey: key)
    }

    func choice(for storyId: String) -> String? { votes[storyId] }
}

/// تفضيلات الإشعارات: موجز الصباح وحده مُفعّل افتراضيًا، وما عداه بقرار القارئ.
@MainActor
@Observable
final class NotificationPrefs {
    enum Kind: String, CaseIterable, Identifiable {
        case morning, breaking, series, streak
        var id: String { rawValue }

        var label: String {
            switch self {
            case .morning: "موجز الصباح"
            case .breaking: "العاجل فقط"
            case .series: "كل مادة جديدة في سلاسلي"
            case .streak: "تذكير سلسلة القراءة"
            }
        }

        var defaultOn: Bool { self == .morning }
    }

    private let key = "elm.notifprefs.v1"
    private(set) var enabled: [String: Bool] = [:]

    init() {
        if let stored = UserDefaults.standard.dictionary(forKey: key) as? [String: Bool] {
            enabled = stored
        } else {
            enabled = Dictionary(uniqueKeysWithValues: Kind.allCases.map { ($0.rawValue, $0.defaultOn) })
        }
    }

    func isOn(_ kind: Kind) -> Bool { enabled[kind.rawValue] ?? kind.defaultOn }

    func toggle(_ kind: Kind) {
        enabled[kind.rawValue] = !isOn(kind)
        UserDefaults.standard.set(enabled, forKey: key)
    }
}

/// التنزيل التلقائي وسلسلة القراءة — أساس شاشتي المحفوظات و«لك أنت».
@MainActor
@Observable
final class ReadingStore {
    private let autoKey = "elm.autodownload.v1"
    private let daysKey = "elm.readdays.v1"

    var autoDownload: Bool {
        didSet { UserDefaults.standard.set(autoDownload, forKey: autoKey) }
    }

    /// أيام القراءة كتواريخ `yyyy-MM-dd`، الأحدث أولًا.
    private(set) var days: [String] = []

    init() {
        autoDownload = UserDefaults.standard.object(forKey: autoKey) as? Bool ?? true
        days = UserDefaults.standard.stringArray(forKey: daysKey) ?? []
    }

    private static let dayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    func markRead(on date: Date = .now) {
        let key = Self.dayFormatter.string(from: date)
        guard !days.contains(key) else { return }
        days = ([key] + days).prefix(400).map { $0 }
        UserDefaults.standard.set(days, forKey: daysKey)
    }

    /// أيام متتالية تنتهي باليوم أو بالأمس — تنكسر بأول يوم غائب.
    var streak: Int {
        let set = Set(days)
        let calendar = Calendar(identifier: .gregorian)
        var cursor = Date.now
        if !set.contains(Self.dayFormatter.string(from: cursor)) {
            guard let yesterday = calendar.date(byAdding: .day, value: -1, to: cursor),
                  set.contains(Self.dayFormatter.string(from: yesterday)) else { return 0 }
            cursor = yesterday
        }
        var count = 0
        while set.contains(Self.dayFormatter.string(from: cursor)) {
            count += 1
            guard let previous = calendar.date(byAdding: .day, value: -1, to: cursor) else { break }
            cursor = previous
        }
        return count
    }

    /// آخر سبعة أيام: هل قُرئ فيها؟ الأقدم أولًا كما في شريط الأسبوع.
    func week() -> [(label: String, read: Bool)] {
        let calendar = Calendar(identifier: .gregorian)
        let labels = ["ح", "ن", "ث", "ر", "خ", "ج", "س"]
        let set = Set(days)
        return (0..<7).reversed().compactMap { back in
            guard let date = calendar.date(byAdding: .day, value: -back, to: .now) else { return nil }
            let weekday = calendar.component(.weekday, from: date) - 1
            return (labels[weekday % 7], set.contains(Self.dayFormatter.string(from: date)))
        }
    }
}

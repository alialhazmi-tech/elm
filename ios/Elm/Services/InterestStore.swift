import Foundation
import Observation

struct InterestItem: Identifiable, Hashable, Sendable {
    var id: String
    var label: String
    var description: String
    var color: String
    var contentKeys: [String]
}

enum InterestCatalog {
    static let all: [InterestItem] = [
        .init(id: "saudi", label: "السعودية", description: "المجتمع والتحولات والمشروعات", color: "2f7d66", contentKeys: ["politics", "محليات", "السعودية", "المملكة"]),
        .init(id: "world", label: "العالم", description: "سياسة دولية وتحولات عالمية", color: "526da8", contentKeys: ["current-events", "العالم", "دولي"]),
        .init(id: "economy", label: "الاقتصاد", description: "أسواق وطاقة واستثمار وعقار", color: "d99a18", contentKeys: ["economy", "اقتصاد", "استثمار", "طاقة", "أسواق"]),
        .init(id: "technology", label: "التقنية", description: "أجهزة وتطبيقات وأمن سيبراني", color: "3d7ef7", contentKeys: ["technology", "تقنية", "رقمي", "أمن سيبراني"]),
        .init(id: "ai", label: "الذكاء الاصطناعي", description: "النماذج والتطبيقات ومستقبل العمل", color: "7057d9", contentKeys: ["ذكاء اصطناعي", "الذكاء الاصطناعي", "روبوت", "خوارزم"]),
        .init(id: "health", label: "الصحة", description: "الجسد والنفس وجودة الحياة", color: "12a88f", contentKeys: ["health", "صحة", "طبي", "نفسي"]),
        .init(id: "science", label: "العلوم", description: "الفضاء والطبيعة والاكتشافات", color: "14a8d6", contentKeys: ["science", "علوم", "فضاء", "اكتشاف"]),
        .init(id: "culture", label: "الثقافة", description: "كتب وفنون وأفكار ومجتمع", color: "e56b2f", contentKeys: ["culture", "ثقافة", "كتاب", "فن"]),
        .init(id: "society", label: "المجتمع", description: "حياة الناس والظواهر الاجتماعية", color: "9b5e8f", contentKeys: ["society", "مجتمع", "اجتماعي"]),
        .init(id: "environment", label: "البيئة", description: "مناخ واستدامة وطبيعة", color: "4b9866", contentKeys: ["environment", "بيئة", "مناخ", "استدامة"]),
        .init(id: "travel", label: "السفر", description: "وجهات وتجارب ومدن", color: "20899a", contentKeys: ["travel", "سفر", "سياحة", "وجهة"]),
        .init(id: "sport", label: "الرياضة", description: "منافسات وأندية وصناعة الرياضة", color: "ef476f", contentKeys: ["sport", "رياضة", "نادي", "دوري"]),
    ]
}

@MainActor
@Observable
final class InterestStore {
    private let key = "elm.interests.v1"
    var selected: Set<String> = []

    var items: [InterestItem] {
        InterestCatalog.all.filter { selected.contains($0.id) }
    }

    init() {
        if let ids = UserDefaults.standard.array(forKey: key) as? [String] {
            selected = Set(ids)
        }
    }

    func toggle(_ id: String) {
        var next = selected
        if next.contains(id) {
            next.remove(id)
        } else {
            next.insert(id)
        }
        selected = next
        UserDefaults.standard.set(Array(selected), forKey: key)
    }

    func clear() {
        selected = []
        UserDefaults.standard.set([], forKey: key)
    }
}

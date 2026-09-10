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

    /// حدود الويب: التهيئة 3–7 (`/welcome`)، والحساب حتى 12 (`app/account/actions.ts`).
    static let onboardingMinimum = 3
    static let onboardingMaximum = 7
    static let accountMaximum = 12
}

extension Notification.Name {
    /// ملف العضو بلا اهتمامات (لم يُكمل التهيئة على الويب أو التطبيق) — `OnboardingStore` يعرض شاشة الاهتمامات.
    static let elmMemberNeedsOnboarding = Notification.Name("elm.member.needsOnboarding")
}

@MainActor
@Observable
final class InterestStore {
    private static let guestKey = "elm.interests.v1"
    private var memberId: String?
    private var epoch = UUID()
    private var revision = 0
    /// حسابات عُرضت عليها التهيئة في هذه الجلسة — مرة واحدة لكل حساب في كل إقلاع.
    private var promptedAccounts: Set<String> = []
    private var key: String { memberId.map { "elm.interests.member.\($0)" } ?? Self.guestKey }
    var syncError: String?
    var syncing = false
    var selected: Set<String> = []
    /// الحساب الحالي لم يحفظ اهتمامات بعد (`interestIds` فارغة على الخادم).
    var needsOnboarding = false

    var items: [InterestItem] {
        InterestCatalog.all.filter { selected.contains($0.id) }
    }

    init() {
        if let ids = UserDefaults.standard.array(forKey: key) as? [String] {
            selected = Set(ids)
        }
    }

    func switchAccount(_ id: String?, appearance: AppearanceStore) async {
        // اختيارات الزائر على هذا الجهاز تُقترح كقيمة ابتدائية للحساب الذي لم يُكمل تهيئته.
        let guestSelection = Set(UserDefaults.standard.stringArray(forKey: Self.guestKey) ?? [])
        memberId = id; epoch = UUID(); revision = 0; syncing = false; syncError = nil; needsOnboarding = false
        selected = Set(UserDefaults.standard.stringArray(forKey: key) ?? [])
        appearance.switchAccount(id)
        guard let id else { return }
        let token = epoch, version = revision
        do {
            let profile = try await APIClient.fetchProfile()
            guard token == epoch, profile.memberId == id else { return }
            if version == revision {
                appearance.personalizationEnabled = profile.personalizationEnabled
                if profile.interestIds.isEmpty {
                    // كما على الويب: الدخول أو التسجيل بلا اهتمامات يقود إلى `/welcome`.
                    needsOnboarding = true
                    if selected.isEmpty { selected = guestSelection }
                    UserDefaults.standard.set(Array(selected), forKey: key)
                    if !promptedAccounts.contains(id) {
                        promptedAccounts.insert(id)
                        NotificationCenter.default.post(name: .elmMemberNeedsOnboarding, object: nil)
                    }
                } else {
                    selected = Set(profile.interestIds)
                    UserDefaults.standard.set(Array(selected), forKey: key)
                }
            }
        } catch { if token == epoch { syncError = "تعذرت مزامنة تفضيلات الحساب. حاول مجددًا." } }
    }

    /// `POST /api/me/profile action=interests` — الخادم يضبط `onboardingCompleted=1` مع الحفظ.
    func save() async -> Bool {
        guard let memberId else { return true }
        let token = epoch
        syncing = true; syncError = nil
        defer { if token == epoch { syncing = false } }
        do {
            try await APIClient.updateProfile(memberId: memberId, action: "interests", interests: Array(selected))
            if token == epoch { needsOnboarding = false }
            return token == epoch
        } catch { if token == epoch { syncError = "لم تُحفظ الاهتمامات في حسابك. تحقق من الاتصال وحاول مجددًا." }; return false }
    }

    func setPersonalization(_ enabled: Bool, appearance: AppearanceStore) async {
        guard !syncing else { return }
        revision += 1
        guard let memberId else { appearance.personalizationEnabled = enabled; return }
        let token = epoch
        syncing = true; syncError = nil
        defer { if token == epoch { syncing = false } }
        do {
            try await APIClient.updateProfile(memberId: memberId, action: "personalization", enabled: enabled)
            if token == epoch { appearance.personalizationEnabled = enabled }
        } catch { if token == epoch { syncError = "تعذر حفظ إعداد الخصوصية؛ لم يتغير. حاول مجددًا." } }
    }

    func toggle(_ id: String) {
        revision += 1
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
        revision += 1
        selected = []
        UserDefaults.standard.set([], forKey: key)
    }
}

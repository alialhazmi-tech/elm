import Foundation
import Network
import Observation

@MainActor
@Observable
final class ConnectivityStore {
    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "net.alelm.connectivity")
    private var offlineProbe: Task<Void, Never>?

    var isOffline = false
    var isExpensive = false

    init() {
        monitor.pathUpdateHandler = { path in
            let offline = path.status != .satisfied
            let expensive = path.isExpensive
            Task { @MainActor [weak self] in
                guard let self else { return }
                self.isExpensive = expensive
                self.offlineProbe?.cancel()
                if !offline {
                    self.isOffline = false
                    return
                }
                // NWPathMonitor يعلن انقطاعًا كاذبًا على المحاكي وأثناء التبديل بين
                // الشبكات بينما URLSession يعمل — لا نصدّقه إلا بعد مهلة وفحص فعلي.
                self.offlineProbe = Task { @MainActor [weak self] in
                    try? await Task.sleep(for: .seconds(1.5))
                    guard !Task.isCancelled else { return }
                    let reachable = await ConnectivityStore.probe()
                    guard !Task.isCancelled else { return }
                    self?.isOffline = !reachable
                }
            }
        }
        monitor.start(queue: queue)
    }

    /// أي استجابة HTTP — حتى الخطأ — تثبت أن الشبكة سالكة؛ الرمي وحده يعني الانقطاع.
    private static func probe() async -> Bool {
        var request = URLRequest(url: URLConstants.productionAPI.appending(path: "api/mobile/v1/home"))
        request.httpMethod = "HEAD"
        request.timeoutInterval = 4
        let config = URLSessionConfiguration.ephemeral
        config.waitsForConnectivity = false
        config.timeoutIntervalForResource = 5
        let session = URLSession(configuration: config)
        defer { session.finishTasksAndInvalidate() }
        do {
            _ = try await session.data(for: request)
            return true
        } catch {
            return false
        }
    }

    deinit {
        monitor.cancel()
    }
}

/// جولة الترحيب للزائر مرة واحدة على الجهاز؛ أما العضو فتهيئته بحسب حسابه: ملف بلا اهتمامات
/// (`InterestStore.needsOnboarding`) يعيد عرض الشاشة كما يحوّل الويب إلى `/welcome`.
@MainActor
@Observable
final class OnboardingStore {
    private let completionKey = "elm.onboarding.v2"
    @ObservationIgnored private var memberObserver: NSObjectProtocol?

    var isPresented: Bool {
        didSet {
            if !isPresented {
                UserDefaults.standard.set(true, forKey: completionKey)
            }
        }
    }

    init() {
        isPresented = !UserDefaults.standard.bool(forKey: completionKey)
        memberObserver = NotificationCenter.default.addObserver(forName: .elmMemberNeedsOnboarding, object: nil, queue: .main) { [weak self] _ in
            // مهلة قصيرة حتى تكتمل إزاحة ورقة الدخول قبل عرض الغطاء الكامل.
            Task { @MainActor [weak self] in
                try? await Task.sleep(for: .milliseconds(450))
                self?.present()
            }
        }
    }

    func complete() {
        isPresented = false
    }

    func present() {
        isPresented = true
    }
}

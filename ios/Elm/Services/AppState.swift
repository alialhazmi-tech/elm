import Foundation
import Network
import Observation

@MainActor
@Observable
final class ConnectivityStore {
    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "net.alelm.connectivity")

    var isOffline = false
    var isExpensive = false

    init() {
        monitor.pathUpdateHandler = { path in
            let offline = path.status != .satisfied
            let expensive = path.isExpensive
            Task { @MainActor [weak self] in
                guard let self else { return }
                self.isOffline = offline
                self.isExpensive = expensive
            }
        }
        monitor.start(queue: queue)
    }

    deinit {
        monitor.cancel()
    }
}

@MainActor
@Observable
final class OnboardingStore {
    private let completionKey = "elm.onboarding.v2"

    var isPresented: Bool {
        didSet {
            if !isPresented {
                UserDefaults.standard.set(true, forKey: completionKey)
            }
        }
    }

    init() {
        isPresented = !UserDefaults.standard.bool(forKey: completionKey)
    }

    func complete() {
        isPresented = false
    }

    func present() {
        isPresented = true
    }
}

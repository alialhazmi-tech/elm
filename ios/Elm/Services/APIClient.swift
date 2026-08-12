import Foundation

enum APIClientError: Error {
    case unauthorized
    case badStatus(Int)
    case empty
}

enum APIClient {
    private static let decoder = JSONDecoder()

    static func fetchHome() async throws -> (MobileHomePayload, Data) {
        var lastError: Error = APIClientError.empty

        #if DEBUG
        if let local = URLConstants.localAPI {
            do {
                return try await fetchData(URLConstants.mobileHome(on: local), timeout: 0.8)
            } catch {
                lastError = error
            }
        }
        #endif

        do {
            return try await fetchData(URLConstants.mobileHome(on: URLConstants.productionAPI), timeout: 12)
        } catch {
            lastError = error
        }

        do {
            return try await fetchData(URLConstants.webHome(on: URLConstants.productionAPI), timeout: 12)
        } catch {
            lastError = error
        }

        throw lastError
    }

    static func fetchStory(id: String) async throws -> StoryDetailPayload {
        try await fetchJSON { origin in
            origin.appending(path: "api/mobile/v1/story").appending(path: id)
        }
    }

    static func fetchSeriesIndex() async throws -> SeriesIndexPayload {
        try await fetchJSON { origin in
            origin.appending(path: "api/mobile/v1/series")
        }
    }

    static func fetchSeriesFeed(slug: String) async throws -> SeriesFeedPayload {
        try await fetchJSON { origin in
            origin.appending(path: "api/mobile/v1/series").appending(path: slug)
        }
    }

    static func fetchSearch(query: String) async throws -> SearchPayload {
        try await fetchJSON { origin in
            var components = URLComponents(url: origin.appending(path: "api/mobile/v1/search"), resolvingAgainstBaseURL: false)!
            components.queryItems = [URLQueryItem(name: "q", value: query)]
            return components.url ?? origin.appending(path: "api/mobile/v1/search")
        }
    }

    static func fetchForYou() async throws -> ForYouPayload {
        try await fetchJSON { origin in
            origin.appending(path: "api/mobile/v1/for-you")
        }
    }

    private static func fetchJSON<T: Decodable>(_ makeURL: (URL) -> URL) async throws -> T {
        var lastError: Error = APIClientError.empty
        #if DEBUG
        if let local = URLConstants.localAPI {
            do {
                return try await get(makeURL(local), timeout: 0.8)
            } catch {
                lastError = error
            }
        }
        #endif
        do {
            return try await get(makeURL(URLConstants.productionAPI), timeout: 12)
        } catch {
            lastError = error
        }
        throw lastError
    }

    private static func fetchData(_ url: URL, timeout: TimeInterval) async throws -> (MobileHomePayload, Data) {
        let data = try await data(url, timeout: timeout)
        return (try decoder.decode(MobileHomePayload.self, from: data), data)
    }

    private static func get<T: Decodable>(_ url: URL, timeout: TimeInterval) async throws -> T {
        let data = try await data(url, timeout: timeout)
        return try decoder.decode(T.self, from: data)
    }

    private static func data(_ url: URL, timeout: TimeInterval) async throws -> Data {
        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = timeout
        config.timeoutIntervalForResource = timeout
        config.waitsForConnectivity = false
        var request = URLRequest(url: url)
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        let (data, response) = try await URLSession(configuration: config).data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        if status == 401 { throw APIClientError.unauthorized }
        guard (200..<300).contains(status) else { throw APIClientError.badStatus(status) }
        return data
    }
}

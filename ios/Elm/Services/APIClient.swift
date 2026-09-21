import Foundation

enum APIClientError: Error {
    case unauthorized
    case badStatus(Int)
    case empty
}

enum APIClient {
    private static let decoder = JSONDecoder()

    struct MemberProfile: Decodable {
        let memberId: String
        let interestIds: [String]
        let personalizationEnabled: Bool
    }
    static func fetchProfile() async throws -> MemberProfile {
        try await get(URLConstants.memberAPI.appending(path: "api/me/profile"), timeout: 12)
    }
    static func updateProfile(memberId: String, action: String, interests: [String]? = nil, enabled: Bool? = nil) async throws {
        var body: [String: Any] = ["expectedMemberId": memberId, "action": action]
        if let interests { body["interestIds"] = interests }
        if let enabled { body["enabled"] = enabled }
        var request = URLRequest(url: URLConstants.memberAPI.appending(path: "api/me/profile"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (_, response) = try await session.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else { throw APIClientError.badStatus(status) }
    }

    struct SavedPage: Decodable {
        let memberId: String
        let items: [StoryCard]
        let nextOffset: Int?
    }

    static func fetchSaved(offset: Int) async throws -> SavedPage {
        var url = URLComponents(url: URLConstants.memberAPI.appending(path: "api/me/saved"), resolvingAgainstBaseURL: false)!
        url.queryItems = [URLQueryItem(name: "offset", value: String(offset))]
        return try await get(url.url!, timeout: 12)
    }

    static func setSaved(storyId: String, saved: Bool, memberId: String) async throws {
        var request = URLRequest(url: URLConstants.memberAPI.appending(path: "api/me/saved"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["storyId": storyId, "saved": saved, "expectedMemberId": memberId])
        let (_, response) = try await session.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else { throw APIClientError.badStatus(status) }
    }

    static func fetchHome() async throws -> (MobileHomePayload, Data) {
        var lastError: Error = APIClientError.empty

        #if DEBUG
        if let local = URLConstants.localAPI {
            return try await fetchData(URLConstants.mobileHome(on: local), timeout: 30)
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

    struct ArticleInteraction: Decodable {
        let liked: Bool
        let closingAnswer: Int?
        let counts: [Int]
    }

    static func fetchInteraction(storyId: String) async throws -> ArticleInteraction {
        var url = URLComponents(url: URLConstants.memberAPI.appending(path: "api/content/interactions"), resolvingAgainstBaseURL: false)!
        url.queryItems = [URLQueryItem(name: "storyId", value: storyId)]
        return try await get(url.url!, timeout: 12)
    }

    static func saveInteraction(storyId: String, liked: Bool? = nil, answer: Int? = nil) async throws -> ArticleInteraction {
        var body: [String: Any] = ["storyId": storyId]
        if let liked { body["liked"] = liked }
        if let answer { body["answer"] = answer }
        var request = URLRequest(url: URLConstants.memberAPI.appending(path: "api/content/interactions"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(URLConstants.memberAPI.absoluteString, forHTTPHeaderField: "Origin")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await session.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else { throw APIClientError.badStatus(status) }
        return try decoder.decode(ArticleInteraction.self, from: data)
    }

    struct BrowsePage: Decodable {
        let stories: [StoryCard]
        let total: Int
        let page: Int
        let nextPage: Int?
    }

    static func fetchBrowse(kind: String, slug: String, page: Int) async throws -> BrowsePage {
        try await fetchJSON { origin in
            var url = URLComponents(url: origin.appending(path: "api/mobile/v1/browse"), resolvingAgainstBaseURL: false)!
            url.queryItems = [URLQueryItem(name: "kind", value: kind), URLQueryItem(name: "slug", value: slug), URLQueryItem(name: "page", value: String(page))]
            return url.url!
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
        if let local = URLConstants.localAPI { return try await get(makeURL(local), timeout: 30) }
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

    private static let session: URLSession = {
        let config = URLSessionConfiguration.default
        config.httpCookieAcceptPolicy = .always
        config.httpShouldSetCookies = true
        config.timeoutIntervalForRequest = 12
        config.timeoutIntervalForResource = 12
        config.waitsForConnectivity = false
        config.httpMaximumConnectionsPerHost = 6
        return URLSession(configuration: config)
    }()

    private static func data(_ url: URL, timeout: TimeInterval) async throws -> Data {
        var request = URLRequest(url: url)
        request.timeoutInterval = timeout
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        let (data, response) = try await session.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        if status == 401 { throw APIClientError.unauthorized }
        guard (200..<300).contains(status) else { throw APIClientError.badStatus(status) }
        return data
    }
}

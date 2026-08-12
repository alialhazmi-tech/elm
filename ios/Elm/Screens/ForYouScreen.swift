import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

@MainActor
@Observable
final class ForYouStore {
    var items: [ForYouItem] = []
    var signedIn = false
    var loading = false
    var guest = false

    func load(interests: InterestStore, personalization: Bool) async {
        if items.isEmpty { loading = true }
        defer { loading = false }

        do {
            let payload = try await APIClient.fetchForYou()
            items = payload.items
            signedIn = true
            guest = false
        } catch APIClientError.unauthorized {
            signedIn = false
            guest = true
            await hydrateHomeIfNeeded()
            items = Self.guestFeed(interests: interests, personalization: personalization)
        } catch {
            signedIn = false
            guest = true
            await hydrateHomeIfNeeded()
            items = Self.guestFeed(interests: interests, personalization: personalization)
        }
    }

    private func hydrateHomeIfNeeded() async {
        guard HomeCorpus.cards().isEmpty else { return }
        if let (_, data) = try? await APIClient.fetchHome() {
            HomeCache.save(data)
        }
    }

    static func guestFeed(interests: InterestStore, personalization: Bool) -> [ForYouItem] {
        let cards = HomeCorpus.cards()
        guard !cards.isEmpty else { return [] }

        let catalog = personalization ? interests.items : []
        if catalog.isEmpty {
            return cards.prefix(9).map {
                ForYouItem(story: $0, reason: "من اختيارات المحررين")
            }
        }

        return cards
            .map { card -> ForYouItem in
                let hay = ArabicNormalize.fold("\(card.title) \(card.excerpt) \(card.section) \(card.eyebrow)")
                let match = catalog.first { item in
                    item.contentKeys.contains { hay.contains(ArabicNormalize.fold($0)) }
                }
                return ForYouItem(
                    story: card,
                    reason: match.map { "ظهر لك لاهتمامك بـ\($0.label)" } ?? "من اختيارات المحررين"
                )
            }
            .sorted { lhs, rhs in
                let l = lhs.reason?.contains("اهتمامك") == true ? 0 : 1
                let r = rhs.reason?.contains("اهتمامك") == true ? 0 : 1
                return l < r
            }
            .prefix(9)
            .map { $0 }
    }
}

/// 1f — لك. جلسة الخادم إن وُجدت، وإلا مسار الزائر.
struct ForYouScreen: View {
    @Environment(InterestStore.self) private var interests
    @Environment(AppearanceStore.self) private var appearance
    @State private var store = ForYouStore()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("صفحتك في العلم")
                        .font(ElmFonts.text(.caption, weight: .bold))
                        .foregroundStyle(ElmTheme.ink2)
                    Text(store.signedIn ? "صباح المعرفة" : "مواد أقرب إليك")
                        .font(ElmFonts.display(.title, weight: .heavy))
                        .foregroundStyle(ElmTheme.ink)
                    Text(store.signedIn
                         ? "رتّبناها من اهتماماتك، مع مساحة لاختيارات المحررين."
                         : "اختر اهتماماتك على الجهاز، أو انضم لترتيب الصفحة من قراءتك.")
                        .font(ElmFonts.text(.body))
                        .foregroundStyle(ElmTheme.ink2)
                }

                if store.guest {
                    guestBanner
                }

                if !interests.items.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(interests.items) { item in
                                Text(item.label)
                                    .font(ElmFonts.text(.caption, weight: .bold))
                                    .foregroundStyle(.white)
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 6)
                                    .background(ElmTheme.hex(item.color))
                                    .clipShape(Capsule())
                            }
                        }
                    }
                    .accessibilityLabel("اهتماماتك")
                }

                if store.loading && store.items.isEmpty {
                    ProgressView()
                        .tint(ElmTheme.navy)
                        .frame(maxWidth: .infinity)
                        .padding(.top, 32)
                } else if store.items.isEmpty {
                    Text("لا مواد بعد. تصفّح الرئيسية أو حدّد اهتماماتك من حسابي.")
                        .font(ElmFonts.text(.body))
                        .foregroundStyle(ElmTheme.ink2)
                } else {
                    if let lead = store.items.first {
                        leadCard(lead)
                    }
                    ForEach(Array(store.items.dropFirst())) { item in
                        VStack(alignment: .leading, spacing: 8) {
                            MosaicStoryCard(story: item.story)
                            if let reason = item.reason, !reason.isEmpty {
                                Text("لماذا ظهر لك؟ \(reason)")
                                    .font(ElmFonts.text(.caption))
                                    .foregroundStyle(ElmTheme.ink2)
                            }
                        }
                    }
                }
            }
            .padding(16)
        }
        .background(ElmTheme.bg.ignoresSafeArea())
        .navigationTitle("لك")
        .navigationBarTitleDisplayMode(.large)
        .task {
            await store.load(interests: interests, personalization: appearance.personalizationEnabled)
        }
        .refreshable {
            await store.load(interests: interests, personalization: appearance.personalizationEnabled)
        }
    }

    private var guestBanner: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("انضم ليظهر العلم حسب قراءتك")
                .font(ElmFonts.display(.headline, weight: .bold))
                .foregroundStyle(ElmTheme.ink)
            Text("العضوية على الموقع. الاهتمامات هنا تبقى على جهازك حتى نربط الجلسة.")
                .font(ElmFonts.text(.footnote))
                .foregroundStyle(ElmTheme.ink2)
            Button {
                #if canImport(UIKit)
                UIApplication.shared.open(URLConstants.joinURL)
                #endif
            } label: {
                Text("انضم إلى العلم")
                    .font(ElmFonts.text(.headline, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(ElmTheme.navy)
                    .clipShape(RoundedRectangle(cornerRadius: ElmTheme.radiusSm, style: .continuous))
            }
            .accessibilityHint("يفتح صفحة الانضمام في المتصفح")
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(ElmTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: ElmTheme.radiusMd, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: ElmTheme.radiusMd, style: .continuous)
                .stroke(ElmTheme.line, lineWidth: 1)
        )
    }

    private func leadCard(_ item: ForYouItem) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            MosaicStoryCard(story: item.story, tall: true)
            if let reason = item.reason, !reason.isEmpty {
                Text(reason)
                    .font(ElmFonts.text(.footnote))
                    .foregroundStyle(ElmTheme.ink2)
            }
        }
    }
}

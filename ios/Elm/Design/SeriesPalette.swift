import SwiftUI

/// طيف السلاسل الثماني — مطابق لـ `lib/content/series.ts`.
struct SeriesSwatch: Identifiable {
    let id: String
    let name: String
    let colorHex: String
    var color: Color { ElmTheme.hex(colorHex) }
}

enum SeriesPalette {
    static let active: [SeriesSwatch] = [
        .init(id: "absat", name: "أبسط", colorHex: "2d9a8c"),
        .init(id: "aghrab", name: "أغرب", colorHex: "c45468"),
        .init(id: "efhamha-sah", name: "افهمها صح", colorHex: "c49a32"),
        .init(id: "bel-arqam", name: "بالأرقام", colorHex: "3d6fad"),
        .init(id: "shakhsiat", name: "شخصيات", colorHex: "6b5a96"),
        .init(id: "limatha", name: "لماذا", colorHex: "2e8aa6"),
        .init(id: "matha-law", name: "ماذا لو", colorHex: "c05c32"),
        .init(id: "matha-baad", name: "ماذا بعد", colorHex: "2eb873"),
        .init(id: "bel-tarikh", name: "بالتاريخ", colorHex: "94744a"),
    ]

    static func color(for slug: String) -> Color {
        active.first { $0.id == slug }?.color ?? ElmTheme.accent
    }

    static func matching(label: String) -> SeriesSwatch? {
        active.first { $0.name == label }
    }
}

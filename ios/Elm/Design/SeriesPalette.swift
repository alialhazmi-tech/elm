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
        .init(id: "absat", name: "أبسط", colorHex: "12b5a0"),
        .init(id: "aghrab", name: "أغرب", colorHex: "ef476f"),
        .init(id: "efhamha-sah", name: "افهمها صح", colorHex: "eda313"),
        .init(id: "bel-arqam", name: "بالأرقام", colorHex: "3d7ef7"),
        .init(id: "shakhsiat", name: "شخصيات", colorHex: "8b5cf6"),
        .init(id: "limatha", name: "لماذا", colorHex: "14a8d6"),
        .init(id: "matha-law", name: "ماذا لو", colorHex: "f26a1b"),
        .init(id: "bel-tarikh", name: "بالتاريخ", colorHex: "c08a2e"),
    ]

    static func color(for slug: String) -> Color {
        active.first { $0.id == slug }?.color ?? ElmTheme.accent
    }
}

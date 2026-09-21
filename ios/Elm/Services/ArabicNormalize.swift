import Foundation

/// يطابق `normalizeArabic` + نزع «الـ» في `lib/mobile/catalog.ts`.
enum ArabicNormalize {
    static func fold(_ input: String) -> String {
        let normalized = normalize(input).lowercased()
        return normalized
            .split(whereSeparator: \.isWhitespace)
            .map { stripArticle(String($0)) }
            .filter { !$0.isEmpty }
            .joined(separator: " ")
    }

    static func normalize(_ input: String) -> String {
        var s = input
        s = s.replacingOccurrences(of: #"[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]"#, with: "", options: .regularExpression)
        s = s.replacingOccurrences(of: "\u{0640}", with: "")
        s = s.replacingOccurrences(of: #"[\u200B-\u200F\u202A-\u202E\u2066-\u2069]"#, with: "", options: .regularExpression)
        for ch in ["أ", "إ", "آ", "ٱ"] {
            s = s.replacingOccurrences(of: ch, with: "ا")
        }
        s = s.replacingOccurrences(of: "ى", with: "ي")
        s = s.replacingOccurrences(of: "ة", with: "ه")
        s = s.replacingOccurrences(of: "ؤ", with: "و")
        s = s.replacingOccurrences(of: "ئ", with: "ي")
        s = s.replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
        return s.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func stripArticle(_ word: String) -> String {
        for prefix in ["وال", "فال", "بال", "كال", "ال", "لل"] where word.hasPrefix(prefix) {
            return String(word.dropFirst(prefix.count))
        }
        return word
    }
}

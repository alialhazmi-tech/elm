import Foundation

/// بلوك قابل للتحرير في محرر الهاتف: نص واحد لكل بلوك، والتنسيق الداخلي بترميز خفيف
/// (`**غامق**`، `*مائل*`، `++تسطير++`، `~~مشطوب~~`، `[نص](رابط)`) يتحول إلى HTML المنقّى نفسه
/// الذي يقبله الخادم (`sanitizeBodyHtml`) — فلا يضيع رابط ولا تأكيد عند التحرير من الجوال.
/// في القوائم كل سطر عنصر، وسطر ينتهي بشرطة مائلة عكسية `\` يكمل العنصر نفسه في سطر جديد (`<br>`).
struct EditableBlock: Identifiable, Equatable, Hashable {
    enum Kind: String, CaseIterable, Identifiable {
        case paragraph, heading2, heading3, quote, bullets, numbered
        var id: String { rawValue }
        var label: String {
            switch self {
            case .paragraph: "فقرة"
            case .heading2: "عنوان فرعي"
            case .heading3: "عنوان أصغر"
            case .quote: "اقتباس"
            case .bullets: "قائمة نقطية"
            case .numbered: "قائمة مرقّمة"
            }
        }
        var symbol: String {
            switch self {
            case .paragraph: "text.alignright"
            case .heading2: "textformat.size.larger"
            case .heading3: "textformat.size"
            case .quote: "text.quote"
            case .bullets: "list.bullet"
            case .numbered: "list.number"
            }
        }
    }

    var id = UUID()
    var kind: Kind = .paragraph
    /// النص بالترميز الخفيف؛ في القوائم كل سطر عنصر، والسطر المنتهي بـ`\` يستمر في السطر التالي.
    var text: String = ""
    var align: String? = nil
    var postId: String? = nil
}

enum EditorMarkup {
    // MARK: HTML → بلوكات

    static func blocks(fromHTML html: String) -> [EditableBlock] {
        let parsed = ArticleBlocks.parse(html: html)
        guard !parsed.isEmpty else { return [EditableBlock()] }
        return parsed.map { block in
            switch block.type {
            case "heading":
                return EditableBlock(kind: block.level == 3 ? .heading3 : .heading2, text: markup(block.runs ?? []), align: block.align)
            case "list":
                // كسر السطر داخل العنصر (`<br>`) يُرمَّز بشرطة مائلة عكسية في نهاية السطر حتى لا يصير عنصرين.
                let lines = (block.items ?? []).map { markup($0).replacingOccurrences(of: "\n", with: "\\\n") }.joined(separator: "\n")
                return EditableBlock(kind: block.ordered == true ? .numbered : .bullets, text: lines)
            case "quote", "xpost":
                return EditableBlock(kind: .quote, text: markup(block.runs ?? []), align: block.align, postId: block.postId)
            default:
                return EditableBlock(kind: .paragraph, text: markup(block.runs ?? []), align: block.align)
            }
        }
    }

    /// أجزاء منسّقة → ترميز خفيف.
    static func markup(_ runs: [ArticleRun]) -> String {
        runs.map { run in
            var text = escapeMarkup(run.text)
            if run.bold == true { text = "**\(text)**" }
            if run.italic == true { text = "*\(text)*" }
            if run.underline == true { text = "++\(text)++" }
            if run.strike == true { text = "~~\(text)~~" }
            if let href = run.href { text = "[\(text)](\(href))" }
            return text
        }.joined()
    }

    /// تهريب حروف الترميز في نص خام (نص المستخدم أو مخرج الذكاء) حتى لا تُفسَّر النجمة والقوس تنسيقًا.
    static func escapeMarkup(_ raw: String) -> String {
        var text = raw.replacingOccurrences(of: "\\", with: "\\\\")
        text = text.replacingOccurrences(of: "++", with: "\\+\\+")
        text = text.replacingOccurrences(of: "~~", with: "\\~\\~")
        for token in ["*", "[", "]"] where text.contains(token) {
            text = text.replacingOccurrences(of: token, with: "\\" + token)
        }
        return text
    }

    // MARK: بلوكات → HTML

    static func html(from blocks: [EditableBlock]) -> String {
        blocks.compactMap { block -> String? in
            let text = block.text.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !text.isEmpty else { return nil }
            let style = block.align.flatMap { ["center", "left", "justify"].contains($0) ? " style=\"text-align:\($0)\"" : nil } ?? ""
            switch block.kind {
            case .paragraph: return "<p\(style)>\(inline(text))</p>"
            case .heading2: return "<h2\(style)>\(inline(text))</h2>"
            case .heading3: return "<h3\(style)>\(inline(text))</h3>"
            case .quote:
                let attr = block.postId.map { " data-x-post=\"\($0)\"" } ?? ""
                return "<blockquote\(attr)\(style)>\(inline(text))</blockquote>"
            case .bullets, .numbered:
                let tag = block.kind == .bullets ? "ul" : "ol"
                let items = listItems(text)
                guard !items.isEmpty else { return nil }
                return "<\(tag)>" + items.map { "<li>\(inline($0))</li>" }.joined() + "</\(tag)>"
            }
        }.joined()
    }

    /// أسطر القائمة → عناصر؛ السطر المنتهي بشرطة مائلة عكسية مفردة (عدد فردي) يستمر في السطر التالي كسطر داخلي.
    static func listItems(_ text: String) -> [String] {
        var items: [String] = []
        var pending: String?
        for raw in text.components(separatedBy: "\n") {
            let line = raw.trimmingCharacters(in: .whitespaces)
            let trailing = line.reversed().prefix { $0 == "\\" }.count
            let continues = trailing % 2 == 1
            let content = continues ? String(line.dropLast()) : line
            pending = pending.map { $0 + "\n" + content } ?? content
            if !continues {
                if let done = pending, !done.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { items.append(done) }
                pending = nil
            }
        }
        if let done = pending, !done.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { items.append(done) }
        return items
    }

    /// ترميز خفيف → HTML داخلي مع تهريب الحروف الخاصة. الوسوم تُغلق بترتيب فتحها المعاكس (مكدّس)
    /// حتى لا يخرج `<strong><em>…</strong></em>`، والأزواج الفارغة الناتجة عن إعادة الفتح تُحذف.
    static func inline(_ source: String) -> String {
        var output = ""
        var index = source.startIndex
        var open: [String] = []
        func escape(_ char: Character) -> String {
            switch char {
            case "&": "&amp;"
            case "<": "&lt;"
            case ">": "&gt;"
            case "\n": "<br>"
            default: String(char)
            }
        }
        func toggle(_ tag: String) {
            if let position = open.firstIndex(of: tag) {
                let above = Array(open[(position + 1)...])
                for inner in above.reversed() { output += "</\(inner)>" }
                output += "</\(tag)>"
                open.removeSubrange(position...)
                for inner in above { output += "<\(inner)>"; open.append(inner) }
            } else {
                output += "<\(tag)>"
                open.append(tag)
            }
        }
        while index < source.endIndex {
            let char = source[index]
            let rest = source[index...]
            if char == "\\", source.index(after: index) < source.endIndex {
                let next = source.index(after: index)
                output += escape(source[next])
                index = source.index(after: next)
                continue
            }
            if rest.hasPrefix("**") { toggle("strong"); index = source.index(index, offsetBy: 2); continue }
            if rest.hasPrefix("++") { toggle("u"); index = source.index(index, offsetBy: 2); continue }
            if rest.hasPrefix("~~") { toggle("s"); index = source.index(index, offsetBy: 2); continue }
            if char == "*" { toggle("em"); index = source.index(after: index); continue }
            if char == "[", let link = parseLink(in: source, from: index) {
                output += "<a href=\"\(link.href.replacingOccurrences(of: "\"", with: "%22"))\">\(inline(link.label))</a>"
                index = link.end
                continue
            }
            output += escape(char)
            index = source.index(after: index)
        }
        for tag in open.reversed() { output += "</\(tag)>" }
        var cleaned = output
        var previous = ""
        while previous != cleaned {
            previous = cleaned
            for tag in ["strong", "em", "u", "s"] { cleaned = cleaned.replacingOccurrences(of: "<\(tag)></\(tag)>", with: "") }
        }
        return cleaned
    }

    private static func parseLink(in source: String, from start: String.Index) -> (label: String, href: String, end: String.Index)? {
        guard let close = source[start...].firstIndex(of: "]") else { return nil }
        let afterClose = source.index(after: close)
        guard afterClose < source.endIndex, source[afterClose] == "(", let end = source[afterClose...].firstIndex(of: ")") else { return nil }
        let label = String(source[source.index(after: start)..<close])
        let href = String(source[source.index(after: afterClose)..<end]).trimmingCharacters(in: .whitespaces)
        guard href.hasPrefix("http://") || href.hasPrefix("https://") || href.hasPrefix("/") else { return nil }
        return (label, href, source.index(after: end))
    }

    /// عدد الكلمات للنص الخام (بلا ترميز).
    static func wordCount(_ blocks: [EditableBlock]) -> Int {
        blocks.map(\.text).joined(separator: " ")
            .replacingOccurrences(of: #"[*\[\]()+~]"#, with: " ", options: .regularExpression)
            .split { $0.isWhitespace || $0.isNewline }
            .count
    }

    // MARK: تطبيق نص الذكاء على البلوكات

    /// يطبّق نصًا خالصًا من الذكاء (فقرات مفصولة بسطر فارغ) على بلوكات الفقرات فقط بالترتيب،
    /// ويترك العناوين والقوائم والاقتباسات والتغريدات في مواضعها. الفقرات الزائدة تُلحق في النهاية،
    /// والفقرات الناقصة تُحذف. حروف الترميز في النص تُهرَّب فلا تُفسَّر تنسيقًا.
    static func applyPlainText(_ text: String, onto blocks: [EditableBlock]) -> [EditableBlock] {
        let paragraphs = text.replacingOccurrences(of: "\r\n", with: "\n")
            .components(separatedBy: "\n\n")
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        var queue = paragraphs.map { escapeMarkup($0) }
        var result: [EditableBlock] = []
        for block in blocks {
            guard block.kind == .paragraph else { result.append(block); continue }
            guard !queue.isEmpty else { continue }
            var updated = block
            updated.text = queue.removeFirst()
            result.append(updated)
        }
        for extra in queue { result.append(EditableBlock(kind: .paragraph, text: extra)) }
        return result.isEmpty ? [EditableBlock()] : result
    }

    /// النص الخام للذكاء: كل بلوك سطرًا مفصولًا بسطر فارغ، بلا ترميز ولا استبدال للأرقام.
    static func plainText(_ blocks: [EditableBlock]) -> String {
        ArticleBlocks.parse(html: html(from: blocks)).map(\.plainText).filter { !$0.isEmpty }.joined(separator: "\n\n")
    }

    #if DEBUG
    /// فحص ذاتي: عينات HTML يجب أن تعود كما هي بعد HTML → بلوكات → HTML.
    /// يُستدعى بوسيط الإطلاق `-elmMarkupSelfTest 1` ويطبع PASS/FAIL في السجل.
    @discardableResult
    static func selfTest() -> Bool {
        let samples: [String] = [
            "<p>فقرة عادية.</p>",
            "<p>فقرة <strong>غامقة</strong> و<em>مائلة</em> و<u>مسطّرة</u> و<s>مشطوبة</s> مع <a href=\"https://alelm.net\">رابط</a>.</p>",
            "<p><strong><em>غامق ومائل</em></strong></p>",
            "<p style=\"text-align:center\">فقرة موسّطة</p>",
            "<h2>عنوان فرعي</h2><p>نص</p>",
            "<h2 style=\"text-align:center\">عنوان موسّط</h2>",
            "<h3 style=\"text-align:center\">عنوان أصغر موسّط</h3>",
            "<blockquote>اقتباس</blockquote>",
            "<blockquote style=\"text-align:center\">اقتباس موسّط</blockquote>",
            "<blockquote data-x-post=\"1234567890\"><a href=\"https://x.com/i/status/1234567890\">عرض التغريدة على X</a></blockquote>",
            "<ul><li>بند أول</li><li>بند ثانٍ</li></ul>",
            "<ol><li>واحد</li><li>اثنان</li></ol>",
            "<ul><li>بند أول<br>سطر داخل البند</li><li>بند ثانٍ</li></ul>",
            "<p>سطر أول<br>سطر ثانٍ</p>",
            "<p>نجمة * ونجمتان ** وقوس [ليس رابطًا] وزائد ++ وموجة ~~ وشرطة \\ عكسية</p>",
            "<p>أرقام عربية ١٢٣ تبقى كما هي</p>",
            "<p>حروف &amp; خاصة &lt;وسم&gt;</p>",
            "<ul><li>عنصر ينتهي بشرطة \\<br>ويكمل</li></ul>",
        ]
        var failures: [String] = []
        for sample in samples {
            let roundTrip = html(from: blocks(fromHTML: sample))
            if roundTrip != sample { failures.append("عينة: \(sample)\nناتج: \(roundTrip)") }
        }
        // تطبيق نص الذكاء يحافظ على البنية ويهرّب الترميز.
        let structured = blocks(fromHTML: "<h2>عنوان</h2><p>أ</p><ul><li>بند</li></ul><p>ب</p>")
        let applied = html(from: applyPlainText("أ*محسّن*\n\nب محسّن\n\nفقرة زائدة", onto: structured))
        let expected = "<h2>عنوان</h2><p>أ*محسّن*</p><ul><li>بند</li></ul><p>ب محسّن</p><p>فقرة زائدة</p>"
        if applied != expected { failures.append("تطبيق الذكاء:\nناتج: \(applied)\nمتوقع: \(expected)") }
        if failures.isEmpty {
            print("ELM MARKUP SELFTEST PASS (\(samples.count + 1) samples)")
            return true
        }
        print("ELM MARKUP SELFTEST FAIL (\(failures.count)):\n" + failures.joined(separator: "\n---\n"))
        return false
    }
    #endif
}

import SwiftUI
import PhotosUI

/// مكتبة الوسائط — `GET/POST /api/tahrir/media` + `media/rights`: شبكة مرقّمة 24/صفحة،
/// مرشّح الحقوق، بحث، رفع من الصور أو الكاميرا (حتى 8MB، PNG/JPEG/WebP)، وتوثيق الحقوق.
struct StaffMediaScreen: View {
    @Environment(StaffSessionStore.self) private var staff
    var showBack = false
    var initialFilter = "all"
    @State private var filter = "all"
    @State private var query = ""
    @State private var items: [StaffMediaItem] = []
    @State private var counts: StaffMediaCounts?
    @State private var page = 1
    @State private var total = 0
    @State private var perPage = 24
    @State private var loading = false
    @State private var error: ElmAPIError?
    @State private var uploader = StaffMediaUploader()
    @State private var selected: StaffMediaItem?

    private let filters = [("all", "الكل"), ("ok", "موثّقة"), ("pending", "بلا توثيق")]

    var body: some View {
        StaffScreen(title: "الوسائط", showBack: showBack, onRefresh: { await load(page: page) }) {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    VStack(alignment: .leading, spacing: 3) {
                        Text("الوسائط").font(ElmFonts.display(.title2, weight: .heavy)).foregroundStyle(ElmTheme.ink)
                        if let counts { Text("\(ElmFormat.latinDigits(String(counts.all))) صورة · \(ElmFormat.latinDigits(String(counts.pending))) بلا توثيق").font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink3) }
                    }
                    Spacer()
                    StaffUploadButton(uploader: uploader) { await load(page: 1) }
                }
                if let progress = uploader.status { StaffInlineNotice(message: progress, symbol: "arrow.up.circle") }
                if let uploadError = uploader.error { StaffInlineError(message: uploadError) }
                HStack(spacing: 7) {
                    ForEach(filters, id: \.0) { item in
                        let count = counts.map { item.0 == "ok" ? $0.ok : item.0 == "pending" ? $0.pending : $0.all }
                        ElmChip(label: count.map { "\(item.1) \(ElmFormat.latinDigits(String($0)))" } ?? item.1, selected: filter == item.0) { filter = item.0; Task { await load(page: 1) } }
                    }
                }
                HStack(spacing: 8) {
                    Image(systemName: "magnifyingglass").foregroundStyle(ElmTheme.ink3)
                    TextField("ابحث باسم الملف", text: $query).font(ElmFonts.text(.callout)).submitLabel(.search).onSubmit { Task { await load(page: 1) } }
                }
                .padding(.horizontal, 12).frame(minHeight: 44)
                .background(ElmTheme.surface, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(ElmTheme.line2, lineWidth: 1))
                if let error, items.isEmpty {
                    StaffErrorView(error: error) { Task { await load(page: page) } }
                } else if items.isEmpty && !loading {
                    StaffEmptyView(title: "لا صور في هذه القائمة", symbol: "photo")
                } else {
                    grid
                    if let error { StaffInlineError(message: error.message, retry: { Task { await load(page: page) } }) }
                    if loading { ProgressView().frame(maxWidth: .infinity) }
                    pagination
                }
            }
            .padding(.horizontal, 18)
            .padding(.top, 8)
        }
        .task {
            if items.isEmpty { filter = initialFilter; await load(page: 1) }
            #if DEBUG
            if ElmLaunch.staffAction == "upload" {
                let renderer = UIGraphicsImageRenderer(size: CGSize(width: 900, height: 600))
                let image = renderer.image { context in
                    UIColor(red: 0.08, green: 0.21, blue: 0.42, alpha: 1).setFill()
                    context.fill(CGRect(x: 0, y: 0, width: 900, height: 600))
                    let text = "صورة اختبار من تطبيق العلم" as NSString
                    text.draw(at: CGPoint(x: 180, y: 260), withAttributes: [.font: UIFont.boldSystemFont(ofSize: 44), .foregroundColor: UIColor.white])
                }
                if let data = image.jpegData(compressionQuality: 0.9), await uploader.upload(data: data, suggestedName: "ios-test.jpg", session: staff) != nil {
                    await load(page: 1)
                }
            }
            #endif
        }
        .sheet(item: $selected) { item in
            StaffMediaDetailSheet(item: item, canRights: staff.can("media.rights")) { updated in
                if let index = items.firstIndex(where: { $0.id == updated.id }) { items[index] = updated }
                Task { await load(page: page) }
            }.elmRTL()
        }
    }

    private var grid: some View {
        let columns = [GridItem(.adaptive(minimum: 104), spacing: 8)]
        return LazyVGrid(columns: columns, spacing: 8) {
            ForEach(items) { item in
                Button { selected = item } label: {
                    Color.clear.aspectRatio(1, contentMode: .fit)
                        .overlay { RemoteImage(url: item.imageURL, maxPixel: 400) }
                        .overlay(alignment: .topLeading) {
                            Image(systemName: item.rightsCleared ? "checkmark.seal.fill" : "exclamationmark.triangle.fill")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundStyle(item.rightsCleared ? ElmTheme.tealInk : ElmTheme.warn)
                                .padding(5)
                                .background(.ultraThinMaterial, in: Circle())
                                .padding(6)
                        }
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("\(item.filename ?? "صورة") — \(item.rightsCleared ? "موثّقة الحقوق" : "بلا توثيق حقوق")")
                .accessibilityHint("يفتح تفاصيل الصورة")
            }
        }
    }

    private var totalPages: Int { max(1, Int(ceil(Double(total) / Double(max(1, perPage))))) }

    @ViewBuilder
    private var pagination: some View {
        if totalPages > 1 {
            HStack {
                Button { Task { await load(page: page - 1) } } label: { Label("السابقة", systemImage: "chevron.right").frame(minHeight: 44) }.disabled(page <= 1)
                Spacer()
                Text("\(ElmFormat.latinDigits(String(page))) / \(ElmFormat.latinDigits(String(totalPages)))").font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink3)
                Spacer()
                Button { Task { await load(page: page + 1) } } label: { HStack(spacing: 4) { Text("التالية"); Image(systemName: "chevron.left") }.frame(minHeight: 44) }.disabled(page >= totalPages)
            }
            .font(ElmFonts.text(.footnote, weight: .semibold)).foregroundStyle(ElmTheme.navyInk)
        }
    }

    private func load(page target: Int) async {
        loading = true
        error = nil
        defer { loading = false }
        do {
            let payload = try await StaffAPI.media(filter: filter, page: target, query: query.isEmpty ? nil : query)
            items = payload.items
            counts = payload.counts ?? counts
            page = payload.page ?? target
            perPage = payload.perPage ?? perPage
            total = payload.total ?? (counts.map { filter == "ok" ? $0.ok : filter == "pending" ? $0.pending : $0.all } ?? payload.items.count)
        } catch {
            self.error = staff.handle(error)
        }
    }
}

/// رفع صورة من الصور أو الملفات: ضغط JPEG لما يتجاوز 8MB ثم `POST /api/tahrir/media`.
@MainActor
@Observable
final class StaffMediaUploader {
    var status: String?
    var error: String?
    var lastUploaded: StaffUploadResult?

    func upload(item: PhotosPickerItem, session: StaffSessionStore) async -> StaffUploadResult? {
        error = nil
        status = "جارٍ تجهيز الصورة…"
        defer { status = nil }
        guard let data = try? await item.loadTransferable(type: Data.self) else {
            error = "تعذر قراءة الصورة من المكتبة."
            return nil
        }
        return await upload(data: data, suggestedName: item.itemIdentifier ?? "photo", session: session)
    }

    func upload(data raw: Data, suggestedName: String, session: StaffSessionStore) async -> StaffUploadResult? {
        var data = raw
        var mime = Self.mime(of: data)
        var filename = suggestedName
        if mime == nil || data.count > 8 * 1024 * 1024 {
            guard let image = UIImage(data: raw) else { error = "صيغة الصورة غير مدعومة (PNG/JPEG/WebP)."; return nil }
            var quality: CGFloat = 0.86
            var encoded = image.jpegData(compressionQuality: quality)
            while let candidate = encoded, candidate.count > 8 * 1024 * 1024, quality > 0.4 {
                quality -= 0.12
                encoded = image.jpegData(compressionQuality: quality)
            }
            guard let encoded else { error = "تعذر ضغط الصورة."; return nil }
            data = encoded
            mime = "image/jpeg"
            filename = "photo-\(Int(Date().timeIntervalSince1970)).jpg"
        }
        if !filename.contains(".") { filename += mime == "image/png" ? ".png" : mime == "image/webp" ? ".webp" : ".jpg" }
        status = "جارٍ الرفع (\(StaffFormat.bytes(data.count)))…"
        do {
            let result = try await StaffAPI.uploadMedia(ElmMultipartFile(field: "file", filename: filename, mime: mime ?? "image/jpeg", data: data))
            lastUploaded = result
            return result
        } catch {
            self.error = session.handle(error).message
            return nil
        }
    }

    private static func mime(of data: Data) -> String? {
        guard data.count > 12 else { return nil }
        let bytes = [UInt8](data.prefix(12))
        if bytes.starts(with: [0xFF, 0xD8, 0xFF]) { return "image/jpeg" }
        if bytes.starts(with: [0x89, 0x50, 0x4E, 0x47]) { return "image/png" }
        if bytes.starts(with: [0x52, 0x49, 0x46, 0x46]), Array(bytes[8..<12]) == [0x57, 0x45, 0x42, 0x50] { return "image/webp" }
        return nil
    }
}

struct StaffUploadButton: View {
    @Environment(StaffSessionStore.self) private var staff
    @Bindable var uploader: StaffMediaUploader
    var onUploaded: () async -> Void
    @State private var picked: PhotosPickerItem?

    var body: some View {
        PhotosPicker(selection: $picked, matching: .images, photoLibrary: .shared()) {
            Label("رفع صورة", systemImage: "arrow.up.doc")
                .font(ElmFonts.text(.footnote, weight: .bold)).foregroundStyle(.white)
                .padding(.horizontal, 14).frame(minHeight: 40)
                .background(ElmTheme.navy, in: Capsule())
        }
        .disabled(uploader.status != nil)
        .onChange(of: picked) { _, item in
            guard let item else { return }
            Task {
                if await uploader.upload(item: item, session: staff) != nil { await onUploaded() }
                picked = nil
            }
        }
    }
}

/// تفاصيل صورة وتوثيق حقوقها.
struct StaffMediaDetailSheet: View {
    @Environment(StaffSessionStore.self) private var staff
    @Environment(\.dismiss) private var dismiss
    @State var item: StaffMediaItem
    let canRights: Bool
    let onChange: (StaffMediaItem) -> Void
    @State private var flags = ""
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    Color.clear.aspectRatio(CGFloat(item.width ?? 4) / CGFloat(max(1, item.height ?? 3)), contentMode: .fit)
                        .overlay { RemoteImage(url: item.imageURL) }
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    Text(item.filename ?? "").font(ElmFonts.text(.footnote, weight: .semibold)).foregroundStyle(ElmTheme.ink).textSelection(.enabled)
                    Text([item.mime, StaffFormat.bytes(item.bytes), item.width.flatMap { w in item.height.map { "\(w)×\($0)" } }, item.uploadedBy, item.createdAt.map(StaffFormat.smart)].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · "))
                        .font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink3)
                    Label(item.rightsCleared ? "الحقوق موثّقة" : "بلا توثيق حقوق", systemImage: item.rightsCleared ? "checkmark.seal.fill" : "exclamationmark.triangle.fill")
                        .font(ElmFonts.text(.footnote, weight: .bold)).foregroundStyle(item.rightsCleared ? ElmTheme.tealInk : ElmTheme.warn)
                    if let current = item.flags, !current.isEmpty { Text("ملاحظة الحقوق: \(current)").font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink2) }
                    if canRights {
                        StaffField(label: "مصدر الصورة أو ملاحظة الحقوق", placeholder: "مثال: تصوير العلم / رخصة مفتوحة", text: $flags, axis: .vertical)
                        StaffPrimaryButton(title: item.rightsCleared ? "سحب التوثيق" : "توثيق الحقوق", symbol: item.rightsCleared ? "xmark.seal" : "checkmark.seal", busy: busy, tint: item.rightsCleared ? ElmTheme.ink2 : ElmTheme.navy) {
                            Task { await toggleRights() }
                        }
                    }
                    if let error { StaffInlineError(message: error) }
                    ShareLink(item: item.imageURL ?? URLConstants.publicSite) { Label("مشاركة الرابط", systemImage: "square.and.arrow.up").font(ElmFonts.text(.footnote, weight: .semibold)).frame(minHeight: 44) }
                }
                .padding(20)
            }
            .background(ElmTheme.bg.ignoresSafeArea())
            .toolbar { ToolbarItem(placement: .topBarLeading) { Button("إغلاق") { dismiss() } } }
            .onAppear { flags = item.flags ?? "" }
        }
    }

    private func toggleRights() async {
        busy = true
        error = nil
        defer { busy = false }
        do {
            try await StaffAPI.setMediaRights(id: item.id, cleared: !item.rightsCleared, flags: flags)
            item.rightsCleared.toggle()
            item.flags = flags
            onChange(item)
        } catch {
            self.error = staff.handle(error).message
        }
    }
}

/// اختيار صورة للمحرر من المكتبة أو رفع صورة جديدة.
struct StaffMediaPickerSheet: View {
    @Environment(StaffSessionStore.self) private var staff
    @Environment(\.dismiss) private var dismiss
    let onPick: (String) -> Void
    @State private var items: [StaffMediaItem] = []
    @State private var loading = false
    @State private var error: ElmAPIError?
    @State private var uploader = StaffMediaUploader()
    @State private var onlyCleared = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    HStack {
                        Text("اختر صورة").font(ElmFonts.display(.title3, weight: .heavy)).foregroundStyle(ElmTheme.ink)
                        Spacer()
                        StaffUploadButton(uploader: uploader) {
                            if let url = uploader.lastUploaded?.url { onPick(url); dismiss() }
                        }
                    }
                    if let status = uploader.status { StaffInlineNotice(message: status, symbol: "arrow.up.circle") }
                    if let uploadError = uploader.error { StaffInlineError(message: uploadError) }
                    Toggle("الموثّقة فقط", isOn: $onlyCleared).font(ElmFonts.text(.footnote)).tint(ElmTheme.tealInk)
                        .onChange(of: onlyCleared) { _, _ in Task { await load() } }
                    if let error, items.isEmpty { StaffErrorView(error: error) { Task { await load() } } }
                    else if let error { StaffInlineError(message: error.message, retry: { Task { await load() } }) }
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 104), spacing: 8)], spacing: 8) {
                        ForEach(items) { item in
                            Button { onPick(item.url); dismiss() } label: {
                                Color.clear.aspectRatio(1, contentMode: .fit)
                                    .overlay { RemoteImage(url: item.imageURL, maxPixel: 400) }
                                    .overlay(alignment: .topLeading) {
                                        if !item.rightsCleared {
                                            Image(systemName: "exclamationmark.triangle.fill").font(.system(size: 11, weight: .bold)).foregroundStyle(ElmTheme.warn)
                                                .padding(5).background(.ultraThinMaterial, in: Circle()).padding(6)
                                        }
                                    }
                                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("\(item.filename ?? "صورة") — \(item.rightsCleared ? "موثّقة الحقوق" : "بلا توثيق حقوق")")
                            .accessibilityHint("يختارها صورةً بارزة للمادة")
                        }
                    }
                    if loading { ProgressView().frame(maxWidth: .infinity) }
                }
                .padding(20)
            }
            .background(ElmTheme.bg.ignoresSafeArea())
            .toolbar { ToolbarItem(placement: .topBarLeading) { Button("إغلاق") { dismiss() } } }
            .task { await load() }
        }
    }

    private func load() async {
        loading = true
        defer { loading = false }
        do {
            items = try await StaffAPI.media(filter: onlyCleared ? "ok" : "all", page: 1, query: nil).items
            error = nil
        } catch {
            self.error = staff.handle(error)
        }
    }
}

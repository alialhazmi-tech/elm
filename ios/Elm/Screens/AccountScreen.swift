import SwiftUI

/// 1j — الحساب والإعدادات: بطاقة القارئ، حالة العضوية، ثم مجموعات مضبوطة.
struct AccountScreen: View {
    @Environment(LibraryStore.self) private var library
    @Environment(InterestStore.self) private var interests
    @Environment(AppearanceStore.self) private var appearance
    @Environment(MemberSessionStore.self) private var member
    @Environment(OnboardingStore.self) private var onboarding
    @Environment(ReadingStore.self) private var reading

    var body: some View {
        ElmScreen(title: "حسابي") {
            VStack(alignment: .leading, spacing: 0) {
                identity
                membershipRow.padding(.top, 14)

                group("القراءة") {
                    menuRow(label: "الوضع اللوني", color: SeriesPalette.color(for: "shakhsiat"))
                    Divider().overlay(ElmTheme.line)
                    valueRow(label: "حجم الخط", value: "يتبع النظام", color: ElmTheme.teal)
                    Divider().overlay(ElmTheme.line)
                    linkRow(label: "التنزيل التلقائي", value: reading.autoDownload ? "مُفعّل" : "مُعطّل", color: ElmTheme.focus) {
                        SavedScreen()
                    }
                }

                group("المحتوى") {
                    Button { onboarding.present() } label: {
                        rowBody(label: "اهتماماتي", value: ElmFormat.latinDigits(String(interests.selected.count)), color: ElmTheme.hex("eda313"), chevron: true)
                    }
                    .buttonStyle(.plain)
                    Divider().overlay(ElmTheme.line)
                    linkRow(label: "المحفوظات والتنزيلات", value: library.items.isEmpty ? "" : ElmFormat.latinDigits(String(library.items.count)), color: SeriesPalette.color(for: "limatha")) {
                        SavedScreen()
                    }
                    Divider().overlay(ElmTheme.line)
                    linkRow(label: "الإشعارات", value: "", color: ElmTheme.danger) {
                        NotificationsScreen()
                    }
                    Divider().overlay(ElmTheme.line)
                    toggleRow(
                        label: "تخصيص «لك أنت»",
                        color: SeriesPalette.color(for: "absat"),
                        isOn: appearance.personalizationEnabled
                    ) {
                        Task { await interests.setPersonalization(!appearance.personalizationEnabled, appearance: appearance) }
                    }
                }

                if let error = interests.syncError { Text(error).font(ElmFonts.text(.caption)).foregroundStyle(ElmTheme.ink2).padding(.top, 12) }

                group("العضوية") {
                    linkRow(label: "العضوية", value: member.isSignedIn ? "حساب مسجل" : "زائر", color: SeriesPalette.color(for: "bel-tarikh")) {
                        MembershipScreen()
                    }
                    Divider().overlay(ElmTheme.line)
                    linkRow(label: "الخصوصية", value: "", color: ElmTheme.ink3) {
                        PrivacyScreen()
                    }
                    if member.isSignedIn {
                        Divider().overlay(ElmTheme.line)
                        Button { Task { await member.signOut() } } label: {
                            rowBody(label: member.loading ? "لحظة…" : "تسجيل الخروج", value: "", color: ElmTheme.hex("8494ab"), chevron: false)
                        }
                        .buttonStyle(.plain)
                        .disabled(member.loading)
                    }
                }

                Text("المحتوى من مواد منشورة · المصدر النهائي «تحرير العلم»\n© 2026 العلم — جميع الحقوق محفوظة")
                    .font(ElmFonts.text(.caption2))
                    .foregroundStyle(ElmTheme.ink3)
                    .multilineTextAlignment(.center)
                    .lineSpacing(4)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 20)
            }
            .padding(.horizontal, 18)
            .padding(.top, 16)
        }
    }

    // MARK: الهوية

    private var identity: some View {
        HStack(spacing: 13) {
            Text(initial)
                .font(ElmFonts.display(.title2, weight: .heavy))
                .foregroundStyle(ElmTheme.gold)
                .frame(width: 56, height: 56)
                .background(ElmTheme.navyDeep, in: Circle())
            VStack(alignment: .leading, spacing: 3) {
                Text(member.isSignedIn ? member.user?.name ?? "قارئ العلم" : "أهلًا بك في العلم")
                    .font(ElmFonts.display(.title3, weight: .heavy))
                    .foregroundStyle(ElmTheme.ink)
                Text(subtitle)
                    .font(ElmFonts.text(.caption))
                    .foregroundStyle(ElmTheme.ink3)
                    .lineLimit(2)
            }
            Spacer(minLength: 0)
        }
        .accessibilityElement(children: .combine)
    }

    private var subtitle: String {
        guard member.isSignedIn else { return "قراءتك تبدأ بلا حساب — وتكبر به" }
        let saved = library.items.count
        let streak = reading.streak
        return "\(ElmFormat.materialLabel(saved)) محفوظة · سلسلة \(ElmFormat.dayLabel(streak))"
    }

    private var membershipRow: some View {
        Button {
            member.isSignedIn ? () : (member.authPresented = true)
        } label: {
            HStack(spacing: 10) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(member.isSignedIn ? "عضويتك فعّالة" : "انضم إلى العلم")
                        .font(ElmFonts.text(.footnote, weight: .bold))
                        .foregroundStyle(ElmTheme.ink)
                    Text(member.isSignedIn ? "تُدار من حسابك على الموقع" : "احفظ موادك وواصل من أي جهاز")
                        .font(ElmFonts.text(.caption2))
                        .foregroundStyle(ElmTheme.ink3)
                }
                Spacer(minLength: 0)
                Image(systemName: "arrow.left")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(ElmTheme.ink3)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 13)
            .background(
                LinearGradient(
                    colors: [ElmTheme.gold.opacity(0.22), ElmTheme.surface],
                    startPoint: .topTrailing,
                    endPoint: .bottomLeading
                )
            )
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(ElmTheme.line, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    // MARK: المجموعات

    @ViewBuilder
    private func group<Content: View>(_ title: String, @ViewBuilder rows: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(title)
                .font(ElmFonts.text(.caption2, weight: .bold))
                .foregroundStyle(ElmTheme.ink3)
                .padding(.leading, 4)
            VStack(spacing: 0) { rows() }
                .background(ElmTheme.surface)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(ElmTheme.line, lineWidth: 1))
                .padding(.top, 8)
        }
        .padding(.top, 18)
    }

    private func rowBody(label: String, value: String, color: Color, chevron: Bool) -> some View {
        HStack(spacing: 11) {
            RoundedRectangle(cornerRadius: 3, style: .continuous)
                .fill(color)
                .frame(width: 9, height: 9)
            Text(label)
                .font(ElmFonts.text(.footnote))
                .foregroundStyle(ElmTheme.ink)
            Spacer(minLength: 6)
            if !value.isEmpty {
                Text(value)
                    .font(ElmFonts.text(.caption))
                    .foregroundStyle(ElmTheme.ink3)
            }
            if chevron {
                Image(systemName: "arrow.left")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(ElmTheme.ink3)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 13)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }

    private func linkRow<Destination: View>(
        label: String, value: String, color: Color,
        @ViewBuilder destination: () -> Destination
    ) -> some View {
        NavigationLink(destination: destination()) {
            rowBody(label: label, value: value, color: color, chevron: true)
        }
        .buttonStyle(.plain)
    }

    private func valueRow(label: String, value: String, color: Color) -> some View {
        rowBody(label: label, value: value, color: color, chevron: false)
    }

    private func toggleRow(label: String, color: Color, isOn: Bool, action: @escaping () -> Void) -> some View {
        HStack(spacing: 11) {
            RoundedRectangle(cornerRadius: 3, style: .continuous)
                .fill(color)
                .frame(width: 9, height: 9)
            Text(label)
                .font(ElmFonts.text(.footnote))
                .foregroundStyle(ElmTheme.ink)
            Spacer(minLength: 6)
            ElmToggle(isOn: isOn, action: action).accessibilityLabel(label)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
    }

    private func menuRow(label: String, color: Color) -> some View {
        Menu {
            ForEach(AppearanceMode.allCases) { mode in
                Button {
                    appearance.mode = mode
                } label: {
                    if appearance.mode == mode {
                        Label(mode.label, systemImage: "checkmark")
                    } else {
                        Text(mode.label)
                    }
                }
            }
        } label: {
            rowBody(label: label, value: appearance.mode.label, color: color, chevron: true)
        }
    }

    private var initial: String {
        guard member.isSignedIn else { return "ع" }
        return member.firstName.first.map(String.init) ?? "ع"
    }
}

/// سياسة مختصرة داخل التطبيق حتى لا يعتمد مسار أساسي على صفحة ويب غير منشورة.
struct PrivacyScreen: View {
    @Environment(MemberSessionStore.self) private var member
    @State private var confirmClear = false
    @State private var busy = false
    @State private var message: String?
    var body: some View {
        ElmScreen(title: "الخصوصية", showBack: true) {
            VStack(alignment: .leading, spacing: 14) {
                Text("خصوصيتك ليست ثمن التخصيص")
                    .font(ElmFonts.display(.title, weight: .heavy))
                    .foregroundStyle(ElmTheme.ink)

                item(icon: "iphone", title: "اختياراتك وحسابك",
                     text: "للزائر تُحفظ الاختيارات على الجهاز. عند الدخول تتزامن المحفوظات والاهتمامات وإعداد التخصيص مع حسابك، ويبقى المظهر محليًا.")
                item(icon: "person.crop.circle.badge.checkmark", title: "الحساب مستقل",
                     text: "بيانات عضويتك تُستخدم للدخول ومزامنة تجربتك، ولا تمنحك صلاحيات تحريرية.")
                item(icon: "slider.horizontal.3", title: "أنت المتحكم",
                     text: "يمكنك إيقاف التخصيص ومسح اهتماماتك ومغادرة حسابك في أي وقت.")

                if member.isSignedIn {
                    Button("مسح بيانات القراءة المستنتجة في حسابي", role: .destructive) { confirmClear = true }
                        .disabled(busy)
                        .confirmationDialog("مسح بيانات القراءة؟ تبقى الاهتمامات التي اخترتها والمحـفوظات والإعجابات.", isPresented: $confirmClear) {
                            Button("مسح البيانات", role: .destructive) {
                                guard let id = member.user?.id else { return }
                                busy = true
                                Task {
                                    do {
                                        try await APIClient.updateProfile(memberId: id, action: "clear-behavior")
                                        if member.user?.id == id { message = "مُسحت بيانات القراءة المستنتجة في حسابك." }
                                    } catch { if member.user?.id == id { message = "تعذر المسح. تحقق من الاتصال وحاول مجددًا." } }
                                    busy = false
                                }
                            }
                            Button("إلغاء", role: .cancel) {}
                        }
                }
                if let message { Text(message).font(ElmFonts.text(.caption)) }
                Text("هذه نسخة مختصرة داخل التطبيق. تُضاف السياسة القانونية الكاملة قبل النشر في المتجر.")
                    .font(ElmFonts.text(.caption))
                    .foregroundStyle(ElmTheme.ink3)
                    .lineSpacing(3)
                    .padding(.top, 4)
            }
            .padding(.horizontal, 18)
            .padding(.top, 16)
        }
    }

    private func item(icon: String, title: String, text: String) -> some View {
        HStack(alignment: .top, spacing: 13) {
            Image(systemName: icon)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(ElmTheme.accent)
                .frame(width: 40, height: 40)
                .background(ElmTheme.accent.opacity(0.10), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(ElmFonts.display(.subheadline, weight: .bold))
                    .foregroundStyle(ElmTheme.ink)
                Text(text)
                    .font(ElmFonts.text(.footnote))
                    .foregroundStyle(ElmTheme.ink2)
                    .lineSpacing(3)
            }
            Spacer(minLength: 0)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .elmCard(radius: 16, elevated: false)
        .accessibilityElement(children: .combine)
    }
}

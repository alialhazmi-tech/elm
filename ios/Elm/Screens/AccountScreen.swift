import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

/// 1g — الحساب. يتفرع منه 1h الدخول، 1i الاهتمامات، 1k المحفوظات، 1l الإعدادات.
struct AccountScreen: View {
    @Environment(LibraryStore.self) private var library
    @Environment(InterestStore.self) private var interests
    @Environment(AppearanceStore.self) private var appearance

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                HStack(spacing: 14) {
                    ZStack {
                        Circle().fill(ElmTheme.navy)
                        Text("ع")
                            .font(ElmFonts.display(.title2, weight: .heavy))
                            .foregroundStyle(.white)
                    }
                    .frame(width: 56, height: 56)
                    .accessibilityHidden(true)

                    VStack(alignment: .leading, spacing: 4) {
                        Text("زائر")
                            .font(ElmFonts.display(.title2, weight: .heavy))
                            .foregroundStyle(ElmTheme.ink)
                        Text("انضم لترتيب صفحتك وحفظ اهتماماتك على الحساب")
                            .font(ElmFonts.text(.footnote))
                            .foregroundStyle(ElmTheme.ink2)
                    }
                }
                .accessibilityElement(children: .combine)
                .accessibilityLabel("زائر في العلم")

                Button {
                    #if canImport(UIKit)
                    UIApplication.shared.open(URLConstants.joinURL)
                    #endif
                } label: {
                    Text("انضم إلى العلم")
                        .font(ElmFonts.text(.headline, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(ElmTheme.navy)
                        .clipShape(RoundedRectangle(cornerRadius: ElmTheme.radiusSm, style: .continuous))
                }
                .accessibilityHint("يفتح صفحة الانضمام في المتصفح، الشاشة 1ح")

                NavigationLink {
                    InterestsScreen()
                } label: {
                    accountRow(
                        title: "اهتماماتي",
                        detail: interests.items.isEmpty
                            ? "اختر ما يهمك"
                            : "\(ElmFormat.latinDigits(String(interests.items.count))) اهتمامات",
                        systemImage: "sparkles"
                    )
                }

                NavigationLink {
                    LibraryScreen()
                } label: {
                    accountRow(
                        title: "المحفوظات",
                        detail: library.items.isEmpty
                            ? "لا مواد محفوظة بعد"
                            : "\(ElmFormat.latinDigits(String(library.items.count))) مواد",
                        systemImage: "bookmark.fill"
                    )
                }

                NavigationLink {
                    SettingsScreen()
                } label: {
                    accountRow(
                        title: "الإعدادات",
                        detail: appearance.mode.label,
                        systemImage: "gearshape.fill"
                    )
                }
            }
            .padding(16)
        }
        .background(ElmTheme.bg.ignoresSafeArea())
        .navigationTitle("حسابي")
        .navigationBarTitleDisplayMode(.large)
    }

    private func accountRow(title: String, detail: String, systemImage: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: systemImage)
                .foregroundStyle(ElmTheme.navy)
                .frame(width: 28)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(ElmFonts.display(.headline, weight: .bold))
                    .foregroundStyle(ElmTheme.ink)
                Text(detail)
                    .font(ElmFonts.text(.footnote))
                    .foregroundStyle(ElmTheme.ink2)
            }
            Spacer()
            Image(systemName: "chevron.left")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(ElmTheme.ink3)
                .accessibilityHidden(true)
        }
        .padding(16)
        .background(ElmTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: ElmTheme.radiusMd, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: ElmTheme.radiusMd, style: .continuous)
                .stroke(ElmTheme.line, lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
    }
}

/// 1i — الاهتمامات على الجهاز حتى تُربط الجلسة.
struct InterestsScreen: View {
    @Environment(InterestStore.self) private var interests

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("اختر ما يهمك. نستخدمه لترتيب تبويب «لك» على هذا الجهاز.")
                    .font(ElmFonts.text(.body))
                    .foregroundStyle(ElmTheme.ink2)

                ForEach(InterestCatalog.all) { item in
                    let on = interests.selected.contains(item.id)
                    Button {
                        interests.toggle(item.id)
                    } label: {
                        HStack(alignment: .top, spacing: 12) {
                            RoundedRectangle(cornerRadius: 6, style: .continuous)
                                .fill(ElmTheme.hex(item.color))
                                .frame(width: 8, height: 44)
                                .accessibilityHidden(true)
                            VStack(alignment: .leading, spacing: 4) {
                                Text(item.label)
                                    .font(ElmFonts.display(.headline, weight: .bold))
                                    .foregroundStyle(ElmTheme.ink)
                                Text(item.description)
                                    .font(ElmFonts.text(.footnote))
                                    .foregroundStyle(ElmTheme.ink2)
                            }
                            Spacer()
                            Image(systemName: on ? "checkmark.circle.fill" : "circle")
                                .foregroundStyle(on ? ElmTheme.success : ElmTheme.ink3)
                                .accessibilityHidden(true)
                        }
                        .padding(14)
                        .background(on ? ElmTheme.hex(item.color).opacity(0.10) : ElmTheme.surface)
                        .clipShape(RoundedRectangle(cornerRadius: ElmTheme.radiusMd, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: ElmTheme.radiusMd, style: .continuous)
                                .stroke(on ? ElmTheme.hex(item.color) : ElmTheme.line, lineWidth: 1)
                        )
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(item.label)
                    .accessibilityValue(on ? "مختار" : "غير مختار")
                    .accessibilityAddTraits(.isButton)
                }
            }
            .padding(16)
        }
        .background(ElmTheme.bg.ignoresSafeArea())
        .navigationTitle("اهتماماتي")
        .navigationBarTitleDisplayMode(.large)
    }
}

/// 1k — المحفوظات المحلية.
struct LibraryScreen: View {
    @Environment(LibraryStore.self) private var library

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if library.items.isEmpty {
                    Text("احفظ مادة من زر الإشارة أثناء القراءة، وتظهر هنا حتى بلا اتصال.")
                        .font(ElmFonts.text(.body))
                        .foregroundStyle(ElmTheme.ink2)
                } else {
                    Text("\(ElmFormat.latinDigits(String(library.items.count))) مواد على هذا الجهاز")
                        .font(ElmFonts.text(.footnote))
                        .foregroundStyle(ElmTheme.ink2)
                    ForEach(library.items) { story in
                        MosaicStoryCard(story: story)
                    }
                }
            }
            .padding(16)
        }
        .background(ElmTheme.bg.ignoresSafeArea())
        .navigationTitle("المحفوظات")
        .navigationBarTitleDisplayMode(.large)
    }
}

/// 1l — الثيم وحجم الخط والخصوصية.
struct SettingsScreen: View {
    @Environment(AppearanceStore.self) private var appearance

    var body: some View {
        @Bindable var appearance = appearance
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 10) {
                    Text("المظهر")
                        .font(ElmFonts.display(.headline, weight: .bold))
                        .foregroundStyle(ElmTheme.ink)
                    Picker("المظهر", selection: $appearance.mode) {
                        ForEach(AppearanceMode.allCases) { mode in
                            Text(mode.label).tag(mode)
                        }
                    }
                    .pickerStyle(.segmented)
                    .accessibilityLabel("المظهر")
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text("حجم الخط")
                        .font(ElmFonts.display(.headline, weight: .bold))
                        .foregroundStyle(ElmTheme.ink)
                    Text("يتبع إعدادات النظام (Dynamic Type). غيّره من إعدادات الجهاز → الشاشة والسطوع → حجم النص.")
                        .font(ElmFonts.text(.body))
                        .foregroundStyle(ElmTheme.ink2)
                }

                VStack(alignment: .leading, spacing: 10) {
                    Text("الخصوصية")
                        .font(ElmFonts.display(.headline, weight: .bold))
                        .foregroundStyle(ElmTheme.ink)
                    Toggle(isOn: $appearance.personalizationEnabled) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("تخصيص صفحتي")
                                .font(ElmFonts.text(.body, weight: .semibold))
                                .foregroundStyle(ElmTheme.ink)
                            Text("استخدام اهتماماتك على الجهاز لترتيب تبويب «لك». إشارات القراءة على الخادم تنتظر ربط الجلسة.")
                                .font(ElmFonts.text(.footnote))
                                .foregroundStyle(ElmTheme.ink2)
                        }
                    }
                    .tint(ElmTheme.navy)
                }
            }
            .padding(16)
        }
        .background(ElmTheme.bg.ignoresSafeArea())
        .navigationTitle("الإعدادات")
        .navigationBarTitleDisplayMode(.large)
    }
}

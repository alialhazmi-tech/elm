# تطبيق العلم — iOS

SwiftUI، iOS 17+. الرموز من `app/globals.css`. التوثيق: [`docs/ios/HANDOFF.md`](../docs/ios/HANDOFF.md).

```
open ios/Elm.xcodeproj
```

## الحالة الحالية — 2026-08-13

- شاشات 1a–1m مكتملة: الرئيسية، السلاسل، المادة، البحث، «لك»، الحساب، العضوية الأصلية، الاهتمامات، المحفوظات، الإعدادات، المشغل الصوتي، وحالة بلا اتصال.
- العضوية تتصل مباشرة بـ Neon Auth وتحفظ جلسة HTTPS في `HTTPCookieStorage`.
- حزمة الرئيسية وتفاصيل المواد المفتوحة محفوظة عبر SwiftData، مع هجرة من كاش JSON القديم.
- RTL وDynamic Type وVoiceOver مدعومة؛ جرى التحقق على iPhone 17 Pro وiPhone 17e.
- WidgetKit وStoreKit خارج هذا التسليم ولم يُدّعَ اكتمالهما.

## تحقق سريع

```sh
xcodebuild -project ios/Elm.xcodeproj -scheme Elm -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  CODE_SIGNING_ALLOWED=NO build
```

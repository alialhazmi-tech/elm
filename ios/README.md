# تطبيق العلم — iOS

SwiftUI، هدف النشر iOS 17. شعار التطبيق وأيقوناته في `ios/Elm/Assets.xcassets`.

```bash
open ios/Elm.xcodeproj
```

اختر فريق التوقيع الخاص بك في Xcode (لا يُرفق مع المستودع). للتأكد من البناء بلا توقيع:

```sh
xcodebuild -project ios/Elm.xcodeproj -scheme Elm -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 16' \
  CODE_SIGNING_ALLOWED=NO build
```

عقد واجهة الموبايل: [`docs/ios/API_MOBILE_V1.md`](../docs/ios/API_MOBILE_V1.md).

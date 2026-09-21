// لا يدفع شيئًا: يطبع الإجراء المعتمد لترحيل الإنتاج بدل db:push.
console.log(`db:push:prod لا ينفّذ أي تغيير على القاعدة.

ترحيل الإنتاج يمرّ بالترحيلات المرقّمة في drizzle/ فقط (إضافية، IF NOT EXISTS):
  1. أضف ترحيلًا جديدًا بالرقم التالي في drizzle/ وسجّله في drizzle/meta/_journal.json.
  2. خذ نقطة استعادة من الإنتاج واحفظ المفاتيح في مدير الأسرار.
  3. وفّر اتصالًا مباشرًا (لا -pooler) في DATABASE_URL_UNPOOLED ببيئة الترحيل.
  4. npm run db:migrate              # عرض فقط
     npm run db:migrate -- --apply   # في البيئة المعتمدة فقط
     npm run db:check                # قراءة فقط؛ يجب أن تعيد ready: true`);

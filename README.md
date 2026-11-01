# React IDE Mobile

تطبيق أولي لبيئة تطوير عربية على الهاتف، مبني بـ Expo وReact Native. الملفات الأصلية استُعيدت من مخرجات المحادثة المشار إليها وأعيد ترتيبها ضمن شجرة المشروع.

## التشغيل والفحص

```bash
pnpm install
pnpm dev
pnpm check
pnpm exec expo export --platform android
```

فحص TypeScript ينجح حاليًا. تصدير Expo لم ينجح بعد على Node 22 بسبب `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`؛ لم يتم إنتاج APK حتى الآن.

خدمة الطرفية ومدير الحزم تستخدم `/api/terminal` و`/api/packages/install`، وتحتاج خدمة API داخل runtime موثوق يحدّد عنوانه عبر `EXPO_PUBLIC_API_BASE_URL`. لا تعرّض endpoint الطرفية للإنترنت العام دون مصادقة وعزل مناسب.

يحتوي `eas.json` إعداد APK داخلي عبر ملف `preview`. البناء يحتاج Expo/EAS login وبيئة متوافقة، ولا يوجد ملف APK مرفق حاليًا.

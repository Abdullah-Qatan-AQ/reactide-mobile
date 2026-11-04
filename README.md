# React IDE Mobile

تطبيق Android أصلي مبني بـ Expo وReact Native بواجهة عربية RTL. الشاشة الرئيسية ومحرر الملفات مكونات Native؛ ملف HTML الأصلي محفوظ كمرجع وليس غلافًا للتطبيق.

## الوظائف والحدود

- مساحة عمل محلية واحدة مع ملفات متعددة وحفظ محلي تلقائي، أرقام أسطر، حالة اللغة والمؤشر، تراجع/إعادة وتكبير الخط.
- تحرير JavaScript وTypeScript وJSX وTSX وCSS وHTML وJSON وMarkdown وPython بقوالب مناسبة للامتدادات. دعم التحرير لا يعني وجود debugger أو runtime لكل لغة.
- إضافة الملفات وإعادة تسميتها وحذفها مع تأكيد، واستيراد الملفات النصية أو حزم `.reactide.json` بعد التحقق من الصيغة والمسارات والحجم، وتصديرها عبر مشاركة النظام.
- معاينة HTML داخل WebView مقيدة؛ بقية اللغات توضح أن runtime غير متصل بدل ادعاء تنفيذ الكود.
- فتح روابط Git/GitHub/ZIP خارجيًا، والاتصال بـGitHub API بمفتاح يكتبه المستخدم ويُحفظ في SecureStore. حفظ الرابط لا يستنسخ المستودع ولا يزامنه.
- الطرفية/مدير الحزم متاحان لمعاينة الويب فقط بعد Manus OAuth، بأوامر ثابتة وحدود مساحة/وقت. لا توجد shell عامة أو عزل OS. تسجيل دخول runtime عبر Android معطل لعدم وجود تدفق Manus موثق بـPKCE؛ scheme التطبيق لا يبادل رمز OAuth.
- السمة الداكنة ثابتة؛ لا يظهر مفتاح تبديل غير فعال. تشغيل JavaScript/TypeScript أو Python يحتاج runtime خارجيًا غير مهيأ.

## بناء APK على GitHub

في مستودع `Abdullah-Qatan-AQ/reactide-mobile` افتح **Actions → Android APK (debug) → Run workflow**. ينفّذ سير العمل فحوص المصدر، ويولّد مشروع Android ثم يبني `app-debug.apk` ويرفعه باسم artifact `reactide-android-debug-apk` لمدة 14 يومًا. بعد نجاح التشغيل نزّل الملف من صفحة التشغيل عبر **Artifacts**.

هذا APK داخلي موقّع بمفتاح debug للاختبار والتثبيت الجانبي؛ ليس إصدارًا إنتاجيًا أو ملفًا جاهزًا للنشر في Google Play. لا يحتاج سير العمل إلى Expo/EAS token أو أسرار GitHub. لم يُنتج APK إلا بعد أن يظهر تشغيل ناجح وتكتمل خطوة رفع artifact.

## التطوير والفحص محليًا

يتطلب المشروع Node.js 22 وpnpm 9.12.0:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm lint
pnpm exec expo install --check
pnpm dev
```

`pnpm dev` يشغّل Metro على 8081 وواجهة API على 3000. مزامنة مخطط قاعدة بيانات Manus ليست مطلوبة لبناء Android؛ بعض وظائف Web Preview الخلفية تحتاج إعداد خادم Manus. لا تضع ملفات `.env` أو مفاتيح API أو رموز GitHub داخل المستودع.

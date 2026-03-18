📝 Prompt احترافي لحل مشكلة RTL/LTR
🔴 المشكلة (The Problem)
عربي: الصفحة الحالية تعاني من مشكلة في اتجاه النصوص العربية - النصوص تظهر من اليسار لليمين (LTR) بدلاً من اليمين لليسار (RTL) كما هو صحيح للغة العربية. العناصر، الأيقونات، والمحاذاة كلها في الاتجاه الخاطئ.

English: The current page has an RTL/LTR direction issue - Arabic text is displaying left-to-right (LTR) instead of right-to-left (RTL). Elements, icons, and text alignment are all in the wrong direction.

✅ الحل المطبق بنجاح (Working Solution)
في الصفحة المرجعية (/components/Layout.tsx), تم حل المشكلة باستخدام hook مخصص يُدعى useDirectionClasses().

الخطوة 1: استيراد الـ Hook
import { useDirectionClasses } from "./useDirectionClasses";
import { useLanguage } from "./LanguageContext";
الخطوة 2: استخدام الـ Hook داخل المكون
export function YourComponent() {
  const dir = useDirectionClasses();  // ✅ هذا السطر مهم!
  const { language } = useLanguage();
  
  // ... rest of component
}
الخطوة 3: تطبيق الاتجاه على العناصر
أ) على الـ Container الرئيسي:
<div dir={dir.dir} className="...">
  {/* dir.dir يعطي "rtl" للعربية و "ltr" للإنجليزية */}
</div>
ب) للمواضع (Positioning):
<div className={`fixed ${dir.isRTL ? 'right-0' : 'left-0'} ...`}>
  {/* يضع العنصر على اليمين للعربي واليسار للإنجليزي */}
</div>
ج) للحدود (Borders):
<div className={`${dir.isRTL ? 'border-l' : 'border-r'} ...`}>
  {/* border-l للعربي، border-r للإنجليزي */}
</div>
د) لمحاذاة النص:
<p className={dir.textAlign}>
  {/* تلقائياً: text-right للعربي، text-left للإنجليزي */}
</p>
هـ) للـ Flexbox:
<div className={`flex items-center ${dir.isRTL ? 'justify-end' : 'justify-start'} gap-3`}>
  {/* يضبط اتجاه العناصر */}
</div>
🎯 كيفية تطبيق الحل على صفحتك (How to Fix Your Page)
الخطوات المطلوبة:
1. أضف الـ Imports:
import { useDirectionClasses } from "./useDirectionClasses";
import { useLanguage } from "./LanguageContext";
2. داخل المكون:
export function YourPageComponent() {
  const dir = useDirectionClasses();
  const { language } = useLanguage();
  
  return (
    <div dir={dir.dir} className="...">
      {/* محتوى الصفحة */}
    </div>
  );
}
3. استبدل المواضع الثابتة بمواضع ديناميكية:
قبل (خطأ):

<div className="fixed left-0 border-r text-left">
  {/* هذا ثابت على اليسار */}
</div>
بعد (صحيح):

<div className={`fixed ${dir.isRTL ? 'right-0' : 'left-0'} ${dir.isRTL ? 'border-l' : 'border-r'}`}>
  {/* الآن يتغير حسب اللغة */}
</div>
4. محاذاة النصوص:
قبل:

<h3 className="text-left">النص</h3>
بعد:

<h3 className={dir.textAlign}>النص</h3>
5. الأيقونات والعناصر:
قبل:

<div className="flex items-center justify-start gap-2">
  <Icon /> <Text />
</div>
بعد:

<div className={`flex items-center ${dir.isRTL ? 'flex-row-reverse' : 'flex-row'} gap-2`}>
  <Icon /> <Text />
</div>
📋 Checklist للتأكد من الحل
 تم إضافة const dir = useDirectionClasses();
 تم إضافة dir={dir.dir} على الـ container الرئيسي
 تم استبدال left-0 / right-0 بـ conditional classes
 تم استبدال border-l / border-r بـ conditional classes
 تم استبدال text-left / text-right بـ {dir.textAlign}
 تم ضبط اتجاه الـ flexbox باستخدام flex-row-reverse عند الحاجة
 تم اختبار الصفحة بتبديل اللغة بين العربية والإنجليزية
🎨 أمثلة واقعية من الكود المرجعي
مثال 1: القائمة الجانبية (Sidebar)
<div className={`fixed ${dir.isRTL ? 'right-0' : 'left-0'} top-0 h-full bg-white shadow-sm ${dir.isRTL ? 'border-l' : 'border-r'} border-gray-100 ...`}>
مثال 2: محاذاة النص
<label className={`text-xs font-medium text-gray-500 mb-2 block ${dir.textAlign}`}>
  {language === 'ar' ? 'الشركة' : 'Company'}
</label>
مثال 3: أزرار
<button className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm ${dir.isRTL ? 'text-right' : 'text-left'} ...`}>
  <Settings className="h-4 w-4" />
  {!sidebarCollapsed && <span>{language === 'ar' ? 'الإعدادات' : 'Settings'}</span>}
</button>
🚀 ملخص سريع (Quick Summary)
المشكلة: النصوص العربية تظهر LTR بدلاً من RTL
الحل: استخدام useDirectionClasses() hook
التطبيق:

const dir = useDirectionClasses();
<div dir={dir.dir}>
استخدام dir.isRTL للشروط
استخدام dir.textAlign للمحاذاة
💡 نصيحة مهمة
لا تستخدم classes ثابتة للاتجاه مثل:

❌ text-left
❌ left-0
❌ border-r
❌ justify-start
بل استخدم:

✅ {dir.textAlign}
✅ ${dir.isRTL ? 'right-0' : 'left-0'}
✅ ${dir.isRTL ? 'border-l' : 'border-r'}
✅ ${dir.isRTL ? 'justify-end' : 'justify-start'}
هذا الحل مطبق ويعمل بنجاح في /components/Layout.tsx - نفس الطريقة تنطبق على أي صفحة أخرى! ✨
# دليل معالجة الأحرف العربية - Arabic Encoding Guide

## المشكلة
كانت بعض الأحرف العربية تظهر كعلامات استفهام (�) بسبب مشاكل في encoding الملفات.

## الحل الجذري المطبق

### 1. إعدادات HTML الأساسية
تم إضافة في `/src/app/App.tsx`:
```typescript
useEffect(() => {
  document.documentElement.lang = "ar";
  document.documentElement.dir = "rtl";
}, []);
```

### 2. إعدادات CSS العامة
في `/src/styles/index.css`:
```css
html {
  direction: rtl;
}

body {
  font-family: 'Noto Sans Arabic', 'Inter', system-ui, -apple-system, sans-serif;
  direction: rtl;
}
```

### 3. إعدادات Layout
في `/src/app/layouts/root.tsx`:
```tsx
<div className="flex h-screen w-full overflow-hidden bg-background" dir="rtl">
  {/* المحتوى من اليمين إلى اليسار */}
  <div className="flex flex-1 flex-col overflow-hidden">
    <AppHeader />
    <main className="flex-1 overflow-y-auto p-6">
      <Outlet />
    </main>
  </div>
  <AppSidebar /> {/* الـ Sidebar على اليمين */}
</div>
```

## قواعد الكتابة

### ✅ الصحيح
- استخدم دائماً أحرف UTF-8 الصحيحة
- تأكد من حفظ الملفات بـ encoding UTF-8
- استخدم محرر نصوص يدعم UTF-8 بشكل كامل

### ❌ الخطأ
- لا تنسخ النصوص من مصادر غير موثوقة
- لا تستخدم encoding آخر غير UTF-8
- لا تخلط بين أحرف مختلفة المصادر

## الأحرف التي تم إصلاحها

| الخطأ | الصحيح | الموقع |
|-------|--------|--------|
| الدا��نة | الدائنة | app-sidebar.tsx, credit-notes.tsx |
| ��لمحددة | المحددة | settings.tsx |
| ح�� الحمراء | حي الحمراء | inventory.tsx |

## التحقق من عدم وجود أخطاء

يمكن البحث عن الرمز `�` في جميع الملفات للتأكد من عدم وجود أحرف مكسورة:
```bash
grep -r "�" src/
```

## الخطوات المستقبلية

1. **عند إنشاء ملف جديد**: تأكد من استخدام UTF-8 encoding
2. **عند نسخ نص عربي**: تحقق من ظهور الأحرف بشكل صحيح
3. **عند حدوث مشكلة**: استبدل الأحرف المكسورة فوراً

## الخطوط المستخدمة

- **العربية**: Noto Sans Arabic
- **الإنجليزية**: Inter
- **الأرقام**: تستخدم class `font-english` للأرقام الإنجليزية

## RTL (من اليمين إلى اليسار)

التطبيق بالكامل يعمل بنظام RTL:
- الـ Sidebar على اليمين
- النصوص من اليمين لليسار
- الأيقونات في الأماكن الصحيحة
- الـ padding والـ margin معكوسة تلقائياً

## ملاحظات مهمة

- جميع الملفات **يجب** أن تكون بـ UTF-8 encoding
- استخدم `dir="rtl"` للعناصر العربية
- استخدم `dir="ltr"` للعناصر الإنجليزية فقط عند الضرورة
- الأرقام تستخدم class `font-english` للحفاظ على وضوحها

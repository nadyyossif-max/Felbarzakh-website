# دليل تشغيل موقع "في البرزخ" الجديد (بنظام Decap CMS)

**الأفضل تعمل الخطوات دي من كمبيوتر لو ينفع، هتكون أسهل بكتير من الموبايل.**

## الخطوة ١: حساب GitHub ومستودع (Repository)
1. اعمل حساب مجاني على github.com
2. اعمل مستودع (Repository) جديد، خليه اسمه مثلاً: barzakh-website
3. ارفع كل الملفات والمجلدات اللي في هذا المشروع (index.html, admin/, content/, functions/, images/) بنفس الترتيب بالظبط

## الخطوة ٢: ربط Cloudflare Pages بالمستودع
1. من dash.cloudflare.com روح Workers & Pages → Create → Pages
2. اختار "Connect to Git" واختار المستودع اللي عملته
3. اسيب إعدادات البناء فاضية (مفيش build command، الملفات جاهزة زي ما هي)
4. دوس Deploy

## الخطوة ٣: إنشاء GitHub OAuth App
1. من GitHub: Settings → Developer settings → OAuth Apps → New OAuth App
2. Homepage URL: رابط موقعك من Cloudflare Pages
3. Authorization callback URL: نفس الرابط + `/api/callback`
4. احفظ الـ Client ID و الـ Client Secret

## الخطوة ٤: إضافة المتغيرات في Cloudflare Pages
1. من مشروعك في Cloudflare Pages → Settings → Environment variables
2. أضف: GITHUB_CLIENT_ID و GITHUB_CLIENT_SECRET بالقيم من الخطوة اللي فاتت

## الخطوة ٥: تعديل ملف admin/config.yml
افتح الملف وغيّر:
- `repo:` لاسم المستودع بتاعك (مثال: youssef/barzakh-website)
- `base_url:` لرابط موقعك بتاع Cloudflare Pages

ارفع التعديل ده على GitHub تاني.

## الخطوة ٦: التجربة
افتح: `https://موقعك/admin` وسجّل دخول بحساب GitHub بتاعك. من هنا تقدر تعدّل كل حاجة (نصوص، صور، حلقات، مقالات، أعمال، فريق) وتحفظ — والموقع هيتحدّث لكل الزوار تلقائي خلال دقايق.

---
لو محتاج مساعدة في أي خطوة، ابعتلي سكرين شوت وهساعدك خطوة بخطوة زي العادة.

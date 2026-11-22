# تقرير المراجعة الأمنية — new-api

التاريخ: 2026-11-15 · الفرع: `freebuff/05bf3c3ce2eb054d3d835591` · نطاق المراجعة: المستودع كامل (Go + React)

## 1. ملخّص

| الحالة | العدد |
| --- | --- |
| ضوابط موجودة وتحققتُ منها بالاختبار | 18 |
| ثغرات/فجوات أُصلحت في هذه المراجعة | 4 |
| بنود تحتاج قرارك (تغيير كبير أو يعتمد على بيئة النشر) | 4 |
| ملاحظات إعلامية | 4 |

لم أجد أي مفتاح سري مسرّب في الكود الحالي ولا في تاريخ Git (6865 commit).

## 2. ما تم إصلاحه

### F-1 — رسائل خطأ قاعدة البيانات تُعاد للعميل كما هي (خطورة: متوسطة)

- **المشكلة:** `common.ApiErrorStatus` كانت تكتب `err.Error()` حرفياً في استجابة HTTP. خطأ مشغّل قاعدة البيانات يحتوي قيم الاستعلام نفسه (`Duplicate entry 'user@example.com' for key ...`) وأحياناً نص الاستعلام وأسماء الجداول. عدد نقاط الاستدعاء: 356.
- **الإصلاح:** أُضيف `common.SanitizeDatabaseError` (ملف `common/db_error.go`) يُلخّص أخطاء MySQL/PostgreSQL/ClickHouse/SQLite إلى رمز الخطأ فقط، ويُترك أي خطأ غير驱动ي كما هو. طُبِّق في `ApiErrorStatus` وفي كاتب سجلّ SQL (`model/gorm_logger.go`) من نفس التنفيذ، فلا يمكن أن يتسرب الخطأ من أحد المسارين.
- **الاختبار:** `TestApiErrorStatusDoesNotLeakDriverMessage` و`TestApiErrorStatusKeepsNonDriverMessage` → نجحا. اختبارات `sanitizeDBError` القائمة في `model` ما زالت تنجح.

### F-2 — لا يوجد Content-Security-Policy على واجهات الـ API (خطورة: متوسطة)

- **المشكلة:** الترويسات الأمنية كانت تغطي nosniff و X-Frame-Options و Referrer-Policy و HSTS فقط؛ لا CSP إطلاقاً.
- **الإصلاح:** `middleware/security_headers.go` صار يرسل على مسارات `/api` و`/v1` السياسة:
  `default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`.
  هذه المسارات تُرجع JSON/SSE/وسائط فقط ولا تُقدّم مستند HTML، فالسياسة لا تكسر شيئاً وتُغلق clickjacking و«تنفيذ استجابة API كمستند».
  صفحة الكونسول (`/`) تُركت بلا CSP لأن سياستها تعتمد على حزم النشر والتحليلات وإطارات الإضافات (البند D-1).
- **الاختبار:** `TestSecurityHeadersSetsDenyAllCSPOnAPIPaths` → نجح. اختبار حيّ على سيرفر فعلي: `/api/status` أرسل الترويسة، و`/` لم يرسلها.

### F-3 — إخراج Debug لقناة Dify مُفعّل افتراضياً (خطورة: منخفضة)

- **المشكلة:** `DIFY_DEBUG` كان افتراضيه `true`، فيُعاد للعميل معرّف الـ workflow وحالة كل node كـ reasoning content — أي كشف البنية الداخلية لتطبيق Dify لكل من يملك مفتاح API.
- **الإصلاح:** الافتراضي صار `false` في `common/init.go`، وحُدِّث `.env.example` بتحذير واضح.
- **الاختبار:** `go build ./...` ناجح؛ السلوك مرتبط مباشرة بقيمة المتغيّر.

### F-4 — مكتبتان غير مستخدمتين (خطورة: معلوماتية — تقليل سطح الهجوم)

- **الإصلاح:** حُذفت `@tanstack/react-virtual` و`next-themes` بعد التأكد أنهما غير مستوردتين في أي ملف (تأكيد بـ knip + grep شامل).
- **الاختبار:** `bun run build` ناجح بعد الحذف.

### F-5 — تحديث مكتبات Go ذات تنبيهات (خطورة: منخفضة)

- **الإصلاح:** `golang.org/x/net v0.60.0 → v0.62.0`، `golang.org/x/crypto v0.57.0 → v0.58.1-0.20261009181718-2f1f834330b2` (مع x/sys وx/text وx/sync التابعة).
- **قبل:** 4 تنبيهات في وحدات مستوردة (GO-2026-6866, GO-2026-6860, GO-2026-5932, GO-2026-5158) — لا شيء منها قابل للوصول من الكود.
- **بعد:** `govulncheck ./...` → `Your code is affected by 0 vulnerabilities`، صفر في الحزم المستوردة، تنبيه واحد في وحدة مطلوبة غير مستدعاة (`go.opentelemetry.io/otel`).
- **الاختبار:** `go build ./...`، `go test` للحزم المتأثرة، و`GOWORK=off go build ./...` في `relaykit/` و`tokenkit/` — كلها ناجحة.

## 3. البنود التي تحتاج قرارك

### D-1 — CSP لمستند الكونسول (HTML)

إضافة CSP لصفحة `/` تتطلب معرفة: هل تُفعّل Umami/Google Analytics (سكربت inline)؟ هل تُستخدم إطارات إضافات (srcdoc)؟ هل الصور/الخطوط من نطاقات خارجية؟
السياسة المقترحة بعد تثبيت ذلك:

```
default-src 'self';
script-src 'self';                 # أضف 'unsafe-inline' فقط إن فعّلت Analytics
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https:;
font-src 'self' data:;
connect-src 'self';
frame-src 'self' blob: data:;
object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'
```

لم أطبّقها لأنها قد تكسر لوحات الإضافات والتحليلات في بيئتك.

### D-2 — 34 مسار لوحة مفقودة من جدول صلاحيات Access Token

اختبار `TestAccessTokenRouteRulesCoverEveryDashboardRoute` (فاشل قبل تغييراتي أيضاً) يكشف مسارات موجودة لكن غير معلنة في جدول النطاقات، منها:

```
GET/PUT  /api/admin/copilot/settings, /api/admin/system-settings/copilot
GET/POST /api/admin/copilot/chat, /api/admin/copilot/fetch-models, /api/admin/copilot/tools/*
GET      /api/admin/archive/{summary,logs,payments,export}
GET/POST/PUT/DELETE /api/admin/contact_links/*
GET/POST /api/user/support/tickets..., /api/user/support/admin/*
GET      /api/topup/orders_stats, /api/user/topup/orders_stats, /api/user/support/unread_count
POST     /api/user/nowpayments/{amount,pay}, /api/webhooks/nowpayments
GET      /api/data/metrics, /api/public/contact_links, /api/status/maintenance
```

الأثر: النظام fail-closed، فطلب رمز وصول مُقيّد (scoped PAT) لهذه المسارات يُرفض بـ 403 ويُسجّل `access token route is not declared` — لا تصعيد صلاحيات، لكن وظائف مكسورة وضجيج في السجل. الإصلاح الصحيح يتطلب تحديد النطاق (scope) المناسب لكل مسار، وهو قرار منتج/تصميم.

### D-3 — مكتبة `xlsx@0.18.5` عليها تنبيهان (high)

`GHSA-4r6h-8v6p-xvw6` (prototype pollution) و`GHSA-5pgg-2g8v-p4x9` (ReDoS) — لا يوجد إصدار مُصلح على npm (0.18.5 هو الأخير؛ الإصدارات المُصلحة على CDN الخاص بـ SheetJS).
الاستخدام في المشروع: `web/src/apps/admin/features/archive/export.ts` للكتابة فقط (`json_to_sheet`/`writeFile`) بدون `read` لأي ملف يرفعه المستخدم ⇒ غير قابل للاستغلال حالياً. القرار: الانتقال إلى مكتبة مُصانة (ExcelJS) أو تثبيت نسخة CDN، وهو تغيير على ميزة التصدير.

### D-4 — `zod` الإصدار 3.25.76 (high، تابع)

يأتي عبر `ai`, `@ai-sdk/provider-utils`, `@copilotkit/*`, `@tanstack/router-plugin`, `shadcn`. لا يوجد إصلاح داخل النطاق (الإصلاح 4.6.6 نقل بين إصدارات كبرى). التطبيق يستخدم zod للتحقق في الطرفين، والأثر العملي DoS على المتصفح فقط. القرار: ترقية كبرى مُنسّقة.

## 4. ملاحظات إعلامية

- **N-1** ثلاثة اختبارات فاشلة قبل تغييراتي (تحققت من ذلك على نسخة نظيفة من HEAD): `TestRedisFailurePolicies` (يتوقع 500 بينما الكود يتحول عمداً إلى limiter محلي)، `TestCreateUserPersistsVisibleSections` (بيئة قاعدة بيانات ناقصة)، وD-2.
- **N-2** حزمتا الاختبار `relay` و`controller` لا تُترجَم: `relay/request_billing_test.go` يستدعي `reservesOutputTokens` و`controller/*_test.go` يستدعي `setupTaskPluginBindChannelTest` وكلاهما محذوف من كود الإنتاج. النتيجة: `go test ./...` لا يعمل كاملاً، ولا يمكن تشغيل اختبارات الاختراق الموجودة في `controller` و`router/authorization_penetration_test.go` تلقائياً. هذا يمنع التحقق الآلي الكامل ويحتاج تحديث تلك الاختبارات.
- **N-3** `/.env` و`/.git/config` تُرجع صفحة SPA (HTTP 200, text/html) وليست الملفات — لا تسريب، لكن الأفضل أن تُرجع 404.
- **N-4** `/api/verification` يكشف وجود البريد المسجّل ("Email address is already in use"). مقبول كضرورة UX، لكنه oracle لتعداد الحسابات؛ محدود بـ rate limit.

## 5. البنود الـ27 — الحالة

| # | البند | الحالة | الدليل |
| --- | --- | --- | --- |
| 1 | تسجيل دخول آمن | ✅ | جلسات + access token، تسجيل خروج يُبطل الجلسة (اختبار حيّ: 401 بعد logout)، `middleware/auth.go` |
| 2 | إخفاء مفاتيح API | ✅ | لا مفاتيح في كود الواجهة؛ الواجهة تنادي `/api`؛ مفتاح Copilot لا يُعاد أبداً (`api_key_configured` فقط) |
| 3 | أمان قاعدة البيانات | ✅ | Casbin في `service/authz/`، فحص الملكية في الاستعلامات، RLS غير مطبق (عدة قواعد بيانات) — الصلاحيات على مستوى التطبيق |
| 4 | فرض HTTPS | ✅ | HSTS فقط عند TLS/وكيل موثوق (اختبار حيّ: لا HSTS على HTTP، وHSTS عند TLS) |
| 5 | تشفير كلمات المرور | ✅ | Argon2id افتراضياً (m=19456,t=2,p=1) + قراءة bcrypt القديمة; لا كلمات مرور في السجلات |
| 6 | تحقق من جهة السيرفر | ✅ | `go-playground/validator` + `common.ValidateNewAccountPassword` + حدود حجم الجسم |
| 7 | حماية XSS | ✅ | DOMPurify على Markdown/Footer/HTML المحتوى، `safeCell` ضد حقن صيغ Excel |
| 8 | تسجيل ومراقبة | ✅ | `login_failed` في audit log، `middleware/audit.go`، rate-limit failures |
| 9 | إغلاق مسارات الأدمن | ✅ | `AdminAuth`/`RootAuth` + `RequireVisibleSection`; اختبار حيّ: 401 بلا مصادقة، 200 للمشرف |
| 10 | Parameterized queries | ✅ | GORM مع `ParameterizedQueries`; الاستعلامات الخام في `model/main.go` DDL ثابت فقط |
| 11 | متغيرات البيئة | ✅ | لا `NEXT_PUBLIC_`/`VITE_` لأسرار، `.env` في `.gitignore`، `SESSION_SECRET` إلزامي في release |
| 12 | Rate limiting | ✅ | اختبار حيّ: 429 عند الطلب 21 على تسجيل الدخول، `Retry-After` مضبوط |
| 13 | CORS | ✅ | same-origin افتراضياً؛ preflight من `evil.example` → 403 (اختبار حيّ) |
| 14 | Security headers | 🟡 | أُضيف CSP لمسارات API (F-2)؛ CSP للمستند يحتاج قرارك (D-1) |
| 15 | كوكيز آمنة | ✅ | اختبار حيّ: `HttpOnly; Secure; SameSite=Strict`، Path=`/api/user/auth`، 30 يوماً |
| 16 | CSRF | ✅ | Origin/Referer guard: logout بلا Origin → 403، بنفس Origin → 200 |
| 17 | روابط استعادة تنتهي | ✅ | 10 دقائق، استخدام واحد (`ConsumeVerificationCodeWithKey`) |
| 18 | تقييد الملفات المرفوعة | ✅ | لا رفع ملفات عام؛ مصادر الإضافات ≤ 8 MiB + sha256، أيقونات data-URI مُتحقَّق منها |
| 19 | الأسعار والمدفوعات | ✅ | الأسعار من الخادم؛ توقيع webhook لـ Stripe/Epay/Creem/NowPayments/Waffo |
| 20 | إيقاف Debug | ✅ | Gin release، pprof على loopback فقط، Debug الافتراضي مُغلق (F-3)، أخطاء DB مُلخّصة (F-1) |
| 21 | تحديث المكتبات | 🟡 | Go: تم (F-5)، 0 ثغرات قابلة للوصول. npm: D-3/D-4 تحتاج قرارك |
| 22 | حذف مكتبات غير مستخدمة | ✅ | حُذفت اثنتان (F-4) |
| 23 | ملفات مكشوفة | ✅ | لا خدمة من القرص؛ تحقق حيّ: `/.env`, `/.git/config`, `/config.yaml` تُرجع SPA فقط |
| 24 | فحص تاريخ Git | ✅ | لا مفاتيح حقيقية؛ المطابقات كلها `xxxx` في أمثلة توثيق و`-----BEGIN PRIVATE KEY-----` في كود بناء PEM |
| 25 | إلغاء المفاتيح المكشوفة | — | لا شيء لإلغائه. للمفاتيح التي تديرها: أعد توليدها من لوحة المزوّد وضعها في متغيرات البيئة |
| 26 | مراجعة شاملة | ✅ | هذا التقرير |
| 27 | اختبار وتقرير | ✅ | القسم 6 |

## 6. أوامر التحقق المنفَّذة

```
go build ./...                                          → OK
go vet ./common/ ./model/ ./middleware/                  → OK
go test ./common/ ./middleware/ (المتأثرة)               → ok
go test ./model/ -run 'TestSanitizeDBError|TestGormLogger' → ok
govulncheck ./...                                        → 0 reachable
GOWORK=off go build ./... (relaykit, tokenkit)           → OK
bun audit                                                → 5 (انظر D-3/D-4)
bun run build (web)                                      → OK
```

اختبار حيّ على السيرفر (SQLite، `GIN_MODE=release`، منفذ 3012): إنشاء حساب، دخول، جلسة، 401 للمسارات المحمية، 403 لعنوان Origin مختلف، 403 لـ CORS خارجي، 429 بعد 20 محاولة، CSP على `/api` فقط، وإبطال الرمز بعد الخروج.

**لم يُتحقق منه:** تشغيل `go test ./...` كاملاً (محجوب بـ N-2)، وتصفح الواجهة بصرياً، وسياسة CSP للنص التشعبي (بانتظار D-1).

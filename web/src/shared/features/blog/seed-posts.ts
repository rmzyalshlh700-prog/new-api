/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import type { BlogPost } from '@/shared/features/public-content/types'

/**
 * Editorial seed published with the product. Administrators can replace or
 * extend it from Content settings; a managed post with the same slug wins.
 */
export const SEED_BLOG_POSTS: BlogPost[] = [
  {
    id: 'seed-introducing-astramux',
    slug: 'introducing-astramux',
    date: '2026-10-06',
    published: true,
    title: {
      en: 'Introducing Astramux',
      ar: 'تقديم Astramux',
      ru: 'Представляем Astramux',
    },
    summary: {
      en: 'One endpoint for every major model, with routing, budgets and usage in one place.',
      ar: 'نقطة وصول واحدة لكل النماذج الرئيسية، مع التوجيه والميزانيات والاستخدام في مكان واحد.',
      ru: 'Одна точка входа для всех основных моделей: маршрутизация, лимиты и статистика в одном месте.',
    },
    body: {
      en: `## Why we built it

Most teams end up with a different SDK, key and invoice for every model provider. Each new model means another integration, another failure mode and another bill to reconcile.

Astramux puts one stable API in front of all of them.

- **One base URL.** \`https://astramux.com/v1\` speaks the OpenAI schema, plus native Anthropic and Gemini formats.
- **One key.** Budgets, limits and logs are attached to the key, not to a provider account.
- **One bill.** Usage is priced per request and deducted from a single balance.

## What is available today

Chat completions, model discovery, embeddings and streaming are live. Existing OpenAI SDKs work by changing the base URL, and Anthropic clients can keep their native message format.

## Getting started

Create a key in the console, point your client at the base URL, and send a request. The quickstart takes about two minutes.`,
      ar: `## لماذا بنيناه

ينتهي معظم الفرق إلى مجموعة مختلفة من حزم التطوير والمفاتيح والفواتير لكل مزوّد نموذج. كل نموذج جديد يعني تكاملًا جديدًا ونمط فشل جديدًا وفاتورة أخرى تحتاج إلى تسوية.

يضع Astramux واجهة برمجية واحدة مستقرة أمامها جميعًا.

- **عنوان أساسي واحد.** \`https://astramux.com/v1\` يتحدث مخطط OpenAI، إضافة إلى صيغ Anthropic وGemini الأصلية.
- **مفتاح واحد.** الميزانيات والحدود والسجلات مرتبطة بالمفتاح، لا بحساب المزوّد.
- **فاتورة واحدة.** يُسعَّر الاستخدام لكل طلب ويُخصم من رصيد واحد.

## المتاح اليوم

اكتمالات الدردشة واكتشاف النماذج والتضمينات والبث المباشر متاحة الآن. تعمل حزم OpenAI الحالية بتغيير العنوان الأساسي فقط، ويمكن لعملاء Anthropic الاحتفاظ بصيغة الرسائل الأصلية.

## البدء

أنشئ مفتاحًا في لوحة التحكم، ووجّه عميلك إلى العنوان الأساسي، ثم أرسل طلبًا. يستغرق البدء السريع نحو دقيقتين.`,
      ru: `## Зачем мы это сделали

Обычно у команды оказываются разные SDK, ключи и счета для каждого провайдера моделей. Каждая новая модель — это новая интеграция, новый режим отказа и новый счёт, который нужно сверять.

Astramux ставит перед ними один стабильный API.

- **Один базовый URL.** \`https://astramux.com/v1\` говорит на схеме OpenAI, а также на нативных форматах Anthropic и Gemini.
- **Один ключ.** Бюджеты, лимиты и журналы привязаны к ключу, а не к аккаунту провайдера.
- **Один счёт.** Стоимость считается по каждому запросу и списывается с одного баланса.

## Что уже доступно

Чат-дополнения, список моделей, эмбеддинги и потоковая передача уже работают. Существующие SDK OpenAI достаточно перенаправить на новый базовый URL, а клиенты Anthropic сохраняют нативный формат сообщений.

## Начало работы

Создайте ключ в консоли, укажите базовый URL в клиенте и отправьте запрос. Быстрый старт занимает около двух минут.`,
    },
  },
  {
    id: 'seed-routing-around-incidents',
    slug: 'routing-around-provider-incidents',
    date: '2026-10-28',
    published: true,
    title: {
      en: 'How Astramux routes around provider incidents',
      ar: 'كيف يتجاوز Astramux أعطال المزوّدين',
      ru: 'Как Astramux обходит сбои провайдеров',
    },
    summary: {
      en: 'Health checks, automatic disable and pre-token failover keep a provider outage out of your application.',
      ar: 'فحوصات الصحة والتعطيل التلقائي والتجاوز قبل أول رمز تمنع انقطاع المزوّد من الوصول إلى تطبيقك.',
      ru: 'Проверки здоровья, автоматическое отключение и переключение до первого токена не пускают сбой провайдера в ваше приложение.',
    },
    body: {
      en: `## A route is a decision, not a lookup

For every request the gateway builds the set of upstreams that expose the requested model and protocol, then removes any upstream that is disabled or failing. What remains is ordered by health and effective cost.

## Failure before the first token

If an upstream errors before it sends output, the request moves to the next candidate. The client receives one normal response. The switch is recorded in the usage log so you can see where the request was served.

## Failure after output starts

A stream cannot be replayed safely: the client may already have shown text. When a stream breaks after the first delta, the error is delivered inside the stream instead of silently restarting.

## Recovery

Repeated failures disable an upstream automatically. A timer re-tests it in the background, and it returns to the pool only after successful probes. No operator action is required.

The result is a contract you can design against: a failure is either retried invisibly before output, or reported clearly after it.`,
      ar: `## المسار قرار وليس بحثًا

لكل طلب يبني البوابة مجموعة المصادر التي تتيح النموذج والبروتوكول المطلوبين، ثم يستبعد كل مصدر معطّل أو فاشل. يُرتَّب ما يتبقى حسب الصحة والتكلفة الفعلية.

## الفشل قبل أول رمز

إذا حدث خطأ في المصدر قبل إرسال أي مخرجات، ينتقل الطلب إلى المرشح التالي. يتلقى العميل استجابة واحدة طبيعية، ويُسجَّل التبديل في سجل الاستخدام لتعرف أين خدم الطلب.

## الفشل بعد بدء المخرجات

لا يمكن إعادة تشغيل البث بأمان لأن العميل ربما عرض النص بالفعل. عند انقطاع البث بعد أول جزء يُسلَّم الخطأ داخل البث بدل إعادة التشغيل بصمت.

## التعافي

تعطّل الأعطال المتكررة المصدر تلقائيًا. يعيد مؤقت اختباره في الخلفية، ولا يعود إلى المجموعة إلا بعد نجاح الفحوصات. لا حاجة لأي تدخل يدوي.

النتيجة عقد يمكنك البناء عليه: إما إعادة محاولة غير مرئية قبل المخرجات، أو خطأ واضح بعدها.`,
      ru: `## Маршрут — это решение, а не поиск

Для каждого запроса шлюз собирает набор апстримов, которые предоставляют нужную модель и протокол, и убирает отключённые или сбойные. Оставшиеся упорядочиваются по здоровью и фактической стоимости.

## Сбой до первого токена

Если апстрим ошибается до отправки вывода, запрос переходит к следующему кандидату. Клиент получает один обычный ответ, а переключение фиксируется в журнале использования.

## Сбой после начала вывода

Поток нельзя безопасно перезапустить: клиент уже мог показать текст. Если поток обрывается после первой дельты, ошибка передаётся внутри потока, а не приводит к молчаливому перезапуску.

## Восстановление

Повторяющиеся сбои автоматически отключают апстрим. Таймер проверяет его в фоне, и он возвращается в пул только после успешных проверок. Действия оператора не требуются.

В итоге контракт прост: сбой либо незаметно повторяется до вывода, либо явно сообщается после него.`,
    },
  },
  {
    id: 'seed-billing-without-surprises',
    slug: 'billing-without-surprises',
    date: '2026-11-12',
    published: true,
    title: {
      en: 'Pay-as-you-go billing, without the surprises',
      ar: 'الدفع حسب الاستخدام دون مفاجآت',
      ru: 'Оплата по факту использования без сюрпризов',
    },
    summary: {
      en: 'How per-request pricing, key budgets and pre-authorization keep spend predictable.',
      ar: 'كيف يحافظ التسعير لكل طلب وميزانيات المفاتيح والتفويض المسبق على نفقات متوقعة.',
      ru: 'Как оплата за запрос, лимиты ключей и предварительная авторизация делают расходы предсказуемыми.',
    },
    body: {
      en: `## Price per request, not per seat

Every request is priced from the live table of prompt and completion rates for the model that served it. You pay for the tokens you used, and a request that fails before producing tokens is not charged.

## Two layers of control

Key budgets cap a single service. The account balance caps everything. Budgets are checked first, so a capped key fails before it can touch the shared balance.

## Pre-authorization

Before a request is sent, the gateway reserves the maximum it could cost. The reservation is settled against actual usage when the response ends, and the difference is returned.

## Visibility

Usage Logs record the model, tokens, route and latency for every call. Filter by key or model to attribute spend. Wallet history shows every top-up and deduction with the balance after each change.

Predictable billing is mostly a matter of saying exactly what happened. That is what the console shows.`,
      ar: `## سعر لكل طلب لا لكل مقعد

يُسعَّر كل طلب من الجدول الحي لأسعار الإدخال والإخراج للنموذج الذي خدمه. تدفع مقابل الرموز التي استخدمتها، ولا يُحتسب الطلب الذي يفشل قبل إنتاج رموز.

## طبقتان من التحكم

ميزانيات المفاتيح تحدّ خدمة واحدة، ورصيد الحساب يحدّ كل شيء. تُفحص الميزانيات أولًا، لذا يفشل المفتاح المقيّد قبل أن يمس الرصيد المشترك.

## التفويض المسبق

قبل إرسال الطلب يحجز النظام الحد الأقصى المحتمل لتكلفته، ثم يسوّي الحجز مع الاستخدام الفعلي عند انتهاء الاستجابة ويعيد الفرق.

## الشفافية

تسجّل سجلات الاستخدام النموذج والرموز والمسار وزمن الاستجابة لكل نداء. استخدم التصفية حسب المفتاح أو النموذج لعزو النفقات. يعرض سجل المحفظة كل شحن وخصم مع الرصيد بعد كل تغيير.

الفوترة المتوقعة تعني ببساطة عرض ما حدث بدقة، وهذا ما تقدمه لوحة التحكم.`,
      ru: `## Цена за запрос, а не за место

Стоимость каждого запроса считается по живой таблице цен на входные и выходные токены модели, которая его обслужила. Вы платите за использованные токены, а запрос, упавший до их появления, не тарифицируется.

## Два уровня контроля

Лимит ключа ограничивает один сервис, баланс аккаунта — всё остальное. Лимиты проверяются первыми, поэтому ключ с исчерпанным бюджетом отказывает раньше, чем затронет общий баланс.

## Предварительная авторизация

Перед отправкой запроса шлюз резервирует максимально возможную стоимость. По завершении ответа резерв сверяется с фактическим использованием, а разница возвращается.

## Прозрачность

Журнал использования фиксирует модель, токены, маршрут и задержку для каждого вызова. Фильтруйте по ключу или модели, чтобы отнести расходы. История кошелька показывает каждое пополнение и списание с балансом после изменения.

Предсказуемая оплата — это в первую очередь точный отчёт о том, что произошло. Именно его показывает консоль.`,
    },
  },
]

import fs from 'node:fs/promises'
import path from 'node:path'

const LOCALES_DIR = path.resolve('src/shared/i18n/locales')

function stableStringify(obj) {
  return JSON.stringify(obj, null, 2) + '\n'
}

const newKeys = {
  en: {
    'Control Panel': 'Control Panel',
    'Live data, refreshed every 3 seconds':
      'Live data, refreshed every 3 seconds',
    'Client Balances': 'Client Balances',
    'Remaining balance and usage of each client':
      'Remaining balance and usage of each client',
    'Highest balance': 'Highest balance',
    'Lowest balance': 'Lowest balance',
    'Recently active': 'Recently active',
    'View all clients': 'View all clients',
    'Total clients': 'Total clients',
    'Unauthorized, only the root account can use internal network upstreams':
      'Unauthorized, only the root account can use internal network upstreams',
  },
  ru: {
    'Control Panel': 'Панель управления',
    'Live data, refreshed every 3 seconds':
      'Данные в реальном времени, обновление каждые 3 секунды',
    'Client Balances': 'Балансы клиентов',
    'Remaining balance and usage of each client':
      'Остаток баланса и потребление каждого клиента',
    'Highest balance': 'Наибольший баланс',
    'Lowest balance': 'Наименьший баланс',
    'Recently active': 'Недавно активные',
    'View all clients': 'Все клиенты',
    'Total clients': 'Всего клиентов',
    'Unauthorized, only the root account can use internal network upstreams':
      'Нет доступа, использовать внутренние серверы может только суперадминистратор',
  },
  ar: {
    'Control Panel': 'لوحة التحكم',
    'Live data, refreshed every 3 seconds': 'بيانات مباشرة، تحديث تلقائي كل 3 ثوانٍ',
    'Client Balances': 'أرصدة العملاء',
    'Remaining balance and usage of each client': 'الرصيد المتبقي واستخدام كل عميل',
    'Highest balance': 'الأعلى رصيدًا',
    'Lowest balance': 'الأدنى رصيدًا',
    'Recently active': 'الأحدث نشاطًا',
    'View all clients': 'عرض جميع العملاء',
    'Total clients': 'إجمالي العملاء',
    'Unauthorized, only the root account can use internal network upstreams':
      'غير مصرّح، لا يمكن استخدام الخوادم داخل الشبكة الداخلية إلا من قبل المسؤول الأعلى',
  },
}

async function main() {
  let totalAdded = 0

  for (const [locale, trans] of Object.entries(newKeys)) {
    const filePath = path.join(LOCALES_DIR, `${locale}.json`)
    const json = JSON.parse(await fs.readFile(filePath, 'utf8'))

    let count = 0
    for (const [key, value] of Object.entries(trans)) {
      if (!Object.prototype.hasOwnProperty.call(json.translation, key)) {
        json.translation[key] = value
        count++
      } else if (json.translation[key] !== value) {
        json.translation[key] = value
        count++
      }
    }

    if (count > 0) {
      json.translation = Object.fromEntries(
        Object.entries(json.translation).sort(([a], [b]) => a.localeCompare(b))
      )
      await fs.writeFile(filePath, stableStringify(json), 'utf8')
    }

    console.log(`${locale}: ${count} translations applied`)
    totalAdded += count
  }

  console.log(`\nTotal: ${totalAdded} translations applied`)
}

main().catch((err) => { console.error(err); process.exitCode = 1 })

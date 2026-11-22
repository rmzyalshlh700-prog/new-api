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
import type { IconBaseProps, IconType } from 'react-icons'
import {
  LuBadgeDollarSign,
  LuBanknote,
  LuBitcoin,
  LuBuilding2,
  LuCircleDollarSign,
  LuCoins,
  LuCreditCard,
  LuGift,
  LuGlobe,
  LuHandCoins,
  LuLandmark,
  LuQrCode,
  LuReceipt,
  LuScanLine,
  LuShieldCheck,
  LuSmartphone,
  LuStore,
  LuWallet,
  LuZap,
} from 'react-icons/lu'
import {
  SiAdyen,
  SiAlipay,
  SiAmericanexpress,
  SiApplepay,
  SiBinance,
  SiBitcoin,
  SiBuymeacoffee,
  SiCardano,
  SiCashapp,
  SiCoinbase,
  SiDiscover,
  SiDogecoin,
  SiEthereum,
  SiGooglepay,
  SiGumroad,
  SiJcb,
  SiKlarna,
  SiKofi,
  SiLemonsqueezy,
  SiLitecoin,
  SiMastercard,
  SiMonero,
  SiPaddle,
  SiPatreon,
  SiPaypal,
  SiPolkadot,
  SiRevolut,
  SiRipple,
  SiShopify,
  SiSolana,
  SiStripe,
  SiTether,
  SiVenmo,
  SiVisa,
  SiWechat,
  SiWise,
} from 'react-icons/si'

/**
 * Supported react-icons vocabulary for admin-configured icons.
 *
 * Payment methods store a react-icons component name (`SiAlipay`,
 * `LuCreditCard`, …), so these keys are that name space. Every entry is a
 * *named* import: the bundler keeps only the icons listed here — a few kB in
 * total — instead of a whole pack. The previous implementation resolved names
 * through `import('react-icons/<pack>')`, which shipped 31 namespaces: 34.8 MB
 * of inline SVG across 19 async chunks to render a handful of brand marks.
 *
 * Supporting another icon is one named import plus its key below.
 */
const ICONS: Record<string, IconType> = {
  LuBadgeDollarSign,
  LuBanknote,
  LuBitcoin,
  LuBuilding2,
  LuCircleDollarSign,
  LuCoins,
  LuCreditCard,
  LuGift,
  LuGlobe,
  LuHandCoins,
  LuLandmark,
  LuQrCode,
  LuReceipt,
  LuScanLine,
  LuShieldCheck,
  LuSmartphone,
  LuStore,
  LuWallet,
  LuZap,
  SiAdyen,
  SiAlipay,
  SiAmericanexpress,
  SiApplepay,
  SiBinance,
  SiBitcoin,
  SiBuymeacoffee,
  SiCardano,
  SiCashapp,
  SiCoinbase,
  SiDiscover,
  SiDogecoin,
  SiEthereum,
  SiGooglepay,
  SiGumroad,
  SiJcb,
  SiKlarna,
  SiKofi,
  SiLemonsqueezy,
  SiLitecoin,
  SiMastercard,
  SiMonero,
  SiPaddle,
  SiPatreon,
  SiPaypal,
  SiPolkadot,
  SiRevolut,
  SiRipple,
  SiShopify,
  SiSolana,
  SiStripe,
  SiTether,
  SiVenmo,
  SiVisa,
  SiWechat,
  SiWise,
}

/**
 * Neutral mark for a name outside the vocabulary, so a configured-but-
 * unsupported icon keeps the layout instead of collapsing to nothing.
 */
const FALLBACK_ICON: IconType = LuCircleDollarSign

function normalizeIconName(name: string | null | undefined): string | null {
  const trimmed = name?.trim()
  if (!trimmed || !/^[A-Z][A-Za-z0-9]*$/.test(trimmed)) return null
  return trimmed
}

type ReactIconByNameProps = IconBaseProps & {
  name?: string | null
}

export function ReactIconByName({ name, ...props }: ReactIconByNameProps) {
  const iconName = normalizeIconName(name)
  if (!iconName) return null

  const Icon = ICONS[iconName] ?? FALLBACK_ICON

  return <Icon {...props} />
}

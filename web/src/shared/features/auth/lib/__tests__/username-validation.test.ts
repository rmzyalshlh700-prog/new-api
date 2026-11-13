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
import { expect, test } from 'vitest'

import { loginFormSchema, registerFormSchema } from '../../constants'

const registration = (username: string) =>
  registerFormSchema.safeParse({
    username,
    email: '',
    password: 'secret',
    confirmPassword: 'secret',
  })

test.each(['alice123', 'ALICE', '007'])(
  'registration accepts the alphanumeric username %s',
  (username) => {
    expect(registration(username).success).toBe(true)
  }
)

test.each([
  'مستخدم',
  'user name',
  'user-name',
  'user_name',
  'user.name',
  'user@example.com',
  '名字123',
  '',
])('registration rejects the username %s', (username) => {
  const result = registration(username)
  expect(result.success).toBe(false)
})

test('registration reports the alphanumeric rule for non-Latin input', () => {
  const result = registration('مستخدم')
  expect(result.success).toBe(false)
  if (!result.success) {
    expect(result.error.issues[0]?.message).toBe(
      'Username can only contain English letters and numbers.'
    )
  }
})

test('sign-in still accepts an email address and legacy usernames', () => {
  expect(
    loginFormSchema.safeParse({
      username: 'user@example.com',
      password: 'secret',
    }).success
  ).toBe(true)
  expect(
    loginFormSchema.safeParse({ username: 'legacy-user', password: 'secret' })
      .success
  ).toBe(true)
})

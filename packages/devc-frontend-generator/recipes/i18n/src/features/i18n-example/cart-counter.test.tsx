import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { NextIntlClientProvider } from 'next-intl'
import { expect, test } from 'vitest'
import { MESSAGES } from '@/shared/i18n/messages'
import type { Locale } from '@/shared/i18n/routing'
import { CartCounter } from './cart-counter'

function renderIn(locale: Locale) {
  return render(
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]}>
      <CartCounter />
    </NextIntlClientProvider>,
  )
}

test('한국어는 개수와 상관없이 같은 문장에 개수를 넣는다', async () => {
  const user = userEvent.setup()
  renderIn('ko')
  expect(screen.getByRole('status')).toHaveTextContent('장바구니에 담은 상품이 없습니다.')

  await user.click(screen.getByRole('button', { name: '상품 담기' }))

  expect(screen.getByRole('status')).toHaveTextContent('장바구니에 상품이 1개 있습니다.')
})

test('영어는 개수에 따라 단수형과 복수형을 고른다', async () => {
  const user = userEvent.setup()
  renderIn('en')
  expect(screen.getByRole('status')).toHaveTextContent('Your cart is empty.')
  const add = screen.getByRole('button', { name: 'Add item' })

  await user.click(add)
  expect(screen.getByRole('status')).toHaveTextContent('1 item in your cart.')
  await user.click(add)
  expect(screen.getByRole('status')).toHaveTextContent('2 items in your cart.')
})

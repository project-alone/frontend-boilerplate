import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import HomePage from './page'

test('홈 페이지는 제목을 보여 준다', () => {
  expect(renderToStaticMarkup(<HomePage />)).toContain('<h1>Starter</h1>')
})

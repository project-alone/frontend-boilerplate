import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { axeViolations } from '@/shared/a11y/axe-violations'
import { getLandingPage } from '@/shared/api/generated'
import { Landing } from './landing'

// 랜딩 화면은 콘텐츠 API가 돌려준 문구를 섹션마다 그린다. 콘텐츠는 목 백엔드(src/shared/mocks/landing.ts)에서 받는다.

test('콘텐츠 API의 문구로 히어로, 주요 기능, 고객 후기, 자주 묻는 질문을 그리고 섹션마다 제목으로 이름을 붙인다', async () => {
  render(<Landing content={await getLandingPage('ko')} />)

  expect(screen.getByRole('heading', { level: 1, name: '첫 커밋부터 깨끗한 프론트엔드 프로젝트' })).toBeVisible()
  expect(screen.getByRole('link', { name: '주요 기능 보기' })).toHaveAttribute('href', '#features')

  const features = screen.getByRole('region', { name: '주요 기능' })
  expect(features).toHaveAttribute('id', 'features')
  expect(
    within(features)
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent),
  ).toEqual(['명령 하나로 시작', '검증된 패턴', '기본으로 갖춘 품질 검사'])

  const testimonials = screen.getByRole('region', { name: '먼저 써 본 팀의 이야기' })
  const firstTestimonial = within(testimonials).getAllByRole('figure')[0]
  expect(firstTestimonial).toHaveTextContent('프로젝트를 만든 첫날부터 화면 개발을 시작했습니다.')
  expect(firstTestimonial).toHaveTextContent('김하늘, 프론트엔드 리드')

  expect(screen.getByRole('region', { name: '자주 묻는 질문' })).toBeVisible()
})

test('영어 콘텐츠도 같은 섹션으로 그리고, 두 콘텐츠 모두 접근성 위반이 없다', async () => {
  const { container, rerender } = render(<Landing content={await getLandingPage('ko')} />)
  expect(await axeViolations(container)).toEqual([])

  rerender(<Landing content={await getLandingPage('en')} />)

  expect(
    screen.getByRole('heading', { level: 1, name: 'A clean frontend project from the first commit' }),
  ).toBeVisible()
  for (const name of ['Key features', 'What early teams say', 'Frequently asked questions']) {
    expect(screen.getByRole('region', { name })).toBeVisible()
  }
  expect(await axeViolations(container)).toEqual([])
})

test('자주 묻는 질문의 답은 질문을 누르면 펼쳐지고 다시 누르면 접힌다', async () => {
  const user = userEvent.setup()
  render(<Landing content={await getLandingPage('en')} />)
  const question = screen.getByText('Can we start before the backend is ready?')
  const answer = screen.getByText(/Build screens against mock responses/)

  expect(answer).not.toBeVisible()
  await user.click(question)
  expect(answer).toBeVisible()
  // 펼친 답에도 접근성 위반이 없다.
  expect(await axeViolations(document.body)).toEqual([])
  await user.click(question)
  expect(answer).not.toBeVisible()
})

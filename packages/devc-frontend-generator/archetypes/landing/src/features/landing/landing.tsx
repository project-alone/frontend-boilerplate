import type { ReactNode } from 'react'
import type { LandingPageContent } from '@/shared/api/generated/model'
import { buttonVariants } from '@/shared/ui/button'

/**
 * 랜딩 페이지 화면. 콘텐츠 API(getLandingPage)가 돌려준 문구로 히어로, 주요 기능, 고객 후기, 자주 묻는 질문 섹션을 그린다.
 *
 * - 서버 컴포넌트다. 빌드할 때 미리 렌더링한 HTML에 모든 문구가 담기고, 브라우저가 콘텐츠를 다시 가져오거나 hydration으로
 *   이어받을 상태가 없다(src/features/landing/landing-content.ts).
 * - 섹션마다 제목으로 이름을 붙여(aria-labelledby) 보조 기술이 랜드마크로 옮겨 다닌다. 섹션의 id(features, testimonials,
 *   faqs)는 콘텐츠의 링크(예: 히어로의 #features)가 가리킨다.
 * - 자주 묻는 질문은 <details>로 펼친다. JavaScript 없이 동작하고 접힌 답도 HTML에 있어 검색 엔진이 읽는다.
 *
 * 섹션을 더하려면 명세(openapi.yaml)의 LandingPageContent에 스키마를 더하고 npm run api:gen을 실행한 뒤 여기에 섹션을 더한다.
 */
export function Landing({
  content: { hero, features, testimonials, faqs },
}: Readonly<{ content: LandingPageContent }>) {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-16 px-4 py-12">
      <section aria-labelledby="hero-heading" className="flex flex-col items-start gap-4">
        <h1 id="hero-heading" className="text-lg font-semibold">
          {hero.heading}
        </h1>
        <p className="text-muted-foreground">{hero.body}</p>
        {/* 페이지 안의 위치(#features)나 다른 사이트로 가는 링크라 next/link 대신 <a>를 쓴다. */}
        <a href={hero.callToAction.href} className={buttonVariants()}>
          {hero.callToAction.label}
        </a>
      </section>
      <LandingSection id="features" heading={features.heading}>
        <ul className="grid gap-4 md:grid-cols-3">
          {features.items.map((feature) => (
            <li key={feature.id} className="flex flex-col gap-2 rounded-lg border border-border p-4">
              <h3 className="font-medium">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.body}</p>
            </li>
          ))}
        </ul>
      </LandingSection>
      <LandingSection id="testimonials" heading={testimonials.heading}>
        <ul className="grid gap-4 md:grid-cols-2">
          {testimonials.items.map((testimonial) => (
            <li key={testimonial.id}>
              <figure className="flex h-full flex-col gap-2 rounded-lg bg-muted p-4">
                <blockquote>
                  <p>{testimonial.quote}</p>
                </blockquote>
                <figcaption className="text-sm text-muted-foreground">
                  {testimonial.author}, {testimonial.role}
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </LandingSection>
      <LandingSection id="faqs" heading={faqs.heading}>
        <div className="flex flex-col gap-2">
          {faqs.items.map((faq) => (
            <details key={faq.id} className="rounded-lg border border-border">
              <summary className="focus-ring cursor-pointer rounded-lg p-4 font-medium">{faq.question}</summary>
              <p className="px-4 pb-4 text-muted-foreground">{faq.answer}</p>
            </details>
          ))}
        </div>
      </LandingSection>
    </main>
  )
}

/** 제목(h2)으로 이름을 붙인 섹션(랜드마크). id는 콘텐츠의 링크(#features 등)가 가리키는 위치다. */
function LandingSection({ id, heading, children }: Readonly<{ id: string; heading: string; children: ReactNode }>) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="flex flex-col gap-4">
      <h2 id={`${id}-heading`} className="font-semibold">
        {heading}
      </h2>
      {children}
    </section>
  )
}

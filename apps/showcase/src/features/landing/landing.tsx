// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): archetypes/landing/src/features/landing/landing.tsx

import type {
  LandingFaqSection,
  LandingFeatureSection,
  LandingHero,
  LandingPageContent,
  LandingTestimonialSection,
} from '@/shared/api/generated/model'
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
export function Landing({ content }: Readonly<{ content: LandingPageContent }>) {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-16 px-4 py-12">
      <Hero hero={content.hero} />
      <Features section={content.features} />
      <Testimonials section={content.testimonials} />
      <Faqs section={content.faqs} />
    </main>
  )
}

function Hero({ hero }: Readonly<{ hero: LandingHero }>) {
  return (
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
  )
}

function Features({ section }: Readonly<{ section: LandingFeatureSection }>) {
  return (
    <section id="features" aria-labelledby="features-heading" className="flex flex-col gap-4">
      <h2 id="features-heading" className="text-lg font-semibold">
        {section.heading}
      </h2>
      <ul className="grid gap-4 md:grid-cols-3">
        {section.items.map((feature) => (
          <li key={feature.id} className="flex flex-col gap-2 rounded-lg border border-border p-4">
            <h3 className="font-semibold">{feature.title}</h3>
            <p className="text-sm text-muted-foreground">{feature.body}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Testimonials({ section }: Readonly<{ section: LandingTestimonialSection }>) {
  return (
    <section id="testimonials" aria-labelledby="testimonials-heading" className="flex flex-col gap-4">
      <h2 id="testimonials-heading" className="text-lg font-semibold">
        {section.heading}
      </h2>
      <ul className="grid gap-4 md:grid-cols-2">
        {section.items.map((testimonial) => (
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
    </section>
  )
}

function Faqs({ section }: Readonly<{ section: LandingFaqSection }>) {
  return (
    <section id="faqs" aria-labelledby="faqs-heading" className="flex flex-col gap-4">
      <h2 id="faqs-heading" className="text-lg font-semibold">
        {section.heading}
      </h2>
      <div className="flex flex-col gap-2">
        {section.items.map((faq) => (
          <details key={faq.id} className="rounded-lg border border-border">
            <summary className="focus-ring cursor-pointer rounded-lg p-4 font-medium">{faq.question}</summary>
            <p className="px-4 pb-4 text-muted-foreground">{faq.answer}</p>
          </details>
        ))}
      </div>
    </section>
  )
}

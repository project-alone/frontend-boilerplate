import { http, HttpResponse } from 'msw'
import { MOCK_API_BASE_URL } from '@/shared/api/base-url'
import type { LandingPageContent } from '@/shared/api/generated/model'

// 랜딩 Archetype: 랜딩 페이지 콘텐츠 API(landing tag)를 흉내 내는 목 백엔드. 명세에서 생성한 핸들러는 늘 같은 example(ko)을
// 돌려주므로, locale마다 다른 콘텐츠를 돌려주고 콘텐츠가 없는 locale은 404로 답하는 핸들러를 따로 둔다. 확장 지점
// mockHandlers(Archetype의 extensions.json)로 선언해, MSW의 핸들러 목록(src/shared/mocks/handlers.ts)이 생성된 핸들러보다
// 앞에 둔다. 생성된 핸들러처럼 목 백엔드 주소(MOCK_API_BASE_URL)로 가는 요청만 받는다(ADR-0013).
//
// 랜딩 페이지는 빌드할 때 콘텐츠를 가져와 미리 렌더링하므로, 이 핸들러는 주로 목 빌드(API_MOCKING=enabled로 실행한
// next build. ADR-0011)와 Vitest가 쓴다. 실제 백엔드(CMS)로 바꾸면 쓰이지 않는다. 문구를 바꿔 보려면 아래 값을 고친 뒤 다시
// 빌드한다(개발 서버는 요청마다 다시 그린다).

/** 목 백엔드가 locale마다 돌려주는 랜딩 페이지 콘텐츠. 스토리와 테스트도 이 값을 쓴다. */
export const MOCK_LANDING_PAGES = {
  ko: {
    title: 'Starter로 시작하는 프론트엔드 프로젝트',
    description: '명령 하나로 엄격한 TypeScript, 테스트, 접근성 검사, CI를 갖춘 프론트엔드 프로젝트를 만듭니다.',
    hero: {
      heading: '첫 커밋부터 깨끗한 프론트엔드 프로젝트',
      body: 'Starter는 팀이 검증한 설정과 패턴으로 새 프로젝트를 만듭니다. 초기 설정 대신 화면을 만드는 데 시간을 쓰세요.',
      callToAction: { label: '주요 기능 보기', href: '#features' },
    },
    features: {
      heading: '주요 기능',
      items: [
        {
          id: 'setup',
          title: '명령 하나로 시작',
          body: '만든 직후부터 타입 검사, 린트, 테스트, 빌드가 통과하는 프로젝트를 만듭니다.',
        },
        {
          id: 'patterns',
          title: '검증된 패턴',
          body: 'API 연동, 폼 검증, 인증처럼 반복되는 코드를 팀이 정한 같은 구조로 만듭니다.',
        },
        {
          id: 'quality',
          title: '기본으로 갖춘 품질 검사',
          body: '접근성 검사와 E2E 테스트가 커밋할 때와 CI에서 함께 돕니다.',
        },
      ],
    },
    testimonials: {
      heading: '먼저 써 본 팀의 이야기',
      items: [
        {
          id: 'first-day',
          quote: '프로젝트를 만든 첫날부터 화면 개발을 시작했습니다.',
          author: '김하늘',
          role: '프론트엔드 리드',
        },
        {
          id: 'same-structure',
          quote: '프로젝트를 옮겨도 구조가 같아서 코드를 찾느라 헤매지 않습니다.',
          author: '이도윤',
          role: '프론트엔드 개발자',
        },
      ],
    },
    faqs: {
      heading: '자주 묻는 질문',
      items: [
        {
          id: 'backend',
          question: '백엔드가 준비되지 않았어도 개발할 수 있나요?',
          answer: '네. OpenAPI 명세에서 만든 목 응답으로 화면을 먼저 만들고, 백엔드가 준비되면 주소만 바꿉니다.',
        },
        {
          id: 'languages',
          question: '어떤 언어를 지원하나요?',
          answer: '한국어와 영어를 지원합니다. 메시지 카탈로그와 콘텐츠를 더하면 다른 언어도 쓸 수 있습니다.',
        },
        {
          id: 'existing-project',
          question: '이미 진행 중인 프로젝트에도 쓸 수 있나요?',
          answer: 'Starter는 새 프로젝트의 출발점입니다. 진행 중인 프로젝트에는 필요한 패턴만 골라 옮겨 쓰세요.',
        },
      ],
    },
  },
  en: {
    title: 'Start your frontend project with Starter',
    description:
      'Create a frontend project with strict TypeScript, tests, accessibility checks, and CI in a single command.',
    hero: {
      heading: 'A clean frontend project from the first commit',
      body: 'Starter creates new projects with the settings and patterns your team has already proven. Spend your time building screens, not setting up.',
      callToAction: { label: 'See key features', href: '#features' },
    },
    features: {
      heading: 'Key features',
      items: [
        {
          id: 'setup',
          title: 'Start with one command',
          body: 'Get a project that passes type checks, lint, tests, and the build right after it is created.',
        },
        {
          id: 'patterns',
          title: 'Proven patterns',
          body: 'Recurring code such as API calls, form validation, and authentication follows the structure your team agreed on.',
        },
        {
          id: 'quality',
          title: 'Quality checks built in',
          body: 'Accessibility checks and end-to-end tests run on every commit and in CI.',
        },
      ],
    },
    testimonials: {
      heading: 'What early teams say',
      items: [
        {
          id: 'first-day',
          quote: 'We started building screens on the first day of the project.',
          author: 'Haneul Kim',
          role: 'Frontend lead',
        },
        {
          id: 'same-structure',
          quote: 'Every project has the same structure, so we never get lost looking for code.',
          author: 'Doyun Lee',
          role: 'Frontend developer',
        },
      ],
    },
    faqs: {
      heading: 'Frequently asked questions',
      items: [
        {
          id: 'backend',
          question: 'Can we start before the backend is ready?',
          answer:
            'Yes. Build screens against mock responses generated from the OpenAPI spec, then switch to the backend address when it is ready.',
        },
        {
          id: 'languages',
          question: 'Which languages are supported?',
          answer: 'Korean and English. Add a message catalog and content to support another language.',
        },
        {
          id: 'existing-project',
          question: 'Can we use it in a project that is already underway?',
          answer:
            'Starter is a starting point for new projects. For a project already underway, pick the patterns you need and bring them over.',
        },
      ],
    },
  },
} satisfies Record<string, LandingPageContent>

const contentByLocale: ReadonlyMap<string, LandingPageContent> = new Map(Object.entries(MOCK_LANDING_PAGES))

export const landingHandlers = [
  http.get<{ locale: string }>(`${MOCK_API_BASE_URL}/landing-pages/:locale`, ({ params }) => {
    const content = contentByLocale.get(params.locale)
    // 그 locale로 쓴 콘텐츠가 없다(명세의 404).
    if (content === undefined) return new HttpResponse(null, { status: 404 })
    return HttpResponse.json(content)
  }),
]

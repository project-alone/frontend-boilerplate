import { http, HttpResponse } from 'msw'
import { MOCK_API_BASE_URL } from '@/shared/api/base-url'
import { ListMembersParams, type Member, type MemberPage } from '@/shared/api/generated/model'
import { slicePage } from '@/shared/lib/array'
import { searchParamsOf } from '@/shared/lib/http'

// table Recipe: 회원 목록(listMembers)을 흉내 내는 MSW 핸들러. 명세에서 생성한 핸들러는 example을 그대로 돌려주므로,
// 이 핸들러가 그보다 앞에서 쿼리 파라미터대로 거르고 정렬하고 나눈 페이지를 백엔드처럼 돌려준다. 확장 지점 mockHandlers
// (Recipe의 extensions.json)로 선언해, MSW의 핸들러 목록(src/shared/mocks/handlers.ts)이 생성된 핸들러보다 앞에 둔다.
// Vitest, 개발 서버, E2E가 모두 이 핸들러를 쓰므로 결과가 늘 같도록 회원 데이터를 고정해 둔다.

/** 목 백엔드에 있는 회원. id가 가입한 순서다. */
const MEMBERS: readonly Member[] = [
  { id: 1, name: '김하늘', email: 'haneul.kim@example.com', role: 'admin', joinedAt: '2024-01-08' },
  { id: 2, name: '이도윤', email: 'doyun.lee@example.com', role: 'editor', joinedAt: '2024-02-14' },
  { id: 3, name: '박서연', email: 'seoyeon.park@example.com', role: 'viewer', joinedAt: '2023-11-30' },
  { id: 4, name: '최민준', email: 'minjun.choi@example.com', role: 'editor', joinedAt: '2024-03-02' },
  { id: 5, name: '정지우', email: 'jiwoo.jung@example.com', role: 'viewer', joinedAt: '2023-09-17' },
  { id: 6, name: '강예린', email: 'yerin.kang@example.com', role: 'admin', joinedAt: '2024-04-21' },
  { id: 7, name: '조현우', email: 'hyunwoo.cho@example.com', role: 'viewer', joinedAt: '2024-05-09' },
  { id: 8, name: '윤서아', email: 'seoa.yoon@example.com', role: 'editor', joinedAt: '2023-12-25' },
  { id: 9, name: '장민서', email: 'minseo.jang@example.com', role: 'viewer', joinedAt: '2024-06-11' },
  { id: 10, name: '임준호', email: 'junho.lim@example.com', role: 'viewer', joinedAt: '2024-02-29' },
  { id: 11, name: '한지민', email: 'jimin.han@example.com', role: 'editor', joinedAt: '2023-08-03' },
  { id: 12, name: '오세훈', email: 'sehoon.oh@example.com', role: 'viewer', joinedAt: '2024-07-19' },
  { id: 13, name: '서유진', email: 'yujin.seo@example.com', role: 'admin', joinedAt: '2024-01-27' },
  { id: 14, name: '신동현', email: 'donghyun.shin@example.com', role: 'viewer', joinedAt: '2023-10-05' },
  { id: 15, name: '권나연', email: 'nayeon.kwon@example.com', role: 'editor', joinedAt: '2024-08-14' },
  { id: 16, name: '황태민', email: 'taemin.hwang@example.com', role: 'viewer', joinedAt: '2024-03-18' },
  { id: 17, name: '안소희', email: 'sohee.ahn@example.com', role: 'viewer', joinedAt: '2023-07-22' },
  { id: 18, name: '송재원', email: 'jaewon.song@example.com', role: 'editor', joinedAt: '2024-09-01' },
  { id: 19, name: '유하은', email: 'haeun.yoo@example.com', role: 'viewer', joinedAt: '2024-04-04' },
  { id: 20, name: '홍길동', email: 'gildong.hong@example.com', role: 'admin', joinedAt: '2023-06-15' },
  { id: 21, name: '전수빈', email: 'subin.jeon@example.com', role: 'viewer', joinedAt: '2024-10-10' },
  { id: 22, name: '고은채', email: 'eunchae.ko@example.com', role: 'editor', joinedAt: '2024-05-30' },
  { id: 23, name: '문시우', email: 'siwoo.moon@example.com', role: 'viewer', joinedAt: '2023-05-02' },
  { id: 24, name: '배지호', email: 'jiho.bae@example.com', role: 'viewer', joinedAt: '2024-11-11' },
]

export const membersHandlers = [
  http.get(`${MOCK_API_BASE_URL}/members`, ({ request }) => {
    // 실제 백엔드처럼 명세에 없는 값(알 수 없는 정렬 항목 등)은 400으로 거절한다.
    const params = ListMembersParams.safeParse(searchParamsOf(new URL(request.url), ['page', 'pageSize']))
    if (!params.success) return HttpResponse.json({ message: params.error.message }, { status: 400 })
    // 명세의 listMembers처럼 회원을 거르고(q, role) 정렬하고(sort, order) 한 페이지(page, pageSize)를 잘라 돌려준다.
    const { q, role, sort, order, page, pageSize } = params.data
    const keyword = q?.trim().toLowerCase() ?? ''
    const filtered = MEMBERS.filter(
      (member) =>
        (role === undefined || member.role === role) &&
        (keyword === '' || `${member.name} ${member.email}`.toLowerCase().includes(keyword)),
    )
    if (sort !== undefined) {
      const direction = order === 'desc' ? -1 : 1
      // 값이 같으면 가입한 순서(id)를 따르므로 같은 요청에는 늘 같은 순서로 답한다.
      filtered.sort((a, b) => direction * a[sort].localeCompare(b[sort], 'ko') || a.id - b.id)
    }
    return HttpResponse.json({
      items: slicePage(filtered, page, pageSize),
      total: filtered.length,
      page,
      pageSize,
    } satisfies MemberPage)
  }),
]

import { http, HttpResponse } from 'msw'
import { MOCK_API_BASE_URL } from '@/shared/api/base-url'
import {
  CreateUserBody,
  ListUsersParams,
  Role,
  UpdateUserBody,
  type UserAccount,
  type UserAccountPage,
  type UserStats,
  UserStatus,
} from '@/shared/api/generated/model'
import {
  mockUserOf,
  mockUsers,
  resetMockUsers as resetAuthMockUsers,
  saveMockUser,
} from '@/shared/auth/auth-mock-handlers'
import { slicePage } from '@/shared/lib/array'
import { readJsonBody, searchParamsOf } from '@/shared/lib/http'

// 대시보드 Archetype: 사용자 관리 API(users tag)를 흉내 내는 목 백엔드. 명세에서 생성한 핸들러는 늘 같은 example을
// 돌려주므로, 추가하고 고친 사용자를 기억하고 쿼리 파라미터대로 거르고 정렬하는 핸들러를 따로 둔다. 확장 지점 mockHandlers
// (Archetype의 extensions.json)로 선언해, MSW의 핸들러 목록(src/shared/mocks/handlers.ts)이 생성된 핸들러보다 앞에 둔다.
// 생성된 핸들러처럼 목 백엔드 주소(MOCK_API_BASE_URL)로 가는 요청만 받는다(ADR-0013). Vitest, 개발 서버, E2E 대상 서버가 모두
// 이 핸들러를 쓴다. 사용자는 서버 프로세스의 메모리에만 있어 서버를 다시 띄우면 처음 상태로 돌아간다. 실제 백엔드로 바꾸면
// 쓰이지 않는다.
//
// 실제 백엔드처럼 요청의 accessToken으로 사용자와 역할을 확인한다(명세의 bearerAuth, 401, 403). accessToken은 auth Recipe의 목
// 백엔드(src/shared/auth/auth-mock-handlers.ts)가 발급한 것이고, 앱에서는 BFF 프록시와 서버의 apiFetch가 세션의 accessToken을
// 붙인다(auth-backend-fetch.ts). 화면 쪽 접근 규칙(src/shared/auth/access-rules.ts의 PROTECTED_ROUTES)이 관리자가 아닌 사용자를
// 추가·수정 화면에 들이지 않아도, 백엔드는 따로 요청을 거절한다.
//
// 실제 백엔드에서는 대시보드가 관리하는 사용자와 로그인하는 사용자가 같은 사용자 저장소에 있으므로, 사용자의 이름, 이메일, 역할은
// 따로 두지 않고 auth의 목 백엔드가 가진 사용자 저장소(mockUsers, saveMockUser)에 둔다. 그래서 대시보드에서 추가한 사용자도
// MOCK_PASSWORD로 로그인하고, 바꾼 역할은 목 백엔드의 다음 요청부터, 로그인 세션에는 다음 로그인이나 refresh부터 쓰인다.
// 대시보드에만 있는 정보(상태, 부서, 추가한 날)는 이 파일이 사용자 id마다 기억한다.

/** 목 백엔드의 처음 사용자. auth Recipe의 목 계정(user@example.com, admin@example.com)도 들어 있다. */
const SEED_USERS: readonly UserAccount[] = [
  {
    id: 1,
    name: '김사용',
    email: 'user@example.com',
    role: 'user',
    status: 'active',
    department: '영업팀',
    joinedAt: '2025-01-15',
  },
  {
    id: 2,
    name: '박관리',
    email: 'admin@example.com',
    role: 'admin',
    status: 'active',
    department: '운영팀',
    joinedAt: '2025-03-02',
  },
  {
    id: 3,
    name: '이서준',
    email: 'seojun.lee@example.com',
    role: 'user',
    status: 'active',
    department: '개발팀',
    joinedAt: '2025-04-11',
  },
  { id: 4, name: '최유나', email: 'yuna.choi@example.com', role: 'user', status: 'invited', joinedAt: '2025-05-20' },
  {
    id: 5,
    name: '정하준',
    email: 'hajun.jung@example.com',
    role: 'admin',
    status: 'active',
    department: '개발팀',
    joinedAt: '2025-06-03',
  },
  {
    id: 6,
    name: '강민지',
    email: 'minji.kang@example.com',
    role: 'user',
    status: 'suspended',
    department: '영업팀',
    joinedAt: '2025-06-18',
  },
  {
    id: 7,
    name: '윤도현',
    email: 'dohyun.yoon@example.com',
    role: 'user',
    status: 'active',
    department: '디자인팀',
    joinedAt: '2025-07-07',
  },
  { id: 8, name: '장수아', email: 'sua.jang@example.com', role: 'user', status: 'active', joinedAt: '2025-08-25' },
  {
    id: 9,
    name: '임지호',
    email: 'jiho.lim@example.com',
    role: 'user',
    status: 'invited',
    department: '마케팅팀',
    joinedAt: '2025-09-14',
  },
  {
    id: 10,
    name: '한예준',
    email: 'yejun.han@example.com',
    role: 'admin',
    status: 'active',
    department: '운영팀',
    joinedAt: '2025-10-01',
  },
  {
    id: 11,
    name: '오지아',
    email: 'jia.oh@example.com',
    role: 'user',
    status: 'active',
    department: '개발팀',
    joinedAt: '2025-11-12',
  },
  {
    id: 12,
    name: '서하린',
    email: 'harin.seo@example.com',
    role: 'user',
    status: 'suspended',
    department: '마케팅팀',
    joinedAt: '2026-01-08',
  },
]

/** 대시보드에만 있는 사용자 정보. 이름, 이메일, 역할은 auth의 사용자 저장소에 있다. */
type Profile = Omit<UserAccount, 'id' | 'name' | 'email' | 'role'>

let profiles = new Map<number, Profile>()

/** 대시보드는 사용자마다 역할 하나를 고르고, 로그인하는 사용자(auth의 User)는 역할 목록을 갖는다. 관리자는 사용자 역할도 갖는다. */
const ROLES_OF: Record<Role, readonly Role[]> = { admin: ['admin', 'user'], user: ['user'] }

/** 사용자를 기억한다. 이름, 이메일, 역할은 auth의 사용자 저장소에, 나머지는 profiles에 둔다. */
function saveUser({ id, name, email, role, ...profile }: UserAccount): void {
  saveMockUser({ id, email, name, roles: [...ROLES_OF[role]] })
  profiles.set(id, profile)
}

/** 대시보드의 사용자. auth의 사용자 저장소의 사용자에 대시보드의 정보를 붙인다(대시보드가 더하지 않은 사용자는 뺀다). */
function allUsers(): UserAccount[] {
  return mockUsers().flatMap((user) => {
    const profile = profiles.get(user.id)
    return profile === undefined
      ? []
      : [
          {
            id: user.id,
            name: user.name,
            email: user.email,
            // 로그인하는 사용자의 역할 목록에 관리자가 있으면 관리자다(ROLES_OF).
            role: user.roles.includes('admin') ? 'admin' : 'user',
            ...profile,
          },
        ]
  })
}

/** 사용자를 처음 상태로 되돌린다(auth의 사용자 저장소도 함께). 테스트가 서로의 추가·수정에 영향을 받지 않게 할 때 쓴다. */
export function resetMockUsers(): void {
  resetAuthMockUsers([])
  profiles = new Map()
  for (const user of SEED_USERS) saveUser(user)
}

// 서버가 이 핸들러를 불러오면 처음 사용자를 auth의 사용자 저장소에 넣는다.
resetMockUsers()

function userAt(userId: unknown): UserAccount | undefined {
  return allUsers().find((user) => String(user.id) === userId)
}

/** 같은 이메일로는 로그인할 사용자를 가릴 수 없으므로, 대시보드가 모르는 사용자까지 auth의 사용자 저장소에서 찾는다. */
function emailTaken(email: string, exceptId?: number): boolean {
  return mockUsers().some((user) => user.email.toLowerCase() === email.toLowerCase() && user.id !== exceptId)
}

const DUPLICATE_EMAIL = '같은 이메일의 사용자가 이미 있습니다.'

/** 사용자를 추가하고 고칠 수 있는 역할(명세의 createUser·updateUser). 화면 쪽 접근 규칙의 추가·수정 화면과 같다. */
const MANAGER_ROLES: readonly Role[] = ['admin']

/**
 * 요청한 사용자를 accessToken으로 확인해, 거절할 요청이면 그 응답을 돌려준다. accessToken이 없거나 만료되었으면 401,
 * roles가 있는데 그 가운데 어느 역할도 없으면 403이다. 들어줄 요청이면 undefined
 */
function rejectionOf(request: Request, roles?: readonly Role[]) {
  const user = mockUserOf(request)
  if (user === undefined) return HttpResponse.json({ message: 'accessToken이 없거나 만료되었습니다.' }, { status: 401 })
  if (roles !== undefined && !roles.some((role) => user.roles.includes(role))) {
    return HttpResponse.json({ message: '사용자를 추가하고 고치는 것은 관리자만 할 수 있습니다.' }, { status: 403 })
  }
  return undefined
}

export const usersHandlers = [
  // /users/:userId보다 앞에 두어 stats를 사용자 id로 읽지 않게 한다.
  http.get(`${MOCK_API_BASE_URL}/users/stats`, ({ request }) => {
    const rejection = rejectionOf(request)
    if (rejection !== undefined) return rejection
    const all = allUsers()
    return HttpResponse.json({
      total: all.length,
      byStatus: UserStatus.options.map((status) => ({
        status,
        count: all.filter((user) => user.status === status).length,
      })),
      byRole: Role.options.map((role) => ({ role, count: all.filter((user) => user.role === role).length })),
    } satisfies UserStats)
  }),

  http.get(`${MOCK_API_BASE_URL}/users`, ({ request }) => {
    const rejection = rejectionOf(request)
    if (rejection !== undefined) return rejection
    // 실제 백엔드처럼 명세에 없는 값(알 수 없는 정렬 항목 등)은 400으로 거절한다.
    const params = ListUsersParams.safeParse(searchParamsOf(new URL(request.url), ['page', 'pageSize']))
    if (!params.success) return HttpResponse.json({ message: params.error.message }, { status: 400 })
    // 명세의 listUsers처럼 사용자를 거르고(q, role, status) 정렬하고(sort, order) 한 페이지(page, pageSize)를 잘라 돌려준다.
    const { q, role, status, sort, order, page, pageSize } = params.data
    const keyword = q?.trim().toLowerCase() ?? ''
    const filtered = allUsers().filter(
      (user) =>
        (role === undefined || user.role === role) &&
        (status === undefined || user.status === status) &&
        (keyword === '' || `${user.name} ${user.email}`.toLowerCase().includes(keyword)),
    )
    if (sort === undefined) {
      // 정렬하지 않으면 최근에 추가한 사용자부터다.
      filtered.sort((a, b) => b.id - a.id)
    } else {
      const direction = order === 'desc' ? -1 : 1
      // 값이 같으면 추가한 순서(id)를 따르므로 같은 요청에는 늘 같은 순서로 답한다.
      filtered.sort((a, b) => direction * a[sort].localeCompare(b[sort], 'ko') || a.id - b.id)
    }
    return HttpResponse.json({
      items: slicePage(filtered, page, pageSize),
      total: filtered.length,
      page,
      pageSize,
    } satisfies UserAccountPage)
  }),

  http.post(`${MOCK_API_BASE_URL}/users`, async ({ request }) => {
    const rejection = rejectionOf(request, MANAGER_ROLES)
    if (rejection !== undefined) return rejection
    const body = CreateUserBody.safeParse(await readJsonBody(request))
    if (!body.success) return HttpResponse.json({ message: body.error.message }, { status: 400 })
    if (emailTaken(body.data.email)) return HttpResponse.json({ message: DUPLICATE_EMAIL }, { status: 409 })
    const created: UserAccount = {
      ...body.data,
      id: Math.max(0, ...mockUsers().map((user) => user.id)) + 1,
      status: 'invited',
      joinedAt: new Date().toISOString().slice(0, 10),
    }
    saveUser(created)
    return HttpResponse.json(created, { status: 201 })
  }),

  http.get(`${MOCK_API_BASE_URL}/users/:userId`, ({ params, request }) => {
    const rejection = rejectionOf(request)
    if (rejection !== undefined) return rejection
    const user = userAt(params['userId'])
    return user === undefined
      ? HttpResponse.json({ message: '그런 사용자가 없습니다.' }, { status: 404 })
      : HttpResponse.json(user)
  }),

  http.put(`${MOCK_API_BASE_URL}/users/:userId`, async ({ params, request }) => {
    const rejection = rejectionOf(request, MANAGER_ROLES)
    if (rejection !== undefined) return rejection
    const current = userAt(params['userId'])
    if (current === undefined) return HttpResponse.json({ message: '그런 사용자가 없습니다.' }, { status: 404 })
    const body = UpdateUserBody.safeParse(await readJsonBody(request))
    if (!body.success) return HttpResponse.json({ message: body.error.message }, { status: 400 })
    if (emailTaken(body.data.email, current.id)) return HttpResponse.json({ message: DUPLICATE_EMAIL }, { status: 409 })
    // PUT이므로 보내지 않은 선택 항목(department)은 지운다.
    const updated: UserAccount = { ...body.data, id: current.id, joinedAt: current.joinedAt }
    saveUser(updated)
    return HttpResponse.json(updated)
  }),
]

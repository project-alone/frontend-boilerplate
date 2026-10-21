import { join } from 'node:path'
import { beforeAll, describe, expect, test } from 'vitest'
import { addOperations } from './schematic.ts'
import {
  dcgen,
  expectFilesToMatchSnapshots,
  expectFileToPass,
  readTree,
  restoreBeforeEach,
  runVitestScript,
  type Starter,
  useStarter,
} from './starter.ts'

// 생성 결과 스냅샷
const SNAPSHOTS = './__snapshots__/g-form'

// form Schematic이 읽고 쓰는 곳. 폼은 Feature(src/features/<feature>/)에 만들고, 뮤테이션 훅은 Query Domain(src/queries/<domain>/)에서 찾는다.
const FEATURES_DIR = 'src/features'
const QUERIES_DIR = 'src/queries'

// Base의 샘플 명세(openapi.yaml)에 하네스가 더하는 operation. 샘플의 products(listProducts, createProduct)는 그대로 두고 다음을 더한다.
// - products tag에 path 파라미터와 요청 본문을 받는 PUT, 요청 본문이 없는 DELETE → 폼이 path 파라미터를 props로 받기, 요청 본문이 없는 operation
// - members tag(Query Domain 모듈이 없다)에 입력 요소의 종류(문자열, 이메일, 정수, 숫자, enum, 반드시 true여야 하는 불리언)를
//   모두 담은 인라인 요청 본문의 POST → 응답 본문이 없는(204) 뮤테이션, title·description으로 정한 레이블과 설명,
//   입력 요소로 만들 수 없는 선택 필드(배열), 체크해야 보낼 수 있는 체크박스(const: true, enum: [true])
// - 같은 tag에 선택 필드만 받는 PATCH → 비워 두고 제출해도 검증에 실패하지 않는 폼(길이 규칙으로 검증 실패를 보인다)
// - 같은 tag에 null을 받는 필드(3.1의 type: [..., 'null'], 3.0의 nullable: true, anyOf의 null)를 필수·선택으로 받는 PUT
//   → 비워 둔 필수 필드는 null로, 비워 둔 선택 필드는 빼고 보낸다
// - 같은 tag에 입력 요소로 만들 수 없는 필수 필드(객체)를 받는 POST → 폼을 만들지 않는다
const HARNESS_OPERATIONS = `
tags:
  - name: members
    description: 회원
paths:
  /products/{productId}:
    put:
      operationId: updateProduct
      summary: 상품 수정
      tags: [products]
      parameters:
        - name: productId
          in: path
          required: true
          schema:
            type: integer
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/NewProduct'
      responses:
        '200':
          description: 수정된 상품
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Product'
    delete:
      operationId: deleteProduct
      summary: 상품 삭제
      tags: [products]
      parameters:
        - name: productId
          in: path
          required: true
          schema:
            type: integer
      responses:
        '204':
          description: 삭제됨
  /members:
    post:
      operationId: registerMember
      summary: 회원 가입
      tags: [members]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [name, email, grade, agreed, privacy]
              properties:
                name:
                  type: string
                  title: 이름
                  minLength: 1
                  maxLength: 20
                email:
                  type: string
                  format: email
                  title: 이메일
                age:
                  type: integer
                  title: 나이
                  minimum: 14
                height:
                  type: number
                  title: 키
                  description: cm 단위로 적습니다.
                grade:
                  type: string
                  title: 등급
                  enum: [basic, premium]
                nickname:
                  type: string
                  title: 별명
                agreed:
                  type: boolean
                  const: true
                  title: 약관에 동의합니다
                privacy:
                  type: boolean
                  enum: [true]
                  title: 개인정보 처리에 동의합니다
                marketing:
                  type: boolean
                  title: 마케팅 정보를 받습니다
                interests:
                  type: array
                  items:
                    type: string
      responses:
        '204':
          description: 가입됨
  /members/me:
    patch:
      operationId: updateMemberProfile
      summary: 내 정보 수정
      tags: [members]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                nickname:
                  type: string
                  title: 별명
                  maxLength: 10
                newsletter:
                  type: boolean
                  title: 소식 받기
      responses:
        '204':
          description: 수정됨
  /members/me/contact:
    put:
      operationId: updateMemberContact
      summary: 연락처 수정
      tags: [members]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [phone, floor, region]
              properties:
                phone:
                  type: [string, 'null']
                  title: 전화번호
                  maxLength: 20
                floor:
                  type: [integer, 'null']
                  title: 층
                  minimum: 1
                region:
                  type: [string, 'null']
                  title: 지역
                  enum: [seoul, busan, null]
                memo:
                  type: string
                  nullable: true
                  title: 메모
                homepage:
                  title: 홈페이지
                  anyOf:
                    - type: string
                      format: uri
                    - type: 'null'
                extension:
                  type: string
                  title: 내선 번호
                sms:
                  type: [boolean, 'null']
                  title: 문자를 받습니다
      responses:
        '204':
          description: 수정됨
  /members/addresses:
    post:
      operationId: addMemberAddress
      summary: 주소 등록
      tags: [members]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [label, address]
              properties:
                label:
                  type: string
                address:
                  $ref: '#/components/schemas/Address'
      responses:
        '204':
          description: 등록됨
components:
  schemas:
    Address:
      type: object
      required: [city]
      properties:
        city:
          type: string
`

/** Starter 안에서 Schematic을 실행하고 성공했는지 확인한다. */
function generate(starter: Starter, args: readonly string[]): void {
  const result = dcgen(starter, ['g', ...args])
  expect(result.status, result.output).toBe(0)
}

// Starter의 검사를 통과하는지 볼 때 만드는 폼: 응답 본문이 있는 샘플 operation, 경로 파라미터를 받는 operation(같은 Feature),
// 입력 요소의 종류를 모두 담은 응답 본문이 없는 operation(새 Query Domain, 새 Feature), 선택 필드만 받는 operation,
// null을 받는 필드가 있는 operation. stem은 만들어지는 세 파일의 확장자를 뺀 경로다.
const CHECKED_FORMS = [
  { operationId: 'createProduct', feature: 'product-admin', stem: 'src/features/product-admin/create-product-form' },
  { operationId: 'updateProduct', feature: 'product-admin', stem: 'src/features/product-admin/update-product-form' },
  { operationId: 'registerMember', feature: 'members', stem: 'src/features/members/register-member-form' },
  { operationId: 'updateMemberProfile', feature: 'members', stem: 'src/features/members/update-member-profile-form' },
  { operationId: 'updateMemberContact', feature: 'members', stem: 'src/features/members/update-member-contact-form' },
]

/**
 * CHECKED_FORMS를 뮤테이션 훅과 함께 만든 Starter가 생성 직후 그대로 타입 검사, lint, 포맷 검사를 통과하고, 생성된 테스트
 * (제출 성공, 검증 실패)와 스토리(접근성 검사)가 실제로 실행되어 통과하는지 본다. storybookRuns는 스토리 하나가 실행되는 횟수다
 * (dark-mode Recipe는 두 테마에서 한 번씩).
 */
function expectGeneratedFormsToPassStarterChecks(starter: Starter, { storybookRuns }: { storybookRuns: number }): void {
  for (const { operationId, feature } of CHECKED_FORMS) {
    generate(starter, ['mutation', operationId])
    generate(starter, ['form', operationId, '--feature', feature])
  }

  for (const script of ['typecheck', 'lint', 'format:check']) starter.expectNpmSuccess(['run', script])
  const unit = runVitestScript(starter, ['test'])
  for (const { stem } of CHECKED_FORMS) expectFileToPass(unit, `${stem}.test.tsx`, 1)
  const storybook = runVitestScript(starter, ['run', 'test:storybook'])
  for (const { stem } of CHECKED_FORMS) expectFileToPass(storybook, `${stem}.stories.tsx`, storybookRuns)
}

describe('server Starter', () => {
  const starter = useStarter({ prefix: 'dcgen-g-form-', install: true, playwright: true })
  const featuresTree = () => readTree(join(starter.dir, FEATURES_DIR))

  beforeAll(() => {
    addOperations(starter, HARNESS_OPERATIONS)
  })
  // 테스트마다 Feature와 Query Domain을 생성 직후 상태(Base의 샘플만 있고 뮤테이션 훅은 없는 상태)로 되돌린다.
  restoreBeforeEach(starter, [FEATURES_DIR, QUERIES_DIR])

  test('폼과 이을 뮤테이션 훅이 없으면 먼저 mutation Schematic을 실행하라고 안내하고 아무 파일도 만들지 않는다', () => {
    const before = featuresTree()

    const result = dcgen(starter, ['g', 'form', 'createProduct', '--feature', 'product-admin'])

    expect(result.status).not.toBe(0)
    expect(result.output).toContain('src/queries/products/products.queries.ts에 useCreateProductMutation가 없습니다')
    expect(result.output).toContain('npm run g -- mutation createProduct')
    expect(featuresTree()).toEqual(before)
  })

  test('dcgen g form은 요청 본문 스키마로 검증하고 뮤테이션 훅으로 보내는 폼과 스토리, 테스트를 Feature에 만든다', async () => {
    generate(starter, ['mutation', 'registerMember'])

    const result = dcgen(starter, ['g', 'form', 'registerMember', '--feature', 'members'])

    expect(result.status, result.output).toBe(0)
    expect(result.output).toContain('src/features/members/register-member-form.tsx')
    // 입력 요소로 만들 수 없는 선택 필드는 빼고 알린다.
    expect(result.output).toContain('입력 요소로 만들지 않은 선택 필드: interests(배열)')
    expect(Object.keys(readTree(join(starter.dir, FEATURES_DIR, 'members'))).sort()).toEqual([
      'register-member-form.stories.tsx',
      'register-member-form.test.tsx',
      'register-member-form.tsx',
    ])
    await expectFilesToMatchSnapshots(starter, SNAPSHOTS, `${FEATURES_DIR}/members`, [
      'register-member-form.tsx',
      'register-member-form.stories.tsx',
      'register-member-form.test.tsx',
    ])
  })

  test('npm run g -- form은 경로 파라미터를 받는 operation이면 폼이 그 값을 props로 받아 요청 본문과 함께 뮤테이션에 넘긴다', async () => {
    generate(starter, ['mutation', 'updateProduct'])

    const result = starter.npm(['run', 'g', '--', 'form', 'updateProduct', '--feature', 'product-admin'])

    expect(result.status, result.failureMessage).toBe(0)
    await expectFilesToMatchSnapshots(starter, SNAPSHOTS, `${FEATURES_DIR}/product-admin`, [
      'update-product-form.tsx',
      'update-product-form.test.tsx',
    ])
  })

  test('비워 두면 실패하는 필수 입력이 없는 폼은 길이 규칙에 맞지 않는 값으로 검증 실패를 테스트하고 스토리로 보인다', async () => {
    generate(starter, ['mutation', 'updateMemberProfile'])

    generate(starter, ['form', 'updateMemberProfile', '--feature', 'members'])

    await expectFilesToMatchSnapshots(starter, SNAPSHOTS, `${FEATURES_DIR}/members`, [
      'update-member-profile-form.test.tsx',
      'update-member-profile-form.stories.tsx',
    ])
  })

  test('null을 받는 필드는 같은 입력 요소로 받고, 비워 둔 필수 필드는 null로, 비워 둔 선택 필드는 빼고 보내는지 테스트한다', async () => {
    generate(starter, ['mutation', 'updateMemberContact'])

    const result = dcgen(starter, ['g', 'form', 'updateMemberContact', '--feature', 'members'])

    expect(result.status, result.output).toBe(0)
    expect(result.output).not.toContain('입력 요소로 만들지 않은 선택 필드')
    await expectFilesToMatchSnapshots(starter, SNAPSHOTS, `${FEATURES_DIR}/members`, [
      'update-member-contact-form.tsx',
      'update-member-contact-form.test.tsx',
    ])
  })

  test('같은 이름의 파일이 하나라도 있으면 덮어쓰지 않고 겹치는 파일을 알린 뒤 아무 파일도 만들지 않는다', () => {
    generate(starter, ['mutation', 'createProduct'])
    starter.writeFile(`${FEATURES_DIR}/product-admin/create-product-form.test.tsx`, '// 개발자가 먼저 쓴 테스트\n')
    const before = featuresTree()

    const result = dcgen(starter, ['g', 'form', 'createProduct', '--feature', 'product-admin'])

    expect(result.status).not.toBe(0)
    expect(result.output).toContain('src/features/product-admin/create-product-form.test.tsx')
    expect(featuresTree()).toEqual(before)
  })

  test.each([
    {
      problem: '요청 본문이 없는 operation',
      args: ['deleteProduct', '--feature', 'product-admin'],
      reason: 'JSON 요청 본문(application/json)이 있는 operation으로만 폼을 만듭니다',
    },
    {
      problem: '명세에 없는 operationId',
      args: ['createProductz', '--feature', 'product-admin'],
      reason: "operationId가 'createProductz'인 operation이 없습니다",
    },
    { problem: 'Feature를 고르지 않은 폼', args: ['createProduct'], reason: '폼을 둘 Feature를 고르세요: --feature' },
    {
      problem: '하위 폴더를 만드는 Feature 이름',
      args: ['createProduct', '--feature', 'products/admin'],
      reason: "쓸 수 없는 Feature 이름입니다: 'products/admin'",
    },
    {
      problem: '입력 요소로 만들 수 없는 필수 필드',
      args: ['addMemberAddress', '--feature', 'members'],
      reason: '입력 요소로 만들 수 없는 필수 필드가 있어 폼을 만들지 않았습니다',
    },
  ])('$problem: 이유를 알리고 아무 파일도 만들지 않은 채 실패한다', ({ args, reason }) => {
    generate(starter, ['mutation', 'createProduct'])
    const before = featuresTree()

    const result = dcgen(starter, ['g', 'form', ...args])

    expect(result.status).not.toBe(0)
    expect(result.output).toContain(reason)
    expect(featuresTree()).toEqual(before)
  })

  test('form Schematic이 만든 코드로 Starter의 타입 검사, lint, 포맷 검사, 테스트, 스토리 접근성 검사가 모두 통과한다', () => {
    expectGeneratedFormsToPassStarterChecks(starter, { storybookRuns: 1 })
  })
})

// 폼은 Rendering Mode에 따라 요청이 가는 곳(static-export는 브라우저가 백엔드를 직접 부른다)이 다르므로 static-export Starter에서도
// 생성한 테스트가 통과하는지 보고, dark-mode Recipe가 스토리를 라이트 모드와 다크 모드 브라우저에서 한 번씩 실행하므로
// 오류가 보이는 폼의 접근성 검사(색 대비 등)를 두 테마에서 함께 본다.
describe('static-export Starter에 dark-mode Recipe를 넣은 Starter', () => {
  const starter = useStarter({
    prefix: 'dcgen-g-form-static-dark-',
    renderingMode: 'static-export',
    recipes: ['dark-mode'],
    install: true,
    playwright: true,
  })

  beforeAll(() => {
    addOperations(starter, HARNESS_OPERATIONS)
  })

  test('form Schematic이 만든 코드로 Starter의 검사가 모두 통과하고, 스토리가 두 테마에서 접근성 검사를 통과한다', () => {
    expectGeneratedFormsToPassStarterChecks(starter, { storybookRuns: 2 })
  })
})

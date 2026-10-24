import { readFileSync } from 'node:fs'
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
// - 같은 tag에 null을 받는 필드(3.1의 type: [..., 'null'], 3.0의 nullable: true, anyOf·oneOf의 null)를 필수·선택으로 받는 PUT
//   → 비워 둔 필수 필드는 null로, 비워 둔 선택 필드는 빼고, 기본값이 있는 필드는 기본값으로 보낸다. 체크하지 않은
//   반드시 true여야 하는 선택 필드(const: true)는 보내지 않는다
// - 같은 tag에 입력 요소로 만들 수 없는 필수 필드(객체)를 받는 POST → 폼을 만들지 않는다
// - reviews tag(Query Domain 모듈이 없다)에 상품의 리뷰 목록 GET(경로 파라미터 productId, 선택 쿼리 파라미터)과, 그 목록을
//   응답 전에 고치는(--optimistic) 뮤테이션 둘 → 뮤테이션 훅이 목록 쿼리의 인자(productId, params)를 받는다.
//   리뷰 작성(POST)은 경로 파라미터 productId가 훅의 인자와 같고, 리뷰 수정(PATCH)은 경로 파라미터(reviewId)와 훅의 인자가 다르다
const HARNESS_OPERATIONS = `
tags:
  - name: members
    description: 회원
  - name: reviews
    description: 상품 리뷰
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
                fax:
                  title: 팩스
                  oneOf:
                    - type: string
                    - type: 'null'
                greeting:
                  type: [string, 'null']
                  title: 인사말
                  default: 안녕하세요
                extension:
                  type: string
                  title: 내선 번호
                sms:
                  type: [boolean, 'null']
                  title: 문자를 받습니다
                shared:
                  type: boolean
                  const: true
                  title: 연락처 공개에 동의합니다
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
  /products/{productId}/reviews:
    get:
      operationId: listProductReviews
      summary: 상품 리뷰 목록
      tags: [reviews]
      parameters:
        - name: productId
          in: path
          required: true
          schema:
            type: integer
        - name: sort
          in: query
          schema:
            type: string
            enum: [newest, rating]
      responses:
        '200':
          description: 리뷰 목록
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Review'
    post:
      operationId: createProductReview
      summary: 리뷰 작성
      tags: [reviews]
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
              $ref: '#/components/schemas/NewReview'
      responses:
        '201':
          description: 작성한 리뷰
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Review'
  /reviews/{reviewId}:
    patch:
      operationId: updateReview
      summary: 리뷰 수정
      tags: [reviews]
      parameters:
        - name: reviewId
          in: path
          required: true
          schema:
            type: integer
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/NewReview'
      responses:
        '200':
          description: 수정한 리뷰
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Review'
components:
  schemas:
    Address:
      type: object
      required: [city]
      properties:
        city:
          type: string
    NewReview:
      type: object
      required: [rating]
      properties:
        rating:
          type: integer
          title: 별점
          minimum: 1
          maximum: 5
        comment:
          type: string
          title: 리뷰
          maxLength: 200
    Review:
      type: object
      required: [id, productId, rating]
      properties:
        id:
          type: integer
        productId:
          type: integer
        rating:
          type: integer
        comment:
          type: string
`

// --optimistic 뮤테이션 훅(리뷰 작성, 리뷰 수정)이 응답 전에 고치는 쿼리. 폼보다 먼저 그 queryOptions를 만든다.
const OPTIMISTIC_QUERY = 'listProductReviews'

/** Starter 안에서 Schematic을 실행하고 성공했는지 확인한다. */
function generate(starter: Starter, args: readonly string[]): void {
  const result = dcgen(starter, ['g', ...args])
  expect(result.status, result.output).toBe(0)
}

// Starter의 검사를 통과하는지 볼 때 만드는 폼: 응답 본문이 있는 샘플 operation, 경로 파라미터를 받는 operation(같은 Feature),
// 입력 요소의 종류를 모두 담은 응답 본문이 없는 operation(새 Query Domain, 새 Feature), 선택 필드만 받는 operation,
// null을 받는 필드가 있는 operation, 뮤테이션 훅을 --optimistic으로 만든 operation(훅이 고칠 쿼리의 인자를 받는다).
// stem은 만들어지는 세 파일의 확장자를 뺀 경로다.
const CHECKED_FORMS = [
  { operationId: 'createProduct', feature: 'product-admin', stem: 'src/features/product-admin/create-product-form' },
  { operationId: 'updateProduct', feature: 'product-admin', stem: 'src/features/product-admin/update-product-form' },
  { operationId: 'registerMember', feature: 'members', stem: 'src/features/members/register-member-form' },
  { operationId: 'updateMemberProfile', feature: 'members', stem: 'src/features/members/update-member-profile-form' },
  { operationId: 'updateMemberContact', feature: 'members', stem: 'src/features/members/update-member-contact-form' },
  {
    operationId: 'createProductReview',
    feature: 'product-reviews',
    stem: 'src/features/product-reviews/create-product-review-form',
    optimistic: true,
  },
  {
    operationId: 'updateReview',
    feature: 'product-reviews',
    stem: 'src/features/product-reviews/update-review-form',
    optimistic: true,
  },
]

/** operationId의 뮤테이션 훅을 만든다. optimistic이면 OPTIMISTIC_QUERY를 응답 전에 고치는 훅이다(그 queryOptions가 먼저 있어야 한다). */
function generateMutation(starter: Starter, operationId: string, { optimistic = false } = {}): void {
  generate(starter, ['mutation', operationId, ...(optimistic ? ['--optimistic', OPTIMISTIC_QUERY] : [])])
}

/**
 * CHECKED_FORMS를 뮤테이션 훅과 함께 만든 Starter가 생성 직후 그대로 타입 검사, lint, 포맷 검사를 통과하고, 생성된 테스트
 * (제출 성공, 처음 화면과 검증 오류 화면의 접근성, 검증 실패)가 실제로 실행되어 통과하는지 본다.
 */
function expectGeneratedFormsToPassStarterChecks(starter: Starter): void {
  generate(starter, ['query', OPTIMISTIC_QUERY])
  for (const { operationId, feature, optimistic } of CHECKED_FORMS) {
    generateMutation(starter, operationId, { optimistic })
    generate(starter, ['form', operationId, '--feature', feature])
  }

  for (const script of ['typecheck', 'lint', 'format:check']) starter.expectNpmSuccess(['run', script])
  const unit = runVitestScript(starter, ['test'])
  for (const { stem } of CHECKED_FORMS) expectFileToPass(unit, `${stem}.test.tsx`, 1)
}

describe('server Starter', () => {
  const starter = useStarter({ prefix: 'dcgen-g-form-', install: true })
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

  test('dcgen g form은 요청 본문 스키마로 검증하고 뮤테이션 훅으로 보내는 폼과 테스트를 Feature에 만들고, 스토리는 만들지 않는다', async () => {
    generate(starter, ['mutation', 'registerMember'])

    const result = dcgen(starter, ['g', 'form', 'registerMember', '--feature', 'members'])

    expect(result.status, result.output).toBe(0)
    expect(result.output).toContain('src/features/members/register-member-form.tsx')
    // 입력 요소로 만들 수 없는 선택 필드는 빼고 알린다.
    expect(result.output).toContain('입력 요소로 만들지 않은 선택 필드: interests(배열)')
    expect(Object.keys(readTree(join(starter.dir, FEATURES_DIR, 'members'))).sort()).toEqual([
      'register-member-form.test.tsx',
      'register-member-form.tsx',
    ])
    await expectFilesToMatchSnapshots(starter, SNAPSHOTS, `${FEATURES_DIR}/members`, [
      'register-member-form.tsx',
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

  test('비워 두면 실패하는 필수 입력이 없는 폼은 길이 규칙에 맞지 않는 값으로 검증 실패를 테스트한다', async () => {
    generate(starter, ['mutation', 'updateMemberProfile'])

    generate(starter, ['form', 'updateMemberProfile', '--feature', 'members'])

    await expectFilesToMatchSnapshots(starter, SNAPSHOTS, `${FEATURES_DIR}/members`, ['update-member-profile-form.test.tsx'])
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

  test('--optimistic으로 만든 뮤테이션 훅이 고칠 쿼리의 인자를 받으면, 폼이 그 인자를 props로 받아 훅에 넘긴다', async () => {
    generate(starter, ['query', OPTIMISTIC_QUERY])
    for (const operationId of ['createProductReview', 'updateReview']) {
      generateMutation(starter, operationId, { optimistic: true })
    }

    // 리뷰 작성: 훅의 인자 productId는 폼이 이미 받는 경로 파라미터와 같은 값이다.
    generate(starter, ['form', 'createProductReview', '--feature', 'product-reviews'])
    // 리뷰 수정: 경로 파라미터(reviewId)와 따로 훅의 인자(productId, 생략할 수 있는 params)를 props로 받는다.
    const result = dcgen(starter, ['g', 'form', 'updateReview', '--feature', 'product-reviews'])

    expect(result.status, result.output).toBe(0)
    expect(result.output).toContain('폼은 뮤테이션 훅(useUpdateReviewMutation)의 인자(productId, params)도 props로 받아 훅에 넘깁니다')
    await expectFilesToMatchSnapshots(starter, SNAPSHOTS, `${FEATURES_DIR}/product-reviews`, [
      'create-product-review-form.tsx',
      'update-review-form.tsx',
      'update-review-form.test.tsx',
    ])
  })

  test.each([
    {
      problem: '생성한 테스트가 넘길 값을 정할 수 없는 타입의 필수 인자를 받는 뮤테이션 훅',
      operationId: 'createProduct',
      hook: 'useCreateProductMutation',
      parameters: 'filter: { q: string }',
      reason: 'useCreateProductMutation의 필수 인자 filter({ q: string })',
    },
    {
      problem: '폼이 받는 경로 파라미터와 이름은 같고 타입은 다른 인자를 받는 뮤테이션 훅',
      operationId: 'updateProduct',
      hook: 'useUpdateProductMutation',
      parameters: 'productId: string',
      reason: 'useUpdateProductMutation의 인자 productId(string)',
    },
  ])('$problem: 이유를 알리고 아무 파일도 만들지 않은 채 실패한다', ({ operationId, hook, parameters, reason }) => {
    generate(starter, ['mutation', operationId])
    // 개발자가 뮤테이션 훅이 받는 인자를 고쳤다.
    const queries = `${QUERIES_DIR}/products/products.queries.ts`
    const source = readFileSync(join(starter.dir, queries), 'utf8')
    expect(source).toContain(`export function ${hook}() {`)
    starter.writeFile(queries, source.replace(`export function ${hook}() {`, `export function ${hook}(${parameters}) {`))
    const before = featuresTree()

    const result = dcgen(starter, ['g', 'form', operationId, '--feature', 'product-admin'])

    expect(result.status).not.toBe(0)
    expect(result.output).toContain(reason)
    expect(featuresTree()).toEqual(before)
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

  test('form Schematic이 만든 코드로 Starter의 타입 검사, lint, 포맷 검사, 테스트(접근성 검사 포함)가 모두 통과한다', () => {
    expectGeneratedFormsToPassStarterChecks(starter)
  })
})

// 폼은 Rendering Mode에 따라 요청이 가는 곳(static-export는 브라우저가 백엔드를 직접 부른다)이 다르므로 static-export Starter에서도
// 생성한 테스트가 통과하는지 본다.
describe('static-export Starter', () => {
  const starter = useStarter({
    prefix: 'dcgen-g-form-static-',
    renderingMode: 'static-export',
    install: true,
  })

  beforeAll(() => {
    addOperations(starter, HARNESS_OPERATIONS)
  })

  test('form Schematic이 만든 코드로 Starter의 검사가 모두 통과한다', () => {
    expectGeneratedFormsToPassStarterChecks(starter)
  })
})

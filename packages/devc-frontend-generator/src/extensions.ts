import { writeFile } from 'node:fs/promises'
import { join, posix } from 'node:path'
import { Project } from 'ts-morph'
import { formatForStarter } from './format.js'
import { isRecord } from './manifest.js'
import { exists, type Overlay, OverlayError, readOptionalFile } from './overlay.js'
import type { RenderingMode } from './rendering-mode.js'
import { isIdentifier } from './schematics/names.js'

// 확장 지점: 여러 Recipe가 같은 Base 파일(루트 레이아웃, proxy, next.config, instrumentation, 서버가 백엔드로 보내는 요청,
// MSW 핸들러 목록)이나 sitemap의 규칙에 끼어들어야 하는 곳.
// Recipe는 그 파일을 패치하지 않고 자기 모듈을 overlay 최상위의 extensions.json에 선언한다. Generator는 모든 overlay를
// 덧입힌 뒤 Base와 Rendering Mode, Recipe의 선언을 모아 지점마다 조립 파일 하나를 만든다(docs/recipes.md의 "확장 지점").

/** 확장 지점의 선언 파일. overlay와 Base의 최상위에 두고, Starter에는 덧입히지 않는다. */
export const EXTENSIONS_MANIFEST = 'extensions.json'

export const EXTENSION_POINTS = [
  'providers',
  'header',
  'proxy',
  'nextConfig',
  'instrumentation',
  'instrumentationClient',
  'backendFetch',
  'mockHandlers',
  'sitemap',
] as const

export type ExtensionPoint = (typeof EXTENSION_POINTS)[number]

/** 확장 지점에 더하는 조각 하나: Starter의 모듈 파일 하나가 내보내는 값 하나 */
export interface ExtensionPiece {
  point: ExtensionPoint
  /** Starter 최상위 기준의 모듈 파일(예: src/shared/theme/theme-provider.tsx) */
  path: string
  /** 그 모듈이 내보내는 이름. 조립 파일이 이 이름으로 import한다. */
  export: string
  /** 같은 지점의 조각 사이의 순서. 작은 것이 먼저(바깥, 앞)다. */
  order: number
  /** 선언한 곳. 오류 메시지에 쓴다(예: 'Recipe dark-mode'). */
  label: string
}

const PIECE_KEYS = ['path', 'export', 'order']

/** overlay 최상위의 extensions.json을 읽어 조각을 돌려준다. 없으면 빈 배열이다. 선언이 잘못되었으면 OverlayError를 던진다. */
export async function readExtensions({ dir, label }: Overlay): Promise<ExtensionPiece[]> {
  const text = await readOptionalFile(join(dir, EXTENSIONS_MANIFEST))
  if (text === undefined) return []
  const fail = (problem: string) => new OverlayError(`${label}: ${EXTENSIONS_MANIFEST} ${problem}`)

  let manifest: unknown
  try {
    manifest = JSON.parse(text)
  } catch (error) {
    throw fail(`를 읽지 못했습니다(${String(error)}).`)
  }
  if (!isRecord(manifest)) throw fail('의 최상위는 객체여야 합니다.')
  const unknownPoints = Object.keys(manifest).filter((key) => !isExtensionPoint(key))
  if (unknownPoints.length > 0) {
    throw fail(`에 알 수 없는 확장 지점이 있습니다: ${unknownPoints.join(', ')}. 확장 지점: ${EXTENSION_POINTS.join(', ')}`)
  }

  return EXTENSION_POINTS.flatMap((point) => {
    const pieces = manifest[point]
    if (pieces === undefined) return []
    if (!Array.isArray(pieces)) throw fail(`의 ${point}는 배열이어야 합니다.`)
    return pieces.map((piece: unknown, index): ExtensionPiece => {
      const where = `${point}[${String(index)}]`
      if (!isRecord(piece)) throw fail(`의 ${where}는 { path, export, order } 객체여야 합니다.`)
      const unknownKeys = Object.keys(piece).filter((key) => !PIECE_KEYS.includes(key))
      if (unknownKeys.length > 0) throw fail(`의 ${where}에 알 수 없는 항목이 있습니다: ${unknownKeys.join(', ')}`)
      const { path, export: name, order } = piece
      if (typeof path !== 'string' || !/^[\w@.-]+(?:\/[\w@.[\]()-]+)*\.tsx?$/.test(path) || path.split('/').includes('..')) {
        throw fail(`의 ${where}.path는 Starter 최상위 기준의 .ts·.tsx 파일 경로여야 합니다(예: src/shared/<이름>/<파일>.ts).`)
      }
      if (typeof name !== 'string' || !isIdentifier(name)) {
        throw fail(`의 ${where}.export는 모듈이 내보내는 이름이어야 합니다.`)
      }
      if (typeof order !== 'number' || !Number.isInteger(order)) throw fail(`의 ${where}.order는 정수여야 합니다.`)
      return { point, path, export: name, order, label }
    })
  })
}

/** 조립 파일이 받는 조각: 지점마다 order가 작은 순으로, order가 같으면 덧입힌 순서대로 늘어놓은 조각 */
type PiecesAt<P extends ExtensionPoint = ExtensionPoint> = Readonly<Record<P, readonly ExtensionPiece[]>>

/** 조립 파일을 만들지 정할 때 보는 Starter */
interface StarterState {
  renderingMode: RenderingMode
  /** Starter에 sitemap(SITEMAP_ROUTE)이 있다. */
  hasSitemap: boolean
}

/** 확장 지점의 조립 파일 하나. 조립 파일에 대한 것은 모두 여기에 둔다. */
export interface AssembledFile<P extends ExtensionPoint = ExtensionPoint> {
  /** Starter 최상위 기준 경로 */
  path: string
  /** 이 파일에 모이는 확장 지점 */
  points: readonly P[]
  /** 조각보다 앞에 두는 import 문. 조각의 import는 Generator가 이 뒤에 붙인다. */
  imports?: readonly string[]
  /** 이 Starter에 만드는지. 없으면 늘 만든다. */
  when?: (pieces: PiecesAt<P>, starter: StarterState) => boolean
  /** import 문과 생성 안내 뒤에 오는 내용(줄의 배열). 조각이 없어도 만들 수 있어야 한다(reservedNames). */
  render: (pieces: PiecesAt<P>) => string[]
}

// render가 points에 없는 지점의 조각을 읽지 못하게 지점마다 타입을 좁힌다.
function assembledFile<const P extends ExtensionPoint>(file: AssembledFile<P>): AssembledFile {
  return file
}

const GENERATED_NOTICE =
  '// Starter를 만들 때 Generator가 Base와 Recipe가 더한 조각을 모아 만든 파일이다. 이제는 이 프로젝트의 코드이므로 직접 고친다.'

/** sitemap 규칙(src/app/sitemap-rules.ts)을 쓰는 Next.js의 sitemap. Starter에 이 파일이 있을 때만 규칙을 조립한다. */
export const SITEMAP_ROUTE = 'src/app/sitemap.ts'

/**
 * 확장 지점을 모아 만드는 조립 파일. 조각의 모양은 조립 파일의 타입이 정하므로 Starter의 typecheck가 검사한다.
 *
 * - src/app/app-shell.tsx: 루트 레이아웃이 쓰므로 늘 만든다.
 * - config/next.config.plugins.ts: next.config.ts가 쓰므로 늘 만든다.
 * - src/shared/api/backend-fetch.ts: Base의 apiFetch와 BFF 프록시가 쓰므로 늘 만든다.
 * - src/shared/mocks/handlers.ts: Base의 MSW(node.ts, Rendering Mode static-export의 browser.ts)가 쓰므로 늘 만든다.
 * - src/instrumentation.ts, src/instrumentation-client.ts: 조각이 있을 때만 만든다.
 * - src/proxy.ts: 조각이 있고 요청을 받는 서버가 있는(server) Starter에만 만든다. static-export에는 proxy가 없다.
 * - src/app/sitemap-rules.ts: Starter에 sitemap(SITEMAP_ROUTE, 예: seo Recipe)이 있을 때만 만든다. sitemap과 robots.txt가 쓰므로
 *   조각이 없어도 만들고, sitemap이 없으면 조각이 있어도 쓸 곳이 없어 만들지 않는다.
 */
export const ASSEMBLED_FILES: readonly AssembledFile[] = [
  assembledFile({
    path: 'src/app/app-shell.tsx',
    points: ['providers', 'header'],
    imports: ["import type { ReactNode } from 'react'"],
    render: ({ providers, header }) => {
      const headerElement =
        header.length === 0
          ? []
          : ['<header className="flex justify-end gap-4 p-4">', ...header.map((piece) => `<${piece.export} />`), '</header>']
      const body = [...headerElement, '{children}']
      // Provider가 없을 때만 머리글과 children을 Fragment로 묶는다.
      const tree = providers.reduceRight(
        (inner, piece) => [`<${piece.export}>`, ...inner, `</${piece.export}>`],
        providers.length === 0 && body.length > 1 ? ['<>', ...body, '</>'] : body,
      )
      return [
        '// Provider는 위에 적힌 것이 바깥을 감싸고, 머리글 항목은 위에 적힌 것이 앞에 놓인다.',
        '',
        '/** 루트 레이아웃(src/app/layout.tsx)이 모든 페이지를 감싸는 껍데기: 앱 전체의 Provider와 모든 페이지 위의 머리글 */',
        'export function AppShell({ children }: Readonly<{ children: ReactNode }>) {',
        `  return (${tree.join('\n')})`,
        '}',
      ]
    },
  }),
  assembledFile({
    path: 'config/next.config.plugins.ts',
    points: ['nextConfig'],
    imports: ["import type { NextConfig } from 'next'"],
    render: ({ nextConfig }) => [
      '// next.config.ts의 설정을 감싸는 래퍼(예: next-intl, Sentry의 플러그인). Provider처럼 위에 적힌 래퍼가 바깥을 감싼다.',
      '// 그래서 아래의 래퍼부터 차례로 씌운다.',
      'const plugins: readonly ((config: NextConfig) => NextConfig)[] = [',
      ...nextConfig.map((piece) => `${piece.export},`),
      ']',
      '',
      '/** next.config.ts가 설정을 내보내기 전에 래퍼를 씌운다. */',
      'export function withPlugins(config: NextConfig): NextConfig {',
      '  return plugins.reduceRight((wrapped, plugin) => plugin(wrapped), config)',
      '}',
    ],
  }),
  assembledFile({
    path: 'src/instrumentation.ts',
    points: ['instrumentation'],
    imports: ["import type { Instrumentation } from 'next'"],
    when: ({ instrumentation }) => instrumentation.length > 0,
    render: ({ instrumentation }) => [
      '// Next.js 서버가 뜰 때(register)와 서버가 요청을 처리하다 오류가 났을 때(onRequestError) 조각을 위에서부터 차례로 실행한다.',
      '// next build에서는 실행되지 않으므로, 빌드할 때도 필요한 준비(예: 목 빌드의 MSW)는 그 코드를 쓰는 곳에서 한다.',
      'interface InstrumentationPiece {',
      '  /** 서버 런타임(nodejs, edge)마다 한 번 실행된다. Node.js 전용 코드는 process.env.NEXT_RUNTIME을 확인한 뒤 동적 import로 불러온다. */',
      '  register?: () => void | Promise<void>',
      '  onRequestError?: Instrumentation.onRequestError',
      '}',
      '',
      `const pieces: readonly InstrumentationPiece[] = [${pieceNames(instrumentation)}]`,
      '',
      'export async function register() {',
      '  for (const piece of pieces) await piece.register?.()',
      '}',
      '',
      'export const onRequestError: Instrumentation.onRequestError = async (...args) => {',
      '  for (const piece of pieces) await piece.onRequestError?.(...args)',
      '}',
    ],
  }),
  assembledFile({
    path: 'src/instrumentation-client.ts',
    points: ['instrumentationClient'],
    imports: ["import type { RouterTransitionType } from 'next'"],
    when: ({ instrumentationClient }) => instrumentationClient.length > 0,
    render: ({ instrumentationClient }) => [
      '// 브라우저에서 앱 코드보다 먼저 한 번(register), App Router가 다른 페이지로 옮겨 가기 시작할 때마다(onRouterTransitionStart)',
      '// 조각을 위에서부터 차례로 실행한다.',
      'interface ClientInstrumentationPiece {',
      '  register?: () => void',
      '  onRouterTransitionStart?: (url: string, navigationType: RouterTransitionType) => void',
      '}',
      '',
      `const pieces: readonly ClientInstrumentationPiece[] = [${pieceNames(instrumentationClient)}]`,
      '',
      'for (const piece of pieces) piece.register?.()',
      '',
      'export function onRouterTransitionStart(url: string, navigationType: RouterTransitionType) {',
      '  for (const piece of pieces) piece.onRouterTransitionStart?.(url, navigationType)',
      '}',
    ],
  }),
  assembledFile({
    path: 'src/proxy.ts',
    points: ['proxy'],
    imports: ["import { type NextRequest, NextResponse } from 'next/server'"],
    when: ({ proxy }, { renderingMode }) => renderingMode === 'server' && proxy.length > 0,
    render: ({ proxy }) => [
      '// 페이지 요청이 라우트에 닿기 전에 처리기를 위에서부터 차례로 실행한다(Next.js Proxy). 처리기는 응답을 직접 돌려주어',
      '// 요청을 끝내거나(뒤의 처리기와 라우트는 실행되지 않는다), next()로 다음 처리기에 넘긴 뒤 받은 응답을 고쳐 돌려준다.',
      '// next(request)로 헤더·쿠키를 고친 요청을 넘기면 뒤의 처리기와 라우트가 그 요청을 받는다.',
      'type ProxyHandler = (',
      '  request: NextRequest,',
      '  next: (request?: NextRequest) => Promise<NextResponse>,',
      ') => NextResponse | Promise<NextResponse>',
      '',
      `const handlers: readonly ProxyHandler[] = [${pieceNames(proxy)}]`,
      '',
      'export function proxy(request: NextRequest): Promise<NextResponse> {',
      '  const run = (index: number, current: NextRequest): Promise<NextResponse> => {',
      '    const handler = handlers[index]',
      '    if (handler !== undefined) return Promise.resolve(handler(current, (next = current) => run(index + 1, next)))',
      '    // 처리기가 고친 요청의 헤더(쿠키 포함)를 라우트에 넘긴다.',
      '    return Promise.resolve(',
      '      current === request ? NextResponse.next() : NextResponse.next({ request: { headers: current.headers } }),',
      '    )',
      '  }',
      '  return run(0, request)',
      '}',
      '',
      'export const config = {',
      '  // API 라우트(/api), Next.js가 내주는 파일(/_next), 확장자가 있는 파일(public의 파일 등)에는 실행하지 않는다.',
      "  matcher: ['/((?!api|_next|.*\\\\..*).*)'],",
      '}',
    ],
  }),
  assembledFile({
    path: 'src/shared/api/backend-fetch.ts',
    points: ['backendFetch'],
    // 서버에서만 실행한다. 처리기가 쿠키를 다루므로 클라이언트 컴포넌트가 import하면 next build가 실패하게 한다.
    imports: ["import 'server-only'"],
    render: ({ backendFetch }) => [
      '// 서버가 백엔드로 보내는 요청(서버에서 부른 apiFetch, BFF 프록시가 전달하는 브라우저의 요청)을 처리기에 위에서부터 차례로',
      '// 통과시킨 뒤 fetch로 보낸다. 처리기는 요청을 고쳐 next로 넘기고(예: 토큰 첨부), 받은 응답을 고치거나 요청을 다시 보내',
      '// 돌려준다(예: 401이면 토큰을 새로 받아 다시 보냄). 응답은 아래의 처리기부터 거꾸로 거쳐 돌아온다.',
      'type BackendFetchHandler = (',
      '  url: string,',
      '  init: RequestInit,',
      '  next: (url: string, init: RequestInit) => Promise<Response>,',
      ') => Promise<Response>',
      '',
      `const handlers: readonly BackendFetchHandler[] = [${pieceNames(backendFetch)}]`,
      '',
      '/** 서버에서 백엔드로 요청을 보낸다. fetch와 같은 인자를 받는다(src/shared/api/api-fetch.server.ts, bff-proxy.ts가 쓴다). */',
      'export function backendFetch(url: string, init: RequestInit = {}): Promise<Response> {',
      '  const run = (index: number, currentUrl: string, currentInit: RequestInit): Promise<Response> => {',
      '    const handler = handlers[index]',
      '    if (handler === undefined) return fetch(currentUrl, currentInit)',
      '    return handler(currentUrl, currentInit, (nextUrl, nextInit) => run(index + 1, nextUrl, nextInit))',
      '  }',
      '  return run(0, url, init)',
      '}',
    ],
  }),
  assembledFile({
    path: 'src/shared/mocks/handlers.ts',
    points: ['mockHandlers'],
    imports: ["import * as generatedMocks from '@/shared/api/generated/index.msw'"],
    render: ({ mockHandlers }) => {
      const generated = 'Object.values(generatedMocks).flatMap((getMockHandlers) => getMockHandlers())'
      return [
        '// MSW가 가로챌 요청과 돌려줄 응답의 목록. Vitest, Playwright, 개발 서버, 목 빌드가 모두 이 목록을 쓴다. 핸들러는 목 백엔드',
        '// 주소(src/shared/api/base-url.ts의 MOCK_API_BASE_URL)로 가는 요청만 받아 앱의 페이지 주소와 겹치지 않는다.',
        '// openapi.yaml에서 생성한 핸들러(src/shared/api/generated/<tag>/<tag>.msw.ts)를 모두 담으므로 명세가 바뀌어도',
        '// 고칠 필요가 없다. 응답은 명세의 example이고, example이 없으면 faker가 스키마에 맞춰 만든다.',
        ...(mockHandlers.length === 0
          ? []
          : [
              '// Base와 Recipe가 직접 만든 핸들러(예: 페이지 탐색 요청 거르기, 파라미터대로 거르는 목록, 발급한 토큰을 기억하는 인증)는',
              '// 생성된 핸들러보다 앞에 둔다. MSW는 앞의 핸들러가 먼저 응답하므로, 같은 요청이면 생성된 핸들러 대신 이 핸들러가 받는다.',
            ]),
        '// 테스트 하나에서만 응답을 바꾸려면 server.use(...)를 쓴다(README의 "API 목킹").',
        mockHandlers.length === 0
          ? `export const handlers = ${generated}`
          : `export const handlers = [${mockHandlers.map((piece) => `...${piece.export}, `).join('')}...${generated}]`,
      ]
    },
  }),
  assembledFile({
    path: 'src/app/sitemap-rules.ts',
    points: ['sitemap'],
    when: (_, { hasSitemap }) => hasSitemap,
    render: ({ sitemap }) => [
      '// sitemap(src/app/sitemap.ts)과 robots.txt(src/app/robots.ts)가 따르는 규칙. 페이지를 더한 Recipe가 자기 페이지를 어떻게',
      '// 알릴지 정한다(예: 로그인해야 들어가는 페이지는 검색 엔진에 알리지 않고, locale을 받는 페이지는 locale마다 알린다).',
      '// 규칙은 모두 합쳐 쓰므로 순서는 결과를 바꾸지 않는다.',
      'export interface SitemapRules {',
      '  /** sitemap에 넣지 않을 주소. 그 아래 주소도 뺀다(`/`는 홈만 뺀다). robots.txt는 막지 않으므로, 검색 결과에서 빼려면 페이지의 metadata에 robots: { index: false }를 적는다. */',
      '  exclude?: readonly string[]',
      '  /** robots.txt가 검색 엔진에 막을 주소. 그 아래 주소도 막고, sitemap에도 넣지 않는다. */',
      '  disallow?: readonly string[]',
      '  /**',
      '   * locale을 값으로 받는 동적 세그먼트의 이름(`[locale]`이면 locale)과 그 값. 그 아래 페이지를 locale마다 넣고 서로를 언어별 주소(hreflang)로',
      '   * 알린다. defaultValue가 있으면 그 값의 주소를 지원하지 않는 언어의 사용자에게 보일 주소(hreflang="x-default")로도 알린다.',
      '   */',
      '  locales?: { param: string; values: readonly string[]; defaultValue?: string }',
      '}',
      '',
      `export const sitemapRules: readonly SitemapRules[] = [${pieceNames(sitemap)}]`,
    ],
  }),
]

/**
 * 조각을 Starter에 쓰기 전에 검사한다. 한 조립 파일에서 두 조각이 같은 이름을 내보내거나(같은 모듈의 같은 값을 다른
 * 지점에 쓰는 것은 된다), 조립 파일이 스스로 쓰는 이름(reservedNames)을 내보내면 OverlayError를 던진다.
 */
export function checkExtensions(pieces: readonly ExtensionPiece[]): void {
  for (const file of ASSEMBLED_FILES) {
    const reserved = reservedNames(file)
    const seen = new Map<string, ExtensionPiece>()
    for (const piece of pieces.filter(({ point }) => file.points.includes(point))) {
      const where = `${piece.label}: ${EXTENSIONS_MANIFEST}의 ${piece.point}에 적힌 이름 ${piece.export}`
      if (reserved.includes(piece.export)) {
        throw new OverlayError(`${where}는 ${file.path}가 쓰는 이름이라 쓸 수 없습니다. 내보내는 이름을 바꾸세요.`)
      }
      const previous = seen.get(piece.export)
      if (previous !== undefined && (previous.path !== piece.path || previous.point === piece.point)) {
        throw new OverlayError(
          `${where}가 ${previous.label}의 조각과 겹쳐 ${file.path}에서 함께 쓸 수 없습니다. 내보내는 이름을 바꾸세요.`,
        )
      }
      seen.set(piece.export, piece)
    }
  }
}

/**
 * 조각을 모아 확장 지점의 조립 파일(ASSEMBLED_FILES)을 Starter에 쓴다. pieces는 checkExtensions로 검사한 것으로, 덧입힌
 * 순서(Base, Rendering Mode, Recipe)대로다. 지점마다 order가 작은 순으로, order가 같으면 덧입힌 순서대로 놓는다.
 * 선언한 모듈 파일이 Starter에 없거나, overlay가 조립 파일을 직접 담았으면 OverlayError를 던진다.
 */
export async function writeExtensionFiles(
  target: string,
  pieces: readonly ExtensionPiece[],
  renderingMode: RenderingMode,
): Promise<void> {
  for (const piece of pieces) {
    if (!(await exists(join(target, piece.path)))) {
      throw new OverlayError(`${piece.label}: ${EXTENSIONS_MANIFEST}의 ${piece.point}에 적힌 ${piece.path}가 Starter에 없습니다.`)
    }
  }
  for (const { path } of ASSEMBLED_FILES) {
    if (await exists(join(target, path))) {
      throw new OverlayError(
        `${path}는 Generator가 확장 지점의 조각으로 조립하는 파일이라 overlay가 담거나 패치할 수 없습니다. ` +
          `${EXTENSIONS_MANIFEST}에 조각을 선언하세요(docs/recipes.md의 "확장 지점").`,
      )
    }
  }
  const ordered = piecesAt(pieces)
  const starter: StarterState = { renderingMode, hasSitemap: await exists(join(target, SITEMAP_ROUTE)) }
  for (const file of ASSEMBLED_FILES) {
    if (file.when?.(ordered, starter) === false) continue
    const path = join(target, file.path)
    await writeFile(path, await formatForStarter(path, assemble(file, ordered)))
  }
}

/** 지점마다 조각을 order가 작은 순으로, order가 같으면 pieces의 순서(덧입힌 순서)대로 늘어놓는다. */
function piecesAt(pieces: readonly ExtensionPiece[]): PiecesAt {
  const ordered = pieces
    .map((piece, index) => ({ piece, index }))
    .sort((a, b) => a.piece.order - b.piece.order || a.index - b.index)
    .map(({ piece }) => piece)
  const byPoint = {} as Record<ExtensionPoint, ExtensionPiece[]>
  for (const point of EXTENSION_POINTS) byPoint[point] = ordered.filter((piece) => piece.point === point)
  return byPoint
}

/** 조립 파일의 내용: 조립 파일의 import, 조각의 import, 생성 안내, 그 뒤의 내용 */
function assemble(file: AssembledFile, pieces: PiecesAt): string {
  return [
    ...(file.imports ?? []),
    ...imports(file.path, file.points.flatMap((point) => pieces[point])),
    '',
    GENERATED_NOTICE,
    ...file.render(pieces),
  ].join('\n')
}

/**
 * 조립 파일이 스스로 쓰는 이름: 조각 없이 만든 내용이 최상위에서 import하거나 선언하는 이름. 조각을 같은 이름으로 import하면
 * 겹치므로 조각은 이 이름을 내보낼 수 없다. 조립 파일의 내용에서 읽으므로 내용을 고쳐도 따로 맞출 목록이 없다.
 */
function reservedNames(file: AssembledFile): string[] {
  const source = new Project({ useInMemoryFileSystem: true }).createSourceFile(file.path, assemble(file, piecesAt([])))
  const imported = source
    .getImportDeclarations()
    .flatMap((declaration) => [
      declaration.getDefaultImport(),
      declaration.getNamespaceImport(),
      ...declaration.getNamedImports().map((specifier) => specifier.getAliasNode() ?? specifier.getNameNode()),
    ])
    .flatMap((name) => (name === undefined ? [] : [name.getText()]))
  const declared = [
    ...source.getFunctions(),
    ...source.getInterfaces(),
    ...source.getTypeAliases(),
    ...source.getVariableDeclarations(),
  ].flatMap((declaration) => declaration.getName() ?? [])
  return [...imported, ...declared]
}

/** 조립 파일의 배열에 늘어놓을 조각의 이름 */
function pieceNames(pieces: readonly ExtensionPiece[]): string {
  return pieces.map((piece) => piece.export).join(', ')
}

/**
 * 조립 파일(file)에서 조각의 모듈을 가져오는 import 문. src 아래의 모듈은 `@/` 경로로, 그 밖은 상대 경로로 가져온다.
 * 같은 모듈의 이름은 한 문장으로 묶고, 모듈 경로 순으로 늘어놓는다. 이름이 겹치지 않는 것은 checkExtensions가 확인했다.
 */
function imports(file: string, pieces: readonly ExtensionPiece[]): string[] {
  const byModule = new Map<string, Set<string>>()
  for (const piece of pieces) {
    const specifier = moduleSpecifier(file, piece.path)
    byModule.set(specifier, (byModule.get(specifier) ?? new Set()).add(piece.export))
  }
  return [...byModule]
    .sort(([a], [b]) => a.localeCompare(b, 'en'))
    .map(([specifier, names]) => `import { ${[...names].sort().join(', ')} } from '${specifier}'`)
}

function moduleSpecifier(file: string, modulePath: string): string {
  const withoutExtension = modulePath.replace(/\.tsx?$/, '')
  if (file.startsWith('src/') && withoutExtension.startsWith('src/')) return `@/${withoutExtension.slice('src/'.length)}`
  const relative = posix.relative(posix.dirname(file), withoutExtension)
  return relative.startsWith('.') ? relative : `./${relative}`
}

function isExtensionPoint(value: string): value is ExtensionPoint {
  return EXTENSION_POINTS.some((point) => point === value)
}

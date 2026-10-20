import { writeFile } from 'node:fs/promises'
import { join, posix } from 'node:path'
import { formatForStarter } from './format.js'
import { exists, type Overlay, OverlayError, readOptionalFile } from './overlay.js'
import type { RenderingMode } from './rendering-mode.js'

// 확장 지점: 여러 Recipe가 같은 Base 파일(루트 레이아웃, proxy, next.config, instrumentation, 서버가 백엔드로 보내는 요청)에
// 끼어들어야 하는 곳.
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
      if (typeof name !== 'string' || !/^[A-Za-z_$][\w$]*$/.test(name)) {
        throw fail(`의 ${where}.export는 모듈이 내보내는 이름이어야 합니다.`)
      }
      if (typeof order !== 'number' || !Number.isInteger(order)) throw fail(`의 ${where}.order는 정수여야 합니다.`)
      return { point, path, export: name, order, label }
    })
  })
}

/**
 * 확장 지점을 모아 만드는 조립 파일(Starter 최상위 기준 경로)과 그 파일에 모이는 지점, 그 파일이 스스로 쓰는 이름.
 * 조각이 같은 이름을 내보내면 조립 파일에서 이름이 겹치므로 받지 않는다.
 *
 * - src/app/app-shell.tsx: 루트 레이아웃이 쓰므로 늘 만든다.
 * - next.config.plugins.ts: next.config.ts가 쓰므로 늘 만든다.
 * - src/shared/api/backend-fetch.ts: Base의 apiFetch와 BFF 프록시가 쓰므로 늘 만든다.
 * - src/instrumentation.ts, src/instrumentation-client.ts: 조각이 있을 때만 만든다.
 * - src/proxy.ts: 조각이 있고 요청을 받는 서버가 있는(server) Starter에만 만든다. static-export에는 proxy가 없다.
 */
export const ASSEMBLED_FILES: readonly { path: string; points: readonly ExtensionPoint[]; reserved: readonly string[] }[] =
  [
    { path: 'src/app/app-shell.tsx', points: ['providers', 'header'], reserved: ['AppShell', 'ReactNode'] },
    { path: 'next.config.plugins.ts', points: ['nextConfig'], reserved: ['NextConfig', 'plugins', 'withPlugins'] },
    {
      path: 'src/instrumentation.ts',
      points: ['instrumentation'],
      reserved: ['Instrumentation', 'InstrumentationHook', 'hooks', 'register', 'onRequestError'],
    },
    {
      path: 'src/instrumentation-client.ts',
      points: ['instrumentationClient'],
      reserved: ['RouterTransitionType', 'ClientInstrumentationHook', 'hooks', 'onRouterTransitionStart'],
    },
    {
      path: 'src/proxy.ts',
      points: ['proxy'],
      reserved: ['NextRequest', 'NextResponse', 'ProxyHandler', 'handlers', 'proxy', 'config'],
    },
    {
      path: 'src/shared/api/backend-fetch.ts',
      points: ['backendFetch'],
      reserved: ['BackendFetchHandler', 'handlers', 'backendFetch'],
    },
  ]

/**
 * 조각을 Starter에 쓰기 전에 검사한다. 한 조립 파일에서 두 조각이 같은 이름을 내보내거나(같은 모듈의 같은 값을 다른
 * 지점에 쓰는 것은 된다), 조립 파일이 스스로 쓰는 이름을 내보내면 OverlayError를 던진다.
 */
export function checkExtensions(pieces: readonly ExtensionPiece[]): void {
  for (const file of ASSEMBLED_FILES) {
    const seen = new Map<string, ExtensionPiece>()
    for (const piece of pieces.filter(({ point }) => file.points.includes(point))) {
      const where = `${piece.label}: ${EXTENSIONS_MANIFEST}의 ${piece.point}에 적힌 이름 ${piece.export}`
      if (file.reserved.includes(piece.export)) {
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
  const at = (point: ExtensionPoint) =>
    pieces
      .map((piece, index) => ({ piece, index }))
      .filter(({ piece }) => piece.point === point)
      .sort((a, b) => a.piece.order - b.piece.order || a.index - b.index)
      .map(({ piece }) => piece)

  const files = [
    appShell(at('providers'), at('header')),
    nextConfigPlugins(at('nextConfig')),
    instrumentation(at('instrumentation')),
    instrumentationClient(at('instrumentationClient')),
    renderingMode === 'server' ? proxy(at('proxy')) : undefined,
    backendFetch(at('backendFetch')),
  ]
  for (const file of files) {
    if (file === undefined) continue
    const path = join(target, file.path)
    await writeFile(path, await formatForStarter(path, file.content))
  }
}

interface GeneratedFile {
  /** Starter 최상위 기준 경로 */
  path: string
  content: string
}

const GENERATED_NOTICE =
  '// Starter를 만들 때 Generator가 Base와 Recipe가 더한 조각을 모아 만든 파일이다. 이제는 이 프로젝트의 코드이므로 직접 고친다.'

function appShell(providers: readonly ExtensionPiece[], header: readonly ExtensionPiece[]): GeneratedFile {
  const path = 'src/app/app-shell.tsx'
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
  return {
    path,
    content: [
      "import type { ReactNode } from 'react'",
      ...imports(path, [...providers, ...header]),
      '',
      GENERATED_NOTICE,
      '// Provider는 위에 적힌 것이 바깥을 감싸고, 머리글 항목은 위에 적힌 것이 앞에 놓인다.',
      '',
      '/** 루트 레이아웃(src/app/layout.tsx)이 모든 페이지를 감싸는 껍데기: 앱 전체의 Provider와 모든 페이지 위의 머리글 */',
      'export function AppShell({ children }: Readonly<{ children: ReactNode }>) {',
      `  return (${tree.join('\n')})`,
      '}',
    ].join('\n'),
  }
}

function nextConfigPlugins(pieces: readonly ExtensionPiece[]): GeneratedFile {
  const path = 'next.config.plugins.ts'
  return {
    path,
    content: [
      "import type { NextConfig } from 'next'",
      ...imports(path, pieces),
      '',
      GENERATED_NOTICE,
      '// next.config.ts의 설정을 감싸는 래퍼(예: next-intl, Sentry의 플러그인). Provider처럼 위에 적힌 래퍼가 바깥을 감싼다.',
      '// 그래서 아래의 래퍼부터 차례로 씌운다.',
      'const plugins: readonly ((config: NextConfig) => NextConfig)[] = [',
      ...pieces.map((piece) => `${piece.export},`),
      ']',
      '',
      '/** next.config.ts가 설정을 내보내기 전에 래퍼를 씌운다. */',
      'export function withPlugins(config: NextConfig): NextConfig {',
      '  return plugins.reduceRight((wrapped, plugin) => plugin(wrapped), config)',
      '}',
    ].join('\n'),
  }
}

function instrumentation(pieces: readonly ExtensionPiece[]): GeneratedFile | undefined {
  if (pieces.length === 0) return undefined
  const path = 'src/instrumentation.ts'
  return {
    path,
    content: [
      "import type { Instrumentation } from 'next'",
      ...imports(path, pieces),
      '',
      GENERATED_NOTICE,
      '// Next.js 서버가 뜰 때(register)와 서버가 요청을 처리하다 오류가 났을 때(onRequestError) 조각을 위에서부터 차례로 실행한다.',
      '// next build에서는 실행되지 않으므로, 빌드할 때도 필요한 준비(예: 목 빌드의 MSW)는 그 코드를 쓰는 곳에서 한다.',
      'interface InstrumentationHook {',
      '  /** 서버 런타임(nodejs, edge)마다 한 번 실행된다. Node.js 전용 코드는 process.env.NEXT_RUNTIME을 확인한 뒤 동적 import로 불러온다. */',
      '  register?: () => void | Promise<void>',
      '  onRequestError?: Instrumentation.onRequestError',
      '}',
      '',
      `const hooks: readonly InstrumentationHook[] = [${pieces.map((piece) => piece.export).join(', ')}]`,
      '',
      'export async function register() {',
      '  for (const hook of hooks) await hook.register?.()',
      '}',
      '',
      'export const onRequestError: Instrumentation.onRequestError = async (...args) => {',
      '  for (const hook of hooks) await hook.onRequestError?.(...args)',
      '}',
    ].join('\n'),
  }
}

function instrumentationClient(pieces: readonly ExtensionPiece[]): GeneratedFile | undefined {
  if (pieces.length === 0) return undefined
  const path = 'src/instrumentation-client.ts'
  return {
    path,
    content: [
      "import type { RouterTransitionType } from 'next'",
      ...imports(path, pieces),
      '',
      GENERATED_NOTICE,
      '// 브라우저에서 앱 코드보다 먼저 한 번(register), App Router가 다른 페이지로 옮겨 가기 시작할 때마다(onRouterTransitionStart)',
      '// 조각을 위에서부터 차례로 실행한다.',
      'interface ClientInstrumentationHook {',
      '  register?: () => void',
      '  onRouterTransitionStart?: (url: string, navigationType: RouterTransitionType) => void',
      '}',
      '',
      `const hooks: readonly ClientInstrumentationHook[] = [${pieces.map((piece) => piece.export).join(', ')}]`,
      '',
      'for (const hook of hooks) hook.register?.()',
      '',
      'export function onRouterTransitionStart(url: string, navigationType: RouterTransitionType) {',
      '  for (const hook of hooks) hook.onRouterTransitionStart?.(url, navigationType)',
      '}',
    ].join('\n'),
  }
}

function proxy(pieces: readonly ExtensionPiece[]): GeneratedFile | undefined {
  if (pieces.length === 0) return undefined
  const path = 'src/proxy.ts'
  return {
    path,
    content: [
      "import { type NextRequest, NextResponse } from 'next/server'",
      ...imports(path, pieces),
      '',
      GENERATED_NOTICE,
      '// 페이지 요청이 라우트에 닿기 전에 처리기를 위에서부터 차례로 실행한다(Next.js Proxy). 처리기는 응답을 직접 돌려주어',
      '// 요청을 끝내거나(뒤의 처리기와 라우트는 실행되지 않는다), next()로 다음 처리기에 넘긴 뒤 받은 응답을 고쳐 돌려준다.',
      '// next(request)로 헤더·쿠키를 고친 요청을 넘기면 뒤의 처리기와 라우트가 그 요청을 받는다.',
      'type ProxyHandler = (',
      '  request: NextRequest,',
      '  next: (request?: NextRequest) => Promise<NextResponse>,',
      ') => NextResponse | Promise<NextResponse>',
      '',
      `const handlers: readonly ProxyHandler[] = [${pieces.map((piece) => piece.export).join(', ')}]`,
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
    ].join('\n'),
  }
}

function backendFetch(pieces: readonly ExtensionPiece[]): GeneratedFile {
  const path = 'src/shared/api/backend-fetch.ts'
  return {
    path,
    content: [
      ...imports(path, pieces),
      '',
      GENERATED_NOTICE,
      '// 서버가 백엔드로 보내는 요청(서버에서 부른 apiFetch, BFF 프록시가 전달하는 브라우저의 요청)을 처리기에 위에서부터 차례로',
      '// 통과시킨 뒤 fetch로 보낸다. 처리기는 요청을 고쳐 next로 넘기고(예: 토큰 첨부), 받은 응답을 고치거나 요청을 다시 보내',
      '// 돌려준다(예: 401이면 토큰을 새로 받아 다시 보냄). 응답은 아래의 처리기부터 거꾸로 거쳐 돌아온다.',
      'type BackendFetchHandler = (',
      '  url: string,',
      '  init: RequestInit,',
      '  next: (url: string, init: RequestInit) => Promise<Response>,',
      ') => Promise<Response>',
      '',
      `const handlers: readonly BackendFetchHandler[] = [${pieces.map((piece) => piece.export).join(', ')}]`,
      '',
      '/** 서버에서 백엔드로 요청을 보낸다. fetch와 같은 인자를 받는다(src/shared/api/api-fetch.ts, bff-proxy.ts가 쓴다). */',
      'export function backendFetch(url: string, init: RequestInit = {}): Promise<Response> {',
      '  const run = (index: number, currentUrl: string, currentInit: RequestInit): Promise<Response> => {',
      '    const handler = handlers[index]',
      '    if (handler === undefined) return fetch(currentUrl, currentInit)',
      '    return handler(currentUrl, currentInit, (nextUrl, nextInit) => run(index + 1, nextUrl, nextInit))',
      '  }',
      '  return run(0, url, init)',
      '}',
    ].join('\n'),
  }
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

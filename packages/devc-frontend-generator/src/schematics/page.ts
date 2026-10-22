import type { OpenAPIV3 } from 'openapi-types'
import type { RenderingMode } from '../rendering-mode.js'
import { type Feature, FEATURES_DIR, featureNamed } from './feature.js'
import { formComponentOf, formPropsOf } from './form.js'
import { mutationHookName } from './mutation.js'
import { jsxText, kebabCase, pascalCase, propertyAccess, splitWords, upperFirst } from './names.js'
import { queryDomainOf, queryOptionsName } from './query-domain.js'
import {
  type ChangedFile,
  generatedNamesOf,
  hasDeclaration,
  hasExport,
  type Operation,
  PROP_SAMPLES,
  SchematicError,
  StarterProject,
  successSchema,
} from './starter-project.js'

const APP_DIR = 'src/app'

/** 라우트마다 고르는 Rendering Mode(GLOSSARY). server Starter 안의 선택이다. */
export const PAGE_MODES = ['ssr', 'ssg', 'isr', 'streaming', 'csr'] as const

export type PageMode = (typeof PAGE_MODES)[number]

/** 라우트의 Rendering Mode가 페이지를 언제, 어디서 렌더링하는지 */
interface ModeTraits {
  label: string
  /** 요청마다 서버에서 렌더링한다(connection()). */
  perRequest: boolean
  /** 빌드할 때 렌더링해 둔다(ISR은 그 뒤로 정한 시간마다 다시 렌더링한다). */
  prerendered: boolean
  /** --query의 데이터를 서버가 가져와 hydration으로 넘긴다. 아니면 브라우저가 가져온다. */
  serverData: boolean
  /**
   * static-export Starter에서 쓸 수 없는 이유. static-export에는 요청을 받는 Next.js 서버가 없으므로 빌드 결과(정적 파일)만으로
   * 동작하는 모드만 쓴다.
   */
  serverOnlyReason?: string
}

const MODES: Record<PageMode, ModeTraits> = {
  ssr: {
    label: 'SSR',
    perRequest: true,
    prerendered: false,
    serverData: true,
    serverOnlyReason: '요청마다 서버에서 렌더링해야 합니다.',
  },
  ssg: { label: 'SSG', perRequest: false, prerendered: true, serverData: true },
  isr: {
    label: 'ISR',
    perRequest: false,
    prerendered: true,
    serverData: true,
    serverOnlyReason: '정한 시간마다 서버에서 다시 렌더링해야 합니다.',
  },
  streaming: {
    label: '스트리밍',
    perRequest: true,
    prerendered: false,
    serverData: true,
    serverOnlyReason: '요청마다 서버가 응답을 이어 보내야 합니다.',
  },
  csr: { label: 'CSR', perRequest: false, prerendered: false, serverData: false },
}

// --mode를 주지 않았을 때의 모드. server Starter는 Base의 샘플(/products)처럼 요청마다 서버에서 렌더링하고,
// static-export Starter는 그 Rendering Mode의 샘플처럼 페이지 뼈대를 미리 만들고 데이터는 브라우저가 가져온다.
const DEFAULT_MODES: Record<RenderingMode, PageMode> = { server: 'ssr', 'static-export': 'csr' }

// ISR 페이지를 다시 렌더링하는 간격(초). 만든 뒤 화면에 맞게 고친다.
const ISR_REVALIDATE_SECONDS = 60

// 라우트의 세그먼트. 일반 세그먼트는 kebab-case, 동적 세그먼트는 [이름](이름은 영문자로 시작하는 식별자), 경로 그룹은 (이름)이다.
const STATIC_SEGMENT = /^[a-z\d]+(?:-[a-z\d]+)*$/
const DYNAMIC_SEGMENT = /^\[([A-Za-z][A-Za-z\d]*)\]$/
const GROUP_SEGMENT = /^\([a-z\d]+(?:-[a-z\d]+)*\)$/

// 목록의 항목에서 보여 줄 값과 React key로 쓸 값을 고르는 속성 이름(앞의 것부터)
const LABEL_PROPERTIES = ['name', 'title', 'label']
const KEY_PROPERTY = 'id'

const LOADING_MESSAGE = '불러오는 중입니다.'

export interface PageSchematicOptions {
  /** 라우트의 Rendering Mode. 없으면 Starter의 Rendering Mode에 맞는 기본값(DEFAULT_MODES)이다. */
  mode: string | undefined
  /** 데이터를 가져와 보여 줄 GET operation. 그 queryOptions(query Schematic)가 먼저 있어야 한다. */
  query: string | undefined
  /** 넣을 폼의 operation. 그 폼(form Schematic)이 먼저 있어야 한다. */
  form: string | undefined
  /** --query의 결과를 보여 줄 컴포넌트를 둘 Feature. --form의 폼이 여러 Feature에 있으면 고른다. */
  feature: string | undefined
}

/** 만든 페이지 */
export interface GeneratedPage {
  /** 브라우저 주소의 경로(예: /products/[productId]) */
  path: string
  mode: PageMode
  modeLabel: string
  /** --query의 결과를 보여 주는 컴포넌트. reused면 Feature에 있던 것을 그대로 썼다. */
  view: { name: string; path: string; reused: boolean } | undefined
  /** 빌드할 때 서버 컴포넌트가 백엔드에서 데이터를 가져오는가(SSG, ISR) */
  fetchesAtBuild: boolean
  changed: ChangedFile[]
}

/** 만들 라우트 */
interface Route {
  /** Starter 최상위 기준 폴더(src/app/<route>) */
  directory: string
  /** 브라우저 주소의 경로. 경로 그룹은 빠진다. */
  path: string
  /** 동적 세그먼트의 이름 */
  params: string[]
  /** 페이지, 로딩, 오류 컴포넌트 이름의 앞부분(PascalCase) */
  componentPrefix: string
}

/** 페이지가 경로의 동적 세그먼트에서 읽어 쿼리나 폼에 넘기는 값 */
interface PathArgument {
  name: string
  type: 'number' | 'string'
  /** 명세의 type이 integer다. 경로의 값이 정수가 아니면 없는 페이지로 본다. */
  integer: boolean
}

/** --query의 결과를 그리는 방법. 응답 본문의 스키마로 정한다. */
type ViewShape =
  | {
      kind: 'list'
      /** 항목의 React key로 쓸 속성. 없으면 순서(index)를 쓴다. */
      key: string | undefined
      /** 항목에서 보여 줄 문자열 속성. 없으면 항목이 스칼라면 그 값을, 아니면 JSON을 보여 준다. */
      label: string | undefined
      scalarItems: boolean
    }
  | { kind: 'object' }
  | { kind: 'value' }

/** --query의 결과를 보여 주는 Feature의 클라이언트 컴포넌트(<OperationId>View) */
interface View {
  name: string
  fileName: string
  feature: Feature
  /** Starter 최상위 기준, 확장자를 뺀 경로 */
  stem: string
  importPath: string
  /** Feature에 이미 있어 새로 만들지 않는다. */
  reused: boolean
  shape: ViewShape
}

interface PageQuery {
  operationId: string
  summary: string | undefined
  domainName: string
  optionsName: string
  optionsModule: string
  /** queryOptions에 넘기는 인자(경로 파라미터). 순서는 queryOptions와 같다. */
  args: PathArgument[]
  view: View
  /** 재생성 계층의 MSW 핸들러(get<OperationId>MockHandler)와 응답 목(get<OperationId>ResponseMock)의 모듈 */
  mocks: { handler: string; response: string | undefined; module: string }
  /** 생성한 테스트가 실패 응답을 줄 MSW 경로. 재생성 계층의 핸들러처럼 앞에 *를 붙이고 {productId}는 :productId로 바꾼다. */
  mockPath: string
}

interface PageForm {
  summary: string | undefined
  componentName: string
  importPath: string
  args: PathArgument[]
}

/** 생성할 페이지. 페이지, 로딩, 오류 파일과 --query의 컴포넌트·테스트의 소스를 이것으로 만든다. */
interface PageModel {
  route: Route
  mode: PageMode
  title: string
  query: PageQuery | undefined
  form: PageForm | undefined
  /** 페이지가 경로에서 읽어 쿼리나 폼에 넘기는 값 */
  args: PathArgument[]
}

/**
 * `page` Schematic. src/app/<route>에 페이지(메타데이터 포함), 로딩 상태(loading.tsx), 오류 상태(error.tsx)를 만들고
 * 라우트의 Rendering Mode(SSR, SSG, ISR, 스트리밍, CSR)를 고른다. --query는 query Schematic이 만든 queryOptions로 데이터를
 * 가져와(서버에서 렌더링하는 모드는 서버에서 prefetch해 hydration으로 넘기고, CSR은 브라우저가 가져온다) Feature의 컴포넌트로
 * 보여 주고, --form은 form Schematic이 만든 폼을 넣는다. 앞선 Schematic의 코드가 없거나, 고른 모드를 Starter의 Rendering Mode에서
 * 쓸 수 없거나, 같은 이름의 파일이 있으면 SchematicError를 던지고 아무 파일도 만들지 않는다.
 */
export async function generatePage(
  cwd: string,
  routeArgument: string,
  options: PageSchematicOptions,
): Promise<GeneratedPage> {
  const route = parseRoute(routeArgument)
  if (options.feature !== undefined && options.query === undefined && options.form === undefined) {
    throw new SchematicError(
      '--feature는 --query(결과를 보여 줄 컴포넌트를 둘 Feature)나 --form(폼이 있는 Feature)과 함께 씁니다.',
    )
  }
  const feature = options.feature === undefined ? undefined : featureNamed(options.feature)
  if (options.query !== undefined && feature === undefined) {
    throw new SchematicError(
      `--query의 결과를 보여 줄 컴포넌트를 둘 Feature를 고르세요: --feature <feature>(src/features/<feature>/).`,
    )
  }

  const starter = StarterProject.open(cwd)
  const mode = pageMode(starter.renderingMode(), options.mode, route)
  const query =
    options.query === undefined || feature === undefined
      ? undefined
      : await pageQuery(starter, options.query, feature, route)
  const form = options.form === undefined ? undefined : await pageForm(starter, options.form, feature, route)
  const args = [...(query?.args ?? []), ...(form?.args ?? [])].filter(
    (arg, index, all) => all.findIndex((other) => other.name === arg.name) === index,
  )
  const page: PageModel = {
    route,
    mode,
    title: query?.summary ?? form?.summary ?? route.path,
    query,
    form,
    args,
  }

  const routeStem = (name: string) => `${route.directory}/${name}`
  starter.newModules([
    { stem: routeStem('page'), source: pageSource(page) },
    { stem: routeStem('loading'), source: loadingSource(page) },
    { stem: routeStem('error'), source: errorSource(page) },
    ...(query === undefined || query.view.reused
      ? []
      : [
          { stem: query.view.stem, source: viewSource(query) },
          { stem: `${query.view.stem}.test`, source: viewTestSource(query) },
        ]),
  ])
  return {
    path: route.path,
    mode,
    modeLabel: MODES[mode].label,
    view:
      query === undefined
        ? undefined
        : { name: query.view.name, path: `${query.view.stem}.tsx`, reused: query.view.reused },
    fetchesAtBuild: fetchesAtBuild(page),
    changed: await starter.save(),
  }
}

/** 라우트 인자(products/new, /products/[productId]/ 등)를 세그먼트로 나눠 검사한다. */
function parseRoute(argument: string): Route {
  const segments = argument.split('/').filter((segment) => segment !== '')
  if (segments.length === 0) {
    throw new SchematicError('만들 라우트를 적으세요(예: products/new). 루트 페이지(src/app/page.tsx)는 Base에 있습니다.')
  }
  const invalid = segments.filter(
    (segment) => !STATIC_SEGMENT.test(segment) && !DYNAMIC_SEGMENT.test(segment) && !GROUP_SEGMENT.test(segment),
  )
  if (invalid.length > 0) {
    throw new SchematicError(
      `쓸 수 없는 라우트입니다: '${argument}'(${invalid.join(', ')}). 세그먼트는 kebab-case(products, order-items), 동적 세그먼트([productId]), 경로 그룹((admin))만 씁니다. catch-all([...slug])이나 병렬·가로채기 라우트는 직접 만드세요.`,
    )
  }
  const params = segments.flatMap((segment) => DYNAMIC_SEGMENT.exec(segment)?.[1] ?? [])
  const repeated = params.filter((param, index) => params.indexOf(param) !== index)
  if (repeated.length > 0) {
    throw new SchematicError(`라우트에 같은 이름의 동적 세그먼트가 여러 번 있습니다: [${repeated.join('], [')}].`)
  }
  const urlSegments = segments.filter((segment) => !GROUP_SEGMENT.test(segment))
  if (urlSegments.length === 0) {
    throw new SchematicError(
      `경로 그룹만 있는 라우트(${argument})는 루트 페이지(/, src/app/page.tsx)와 주소가 겹칩니다. 그룹 아래에 세그먼트를 더하세요.`,
    )
  }
  return {
    directory: `${APP_DIR}/${segments.join('/')}`,
    path: `/${urlSegments.join('/')}`,
    params,
    componentPrefix: pascalCase(urlSegments.flatMap((segment) => splitWords(segment))),
  }
}

/** --mode의 값을 검사하고, 없으면 Starter의 Rendering Mode에 맞는 기본값을 고른다. */
function pageMode(starterMode: RenderingMode, option: string | undefined, route: Route): PageMode {
  const mode = option ?? DEFAULT_MODES[starterMode]
  if (!isPageMode(mode)) {
    throw new SchematicError(`쓸 수 없는 Rendering Mode입니다: '${mode}'. ${PAGE_MODES.join(', ')} 가운데 하나를 고르세요.`)
  }
  if (starterMode !== 'static-export') return mode
  const { label, serverOnlyReason } = MODES[mode]
  if (serverOnlyReason !== undefined) {
    const allowed = PAGE_MODES.filter((candidate) => MODES[candidate].serverOnlyReason === undefined)
    throw new SchematicError(
      `static-export Starter에서는 ${label} 페이지를 만들 수 없습니다. ${serverOnlyReason} 요청을 받는 서버 없이 동작하는 ${allowed.join(', ')} 가운데 하나를 고르세요.`,
    )
  }
  if (route.params.length > 0) {
    throw new SchematicError(
      `static-export Starter에서는 동적 세그먼트([${route.params.join('], [')}])가 있는 라우트를 만들지 않습니다. 빌드할 때 만들 경로를 generateStaticParams로 모두 정해야 하므로 직접 작성하세요.`,
    )
  }
  return mode
}

function isPageMode(value: string): value is PageMode {
  return PAGE_MODES.some((mode) => mode === value)
}

/** --query의 operation과 그 queryOptions를 찾고, 결과를 보여 줄 컴포넌트를 정한다. */
async function pageQuery(
  starter: StarterProject,
  operationId: string,
  feature: Feature,
  route: Route,
): Promise<PageQuery> {
  const operation = await starter.findOperation(operationId)
  if (operation.method !== 'get') {
    throw new SchematicError(
      `--query에는 데이터를 가져올 GET operation을 지정합니다. ${operationId}는 ${operation.method.toUpperCase()} operation입니다.`,
    )
  }
  const domain = queryDomainOf(operation)
  const fetcher = starter.generatedFunction(operation)
  const optionsName = queryOptionsName(fetcher, 'query')
  const queries = starter.existingModule(domain.queriesPath)
  if (queries === undefined || !hasDeclaration(queries, optionsName)) {
    const infinite = queryOptionsName(fetcher, 'infinite')
    const onlyInfinite =
      queries !== undefined && hasDeclaration(queries, infinite)
        ? ` ${infinite}(npm run g -- query ${operationId} --infinite)는 끼워 넣지 않으니 페이지를 만든 뒤 직접 바꾸세요.`
        : ''
    throw new SchematicError(
      `${domain.queriesPath}에 ${optionsName}가 없습니다. 페이지는 이 queryOptions로 데이터를 가져오므로 먼저 npm run g -- query ${operationId}로 만드세요.${onlyInfinite}`,
    )
  }
  const pathCount = pathParameters(operation).length
  const required = fetcher.parameters.slice(pathCount).filter((parameter) => !parameter.optional)
  if (required.length > 0) {
    throw new SchematicError(
      `--query는 경로 파라미터 말고는 필수 인자가 없는 operation만 끼워 넣습니다. ${fetcher.name}의 ${required.map(({ name }) => name).join(', ')}는 필수 인자입니다. 페이지에서 값을 정해 넘기려면 직접 고치세요.`,
    )
  }
  const args = pathArguments('--query', operation, fetcher.parameters.slice(0, pathCount), route)

  const name = `${upperFirst(fetcher.name)}View`
  const fileName = `${kebabCase(splitWords(operationId))}-view`
  const stem = `${feature.directory}/${fileName}`
  const existing = starter.existingModule(`${stem}.tsx`)
  const { mockHandler: handler, responseMock: response } = generatedNamesOf(fetcher)
  const mockModule = starter.generatedModuleOf(handler)
  if (mockModule === undefined) {
    throw new SchematicError(
      `재생성 계층에 ${operationId}의 MSW 핸들러(${handler})가 없습니다. openapi.yaml을 고쳤다면 npm run api:gen으로 API 계층을 다시 만드세요.`,
    )
  }
  return {
    operationId,
    summary: summaryOf(operation),
    domainName: domain.name,
    optionsName,
    optionsModule: starter.importPath(domain.queriesPath),
    args,
    view: {
      name,
      fileName,
      feature,
      stem,
      importPath: starter.importPath(stem),
      // Feature에 같은 컴포넌트가 있으면(같은 쿼리를 보여 주는 다른 페이지가 만들었다) 새로 만들지 않고 쓴다.
      // 같은 파일에 그 컴포넌트가 없으면 손으로 쓴 코드일 수 있으므로 새로 만들려다 겹친다고 알린다.
      reused: existing !== undefined && hasExport(existing, name),
      shape: viewShape(successSchema(operation)),
    },
    mocks: {
      handler,
      response: starter.generatedModuleOf(response) === undefined ? undefined : response,
      module: mockModule,
    },
    mockPath: `*${operation.path.replace(/\{([^}]+)\}/g, ':$1')}`,
  }
}

/** --form의 폼을 Feature에서 찾는다. --feature가 있고 그 Feature에 폼이 있으면 그것을 쓴다. */
async function pageForm(
  starter: StarterProject,
  operationId: string,
  feature: Feature | undefined,
  route: Route,
): Promise<PageForm> {
  const operation = await starter.findOperation(operationId)
  const fetcher = starter.generatedFunction(operation)
  const { componentName, fileName } = formComponentOf(operationId, fetcher)
  const found = starter.subdirectories(FEATURES_DIR).filter((name) => {
    const module = starter.existingModule(`${FEATURES_DIR}/${name}/${fileName}.tsx`)
    return module !== undefined && hasExport(module, componentName)
  })
  const chosen = feature !== undefined && found.includes(feature.name) ? [feature.name] : found
  const [only] = chosen
  if (only === undefined) {
    throw new SchematicError(
      `src/features/*/${fileName}.tsx에 ${componentName}가 없습니다. 페이지에 넣을 폼을 먼저 npm run g -- form ${operationId} --feature <feature>로 만드세요.`,
    )
  }
  if (chosen.length > 1) {
    // --feature는 --query의 컴포넌트를 둘 곳이기도 하므로, 그 Feature에 폼이 없으면 어느 폼인지 고를 수 없다.
    const elsewhere =
      feature === undefined ? '' : ` --feature의 ${feature.name}에는 이 폼이 없습니다. 넣을 폼 하나만 남기거나 직접 고치세요.`
    throw new SchematicError(
      `${componentName}가 여러 Feature에 있습니다: ${chosen.join(', ')}. 페이지에 넣을 폼이 있는 Feature를 --feature로 고르세요.${elsewhere}`,
    )
  }
  const props = formPropsOf(starter, operation, fetcher)
  // 뮤테이션 훅에만 넘기는 props(--optimistic 훅이 응답 전에 고칠 쿼리의 인자)도 경로 파라미터처럼 동적 세그먼트에서 읽어 넘긴다.
  const missing = props.filter((prop) => prop.hookOnly && !route.params.includes(prop.name)).map(({ name }) => name)
  if (missing.length > 0) {
    throw new SchematicError(
      `${componentName}는 경로 파라미터 말고도 ${mutationHookName(fetcher)}에 넘길 인자(${missing.join(', ')})를 props로 받습니다. 페이지가 넘기려면 라우트에 같은 이름의 동적 세그먼트(${missing.map((name) => `[${name}]`).join(', ')})가 있어야 합니다. 값을 다른 곳에서 받는다면 --form 없이 페이지를 만들고 폼을 직접 넣으세요.`,
    )
  }
  return {
    summary: summaryOf(operation),
    componentName,
    importPath: starter.importPath(`${FEATURES_DIR}/${only}/${fileName}`),
    args: pathArguments('--form', operation, props, route),
  }
}

function pathParameters(operation: Operation): OpenAPIV3.ParameterObject[] {
  return operation.parameters.filter((parameter) => parameter.in === 'path')
}

/**
 * 쿼리나 폼이 받는 경로 파라미터를 라우트의 동적 세그먼트와 잇는다. 이름이 같은 동적 세그먼트가 있어야 하고,
 * 경로의 값(문자열)을 바꿔 넘길 수 있는 숫자·문자열 파라미터만 받는다.
 */
function pathArguments(
  option: '--query' | '--form',
  operation: Operation,
  parameters: readonly { name: string; type: string }[],
  route: Route,
): PathArgument[] {
  const missing = parameters.filter(({ name }) => !route.params.includes(name))
  if (missing.length > 0) {
    const example = operation.path
      .split('/')
      .filter((segment) => segment !== '')
      .map((segment) => segment.replace(/^\{(.+)\}$/, '[$1]'))
      .join('/')
    throw new SchematicError(
      `${option} ${operation.operationId}에는 경로 파라미터(${missing.map(({ name }) => name).join(', ')})가 있어, 라우트에 같은 이름의 동적 세그먼트(${missing.map(({ name }) => `[${name}]`).join(', ')})가 있어야 합니다(예: ${example}).`,
    )
  }
  return parameters.map(({ name, type }) => {
    if (type !== 'number' && type !== 'string') {
      throw new SchematicError(
        `${option} ${operation.operationId}의 경로 파라미터 ${name}(${type})는 라우트의 동적 세그먼트에서 받을 수 없습니다. 숫자·문자열 경로 파라미터만 받습니다.`,
      )
    }
    const schema = pathParameters(operation).find((parameter) => parameter.name === name)?.schema as
      | OpenAPIV3.SchemaObject
      | undefined
    return { name, type, integer: schema?.type === 'integer' }
  })
}

function summaryOf(operation: Operation): string | undefined {
  const summary = operation.definition.summary?.trim()
  return summary === '' ? undefined : summary
}

/** 응답 본문의 스키마로 결과를 그리는 방법을 정한다. 배열은 목록, 객체는 이름과 값의 목록, 그 밖은 값 그대로다. */
function viewShape(schema: OpenAPIV3.SchemaObject | undefined): ViewShape {
  if (schema?.type === 'array') {
    const items = schema.items as OpenAPIV3.SchemaObject
    const required = new Set(items.required ?? [])
    const properties = Object.entries(items.properties ?? {}) as [string, OpenAPIV3.SchemaObject][]
    const requiredOf = (types: readonly string[]) =>
      properties.filter(([name, property]) => required.has(name) && types.includes(String(property.type)))
    const strings = requiredOf(['string']).map(([name]) => name)
    return {
      kind: 'list',
      key: requiredOf(['integer', 'number', 'string']).some(([name]) => name === KEY_PROPERTY) ? KEY_PROPERTY : undefined,
      label: LABEL_PROPERTIES.find((name) => strings.includes(name)) ?? strings[0],
      scalarItems: ['string', 'integer', 'number'].includes(String(items.type)),
    }
  }
  if (schema?.type === 'object' || schema?.properties !== undefined) return { kind: 'object' }
  return { kind: 'value' }
}

/** 페이지(page.tsx). 메타데이터와 라우트의 Rendering Mode 설정, 데이터를 가져오는 코드, 폼을 담는다. */
function pageSource(page: PageModel): string {
  const { route, mode, query, form, args } = page
  const { perRequest, prerendered, serverData } = MODES[mode]
  const serverPrefetch = query !== undefined && serverData
  const pageName = `${route.componentPrefix}Page`
  const prefetchedName = query === undefined ? '' : `Prefetched${upperFirst(query.view.name.replace(/View$/, ''))}`

  const imports = new Map<string, string>()
  if (serverPrefetch) imports.set('@tanstack/react-query', 'import { dehydrate, HydrationBoundary }')
  imports.set('next', 'import type { Metadata }')
  if (args.some((arg) => arg.type === 'number')) imports.set('next/navigation', 'import { notFound }')
  if (perRequest) imports.set('next/server', 'import { connection }')
  if (serverPrefetch && mode === 'streaming') imports.set('react', 'import { Suspense }')
  if (form !== undefined) imports.set(form.importPath, `import { ${form.componentName} }`)
  if (query !== undefined) {
    imports.set(query.view.importPath, `import { ${query.view.name} }`)
    if (serverPrefetch) {
      imports.set(query.optionsModule, `import { ${query.optionsName} }`)
      imports.set('@/shared/query-client/get-query-client', 'import { getQueryClient }')
    }
  }

  const config: string[] = []
  if (mode === 'ssg') {
    config.push(`// SSG: 빌드할 때 렌더링해 둔 HTML을 모든 요청에 그대로 보낸다. 'error'는 이 라우트가 요청마다 달라지는 값
// (cookies(), headers(), searchParams 등)을 읽으면 SSR로 바뀌는 대신 빌드를 실패시켜 SSG임을 지킨다.
export const dynamic = 'error'`)
  }
  if (mode === 'isr') {
    config.push(`// ISR: 빌드할 때 렌더링해 둔 HTML을 보내다가, 렌더링한 지 revalidate초가 지난 뒤 요청이 오면 그 요청에는 이전 HTML을
// 보내고 뒤에서 다시 렌더링한다. Next.js가 빌드할 때 읽으므로 값은 상수로 적는다.
export const revalidate = ${String(ISR_REVALIDATE_SECONDS)}`)
  }
  if (prerendered && route.params.length > 0) {
    config.push(`// 빌드할 때 미리 렌더링할 경로. 빈 목록이면 빌드할 때는 렌더링하지 않고, 처음 요청이 온 경로를 렌더링해 두었다가
// 다음 요청부터 보낸다. 빌드할 때 렌더링할 경로가 있으면 { ${route.params.map((param) => `${param}: '1'`).join(', ')} }처럼 돌려준다.
export function generateStaticParams(): ${paramsType(route)}[] {
  return []
}`)
  }

  const comments: string[] = {
    ssr: [
      'SSR: 요청마다 서버에서 렌더링한다. connection()을 기다리면 Next.js가 이 라우트를 빌드할 때 미리 렌더링하지 않는다.',
      '페이지가 데이터를 기다리는 동안에는 loading.tsx를 먼저 보낸다.',
    ],
    ssg: [],
    isr: [],
    streaming: [
      '스트리밍: SSR처럼 요청마다 렌더링하고, 느린 부분만 <Suspense>로 감싼다. 서버는 제목 같은 나머지와 대체 UI(fallback)를',
      '먼저 보내고, 느린 부분이 준비되면 같은 응답에 이어 보낸다.',
      ...(query === undefined ? ['느린 데이터를 가져오는 서버 컴포넌트를 만들어 <Suspense>로 감싼다.'] : []),
    ],
    csr: [
      args.length === 0
        ? 'CSR: 페이지 뼈대는 빌드할 때 미리 렌더링하고(SSG), 데이터는 브라우저가 클라이언트 컴포넌트에서 가져온다.'
        : 'CSR: 서버는 데이터 없이 페이지 뼈대만 렌더링하고(경로의 값을 읽으므로 요청마다), 데이터는 브라우저가 클라이언트 컴포넌트에서 가져온다.',
    ],
  }[mode]
  if (serverPrefetch && !prerendered) {
    comments.push(
      `${query.operationId}의 데이터는 서버에서 가져와(prefetch) ${query.view.name}에 hydration으로 넘기므로 브라우저가 다시 요청하지 않는다.`,
    )
  }
  if (serverPrefetch && prerendered) {
    comments.push(
      `${query.operationId}의 데이터는 렌더링할 때 서버에서 가져와(prefetch) ${query.view.name}에 hydration으로 넘긴다. 가져온 지`,
      'staleTime(src/shared/query-client/get-query-client.ts)이 지난 데이터는 브라우저가 화면을 연 뒤 다시 가져온다.',
      ...(fetchesAtBuild(page)
        ? [
            '빌드할 때 서버 컴포넌트가 백엔드를 부르므로 배포용 빌드에는 API_BASE_URL(백엔드 주소)을 넣는다. API_MOCKING=enabled로',
            '빌드하면(GitLab CI의 build 잡) MSW의 목 응답으로 렌더링하므로 그 결과는 배포하지 않는다(README의 "실행과 배포").',
          ]
        : [
            'generateStaticParams가 돌려준 경로는 빌드할 때 렌더링하며 백엔드를 부르므로, 그런 경로가 있으면 배포용 빌드에',
            'API_BASE_URL(백엔드 주소)을 넣는다. API_MOCKING=enabled로 만든 목 빌드는 배포하지 않는다(README의 "실행과 배포").',
          ]),
    )
  }
  comments.push('화면은 Feature의 컴포넌트를 조합해 그린다(ADR-0005).')

  const propsName = `${pageName}Props`
  const propsInterface =
    args.length === 0
      ? ''
      : `interface ${propsName} {
  params: Promise<${paramsType(route)}>
}

`
  const readParams = args.length === 0 ? [] : paramsStatements(args)
  const prefetch = (indent: string) =>
    query === undefined
      ? []
      : [
          `${indent}const queryClient = getQueryClient()`,
          `${indent}await queryClient.query(${query.optionsName}(${argumentList(query.args)}))`,
        ]
  const body = [
    ...(perRequest ? ['  await connection()'] : []),
    ...readParams,
    ...(serverPrefetch && mode !== 'streaming' ? prefetch('  ') : []),
  ]
  const isAsync = body.length > 0

  const viewElement = query === undefined ? '' : `<${query.view.name}${elementProps(query.args)} />`
  const data = (() => {
    if (query === undefined) return []
    if (!serverPrefetch) return [viewElement]
    if (mode === 'streaming') {
      return [
        `<Suspense fallback={<p role="status">${LOADING_MESSAGE}</p>}>`,
        `<${prefetchedName}${elementProps(query.args)} />`,
        '</Suspense>',
      ]
    }
    return ['<HydrationBoundary state={dehydrate(queryClient)}>', viewElement, '</HydrationBoundary>']
  })()
  const formElement = form === undefined ? '' : `<${form.componentName}${elementProps(form.args)} />`
  const formSection = (() => {
    if (form === undefined) return []
    if (query === undefined) return [formElement]
    return [
      '<section className="flex flex-col gap-2">',
      `<h2 className="text-md font-semibold">${jsxText(form.summary ?? '입력')}</h2>`,
      formElement,
      '</section>',
    ]
  })()

  const prefetchedComponent =
    query === undefined || mode !== 'streaming'
      ? ''
      : `

// ${query.operationId}의 데이터를 서버에서 가져와(prefetch) ${query.view.name}에 hydration으로 넘긴다. 이 컴포넌트가 데이터를 기다리는
// 동안 페이지는 <Suspense>의 대체 UI를 먼저 보낸다.
async function ${prefetchedName}(${componentParameters(query.args)}) {
${prefetch('  ').join('\n')}

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      ${viewElement}
    </HydrationBoundary>
  )
}`

  const importLines = [...imports.entries()]
    .sort(([a], [b]) => Number(a.startsWith('@/')) - Number(b.startsWith('@/')) || a.localeCompare(b))
    .map(([module, clause]) => `${clause} from '${module}'`)

  return `${importLines.join('\n')}

export const metadata: Metadata = {
  title: ${JSON.stringify(page.title)},
}
${config.map((block) => `\n${block}\n`).join('')}
${propsInterface}${comments.map((line) => `// ${line}`).join('\n')}
export default ${isAsync ? 'async ' : ''}function ${pageName}(${args.length === 0 ? '' : `{ params }: ${propsName}`}) {
${body.join('\n')}${body.length === 0 ? '' : '\n\n'}  return (
    <main className="flex flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold">${jsxText(page.title)}</h1>
${[...data, ...formSection].join('\n')}
    </main>
  )
}${prefetchedComponent}
`
}

/** 빌드할 때 서버 컴포넌트가 백엔드에서 --query의 데이터를 가져오는가. 동적 세그먼트의 라우트는 빌드할 때 렌더링할 경로가 없다. */
function fetchesAtBuild({ mode, query, route }: PageModel): boolean {
  return query !== undefined && MODES[mode].serverData && MODES[mode].prerendered && route.params.length === 0
}

/** 라우트의 동적 세그먼트 값(params)의 타입. 값은 모두 문자열이다. */
function paramsType(route: Route): string {
  return `{ ${route.params.map((param) => `${param}: string`).join('; ')} }`
}

/** 인자를 이름 그대로 넘기는 인자 목록(productId, ...) */
function argumentList(args: readonly PathArgument[]): string {
  return args.map(({ name }) => name).join(', ')
}

/** 페이지가 경로의 동적 세그먼트를 읽어 쿼리나 폼에 넘길 값으로 바꾸는 문장 */
function paramsStatements(args: readonly PathArgument[]): string[] {
  const numbers = args.filter((arg) => arg.type === 'number')
  const destructured = args.map(({ name, type }) => (type === 'number' ? `${name}: ${name}Param` : name))
  return [
    `  const { ${destructured.join(', ')} } = await params`,
    ...numbers.flatMap(({ name, integer }) => [
      `  const ${name} = Number(${name}Param)`,
      `  // 경로의 ${name}가 ${integer ? '정수' : '숫자'}가 아니면 없는 페이지로 본다.`,
      `  if (!Number.${integer ? 'isInteger' : 'isFinite'}(${name})) notFound()`,
    ]),
  ]
}

function elementProps(args: readonly PathArgument[]): string {
  return args.map(({ name }) => ` ${name}={${name}}`).join('')
}

function componentParameters(args: readonly PathArgument[]): string {
  if (args.length === 0) return ''
  return `{ ${argumentList(args)} }: { ${args.map(({ name, type }) => `${name}: ${type}`).join('; ')} }`
}

/** 로딩 상태(loading.tsx) */
function loadingSource({ route }: PageModel): string {
  return `// ${route.path} 페이지의 로딩 상태. 페이지가 서버에서 데이터를 기다리는 동안과 이 페이지로 옮겨 가는 동안 페이지 대신 보인다.
export default function ${route.componentPrefix}Loading() {
  return (
    <main className="flex flex-col gap-4 p-4">
      <p role="status">${LOADING_MESSAGE}</p>
    </main>
  )
}
`
}

/** 오류 상태(error.tsx). Next.js의 오류 경계는 클라이언트 컴포넌트다. */
function errorSource({ route, title }: PageModel): string {
  const name = `${route.componentPrefix}Error`
  return `'use client'

import { Button } from '@/shared/ui/button'

interface ${name}Props {
  /** 던져진 값. 서버 컴포넌트의 오류는 배포한 앱에서 메시지 대신 서버 로그와 맞춰 볼 식별자(digest)만 담긴다. */
  error: unknown
  /** 이 라우트를 서버에서 다시 가져와 렌더링한다. */
  retry: () => void
}

// ${route.path} 페이지의 오류 상태. 페이지를 렌더링하다 오류가 나면(서버에서 데이터를 가져오지 못했을 때 등) 페이지 대신 보인다.
// 문구는 화면에 맞게 고친다.
export default function ${name}({ retry }: ${name}Props) {
  return (
    <main className="flex flex-col items-start gap-4 p-4">
      <h1 className="text-lg font-semibold">${jsxText(title)}</h1>
      <p role="alert">페이지를 불러오지 못했습니다. 잠시 뒤에 다시 시도해 주세요.</p>
      <Button onClick={retry}>다시 시도</Button>
    </main>
  )
}
`
}

/** --query의 결과를 보여 주는 Feature의 클라이언트 컴포넌트 */
function viewSource(query: PageQuery): string {
  const { view, args } = query
  const propsName = `${view.name}Props`
  const propsInterface =
    args.length === 0
      ? ''
      : `export interface ${propsName} {
${args.map(({ name, type }) => `  /** 요청 경로의 ${name} */\n  ${name}: ${type}`).join('\n')}
}

`
  const parameters = args.length === 0 ? '' : `{ ${argumentList(args)} }: ${propsName}`
  const { shape } = view
  const rendering = (() => {
    switch (shape.kind) {
      case 'list': {
        const label =
          shape.label !== undefined
            ? propertyAccess('item', shape.label)
            : shape.scalarItems
              ? 'item'
              : 'JSON.stringify(item)'
        const key = shape.key === undefined ? 'index' : propertyAccess('item', shape.key)
        return {
          comment: `항목마다 ${shape.label ?? (shape.scalarItems ? '값' : 'JSON')}을 보여 준다.`,
          early: `  if (data.length === 0) return <p>항목이 없습니다.</p>\n`,
          jsx: `<ul className="list-disc pl-6">
      {data.map((item${shape.key === undefined ? ', index' : ''}) => (
        <li key={${key}}>{${label}}</li>
      ))}
    </ul>`,
        }
      }
      case 'object':
        return {
          comment: '응답의 속성마다 이름과 값을 보여 준다.',
          early: '',
          jsx: `<dl className="flex flex-col gap-1">
      {Object.entries(data).map(([name, value]) => (
        <div key={name} className="flex gap-2">
          <dt className="font-semibold">{name}</dt>
          <dd>{typeof value === 'string' ? value : JSON.stringify(value)}</dd>
        </div>
      ))}
    </dl>`,
        }
      case 'value':
        return { comment: '응답을 JSON으로 보여 준다.', early: '', jsx: '<p>{JSON.stringify(data)}</p>' }
    }
  })()

  return `'use client'

import { useQuery } from '@tanstack/react-query'
import { ${query.optionsName} } from '${query.optionsModule}'

${propsInterface}/**
 * ${query.operationId}${query.summary === undefined ? '' : `(${query.summary})`}의 결과를 보여 준다. 데이터는 ${query.domainName} Query Domain의 ${query.optionsName}로 가져온다.
 * 페이지가 서버에서 가져와(prefetch) hydration으로 넘긴 데이터가 있으면 그대로 그리고, 없으면(CSR) 브라우저가 가져온다.
 * ${rendering.comment} 보여 줄 값과 모양은 화면에 맞게 고친다.
 */
export function ${view.name}(${parameters}) {
  const { data, isPending, isError } = useQuery(${query.optionsName}(${argumentList(args)}))

  if (isPending) return <p role="status">${LOADING_MESSAGE}</p>
  if (isError) return <p role="alert">불러오지 못했습니다.</p>
${rendering.early}
  return (
    ${rendering.jsx}
  )
}
`
}

/** --query의 컴포넌트 테스트. MSW가 돌려준 응답을 그리는지, 비었거나 실패하면 알리는지 본다. */
function viewTestSource(query: PageQuery): string {
  const { view, args, mocks } = query
  const element = `<${view.name}${args.map(({ name, type }) => ` ${name}={${PROP_SAMPLES.get(type) ?? '1'}}`).join('')} />`
  const { shape } = view
  const mockImports = [mocks.handler, ...(mocks.response === undefined ? [] : [mocks.response])]
  const shown = (() => {
    if (mocks.response === undefined || shape.kind === 'value') {
      return {
        title: '불러오는 중임을 알린 뒤 응답을 보여 준다',
        arrange: '',
        assert: `await waitFor(() => {
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()`,
      }
    }
    return {
      title:
        shape.kind === 'list'
          ? '불러오는 중임을 알린 뒤 응답의 항목을 목록으로 보여 준다'
          : '불러오는 중임을 알린 뒤 응답의 속성마다 이름과 값을 보여 준다',
      arrange: `  const response = ${mocks.response}()
  server.use(${mocks.handler}(response))

`,
      assert:
        shape.kind === 'list'
          ? `expect(await screen.findAllByRole('listitem')).toHaveLength(response.length)`
          : `expect(await screen.findAllByRole('term')).toHaveLength(Object.keys(response).length)`,
    }
  })()
  const emptyTest =
    shape.kind === 'list'
      ? `
test('항목이 없으면 안내 문구를 보여 준다', async () => {
  server.use(${mocks.handler}([]))

  renderView()

  expect(await screen.findByText('항목이 없습니다.')).toBeInTheDocument()
})
`
      : ''
  const usesWaitFor = shown.assert.includes('waitFor')

  return `import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen${usesWaitFor ? ', waitFor' : ''} } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ${mockImports.join(', ')} } from '${mocks.module}'
import { server } from '@/shared/mocks/node'
import { ${view.name} } from './${view.fileName}'

// Rendering Mode static-export에서는 브라우저가 백엔드를 직접 부르므로 그 요청을 MSW가 받도록 켠다. server에서는 이 값을 읽지 않는다.
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_API_MOCKING', 'enabled')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

function renderView() {
  // 실패한 요청을 다시 보내지 않아 실패한 상태를 바로 본다.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      ${element}
    </QueryClientProvider>,
  )
}

test('${shown.title}', async () => {
${shown.arrange}  renderView()

  expect(screen.getByRole('status')).toHaveTextContent('${LOADING_MESSAGE}')
  ${shown.assert}
})
${emptyTest}
test('백엔드가 실패하면 불러오지 못했다고 알린다', async () => {
  server.use(http.get('${query.mockPath}', () => HttpResponse.json({ message: '점검 중' }, { status: 503 })))

  renderView()

  expect(await screen.findByRole('alert')).toHaveTextContent('불러오지 못했습니다.')
})
`
}

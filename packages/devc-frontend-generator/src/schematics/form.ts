import type { OpenAPIV3 } from 'openapi-types'
import { type Feature, featureNamed } from './feature.js'
import { mutationHookName } from './mutation.js'
import { camelCase, kebabCase, splitWords, upperFirst } from './names.js'
import { hasDeclaration, queryDomainOf } from './query-domain.js'
import {
  type ChangedFile,
  type GeneratedFunction,
  type Operation,
  SchematicError,
  StarterProject,
  type TypeImport,
} from './starter-project.js'

// 폼이 쓰는 Base의 모듈. Zod 스키마로 폼 값을 검증하는 formResolver와 그 오류 메시지(REQUIRED_MESSAGE 등)를 내보낸다.
const FORM_RESOLVER_IMPORT = '@/shared/form/form-resolver'
// 폼을 만드는 Base의 훅(useSchemaForm). useForm에 formResolver를 잇고, 처음 값을 useForm과 formResolver에 함께 넘긴다.
const SCHEMA_FORM_IMPORT = '@/shared/form/use-schema-form'

// 비워 두면 실패하는 필수 입력의 오류 메시지(formResolver가 내보내는 상수)마다 생성한 테스트가 쓰는 이름과 설명
const BLANK_ERRORS = {
  REQUIRED_MESSAGE: { variable: 'requiredError', unfilled: '비워 둔', comment: '' },
  MUST_CHECK_MESSAGE: {
    variable: 'mustCheckError',
    unfilled: '체크하지 않은',
    comment: '\n  // 반드시 true여야 하는 체크박스(명세의 const: true, enum: [true])는 체크하라고 알린다.',
  },
}

type BlankMessage = keyof typeof BLANK_ERRORS

// JSON 요청 본문의 미디어 타입(application/json, application/merge-patch+json 등)
const JSON_MEDIA_TYPE = /^application\/([\w.-]+\+)?json\s*(;.*)?$/i

// React Hook Form의 필드 이름으로 쓸 수 있는 속성 이름. 점(.)과 대괄호는 중첩 경로로 읽히므로 받지 않는다.
const FIELD_NAME = /^[A-Za-z_$][\w$-]*$/
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/

// null을 받는 필드의 Select에서 고른 값을 비우는 선택지의 문구(Select의 clearLabel)
const CLEAR_SELECT_LABEL = '선택 안 함'

// 문자열 format마다 Input의 type. 나머지 format은 type="text"다.
const INPUT_TYPES = new Map([
  ['email', 'email'],
  ['uri', 'url'],
])

// 재생성 계층(orval)이 Zod로 검증하는 문자열 format마다 테스트가 입력할 값
const FORMAT_SAMPLES = new Map([
  ['email', 'user@example.com'],
  ['uri', 'https://example.com'],
  ['hostname', 'example.com'],
  ['uuid', '123e4567-e89b-42d3-a456-426614174000'],
  ['date', '2026-01-01'],
  ['time', '12:00:00'],
  ['date-time', '2026-01-01T00:00:00Z'],
  ['date-time-local', '2026-01-01T00:00:00'],
])

// 폼의 props로 받는 인자(경로 파라미터)의 타입마다 테스트와 스토리가 넘길 값. page Schematic이 만드는 컴포넌트의 테스트도 쓴다.
export const PROP_SAMPLES = new Map([
  ['number', '1'],
  ['string', "'1'"],
  ['boolean', 'true'],
])

// 재생성 계층(orval)이 Zod로 검증하는 문자열 format. 'a'는 이 format에 맞지 않는다(검증 실패 테스트가 입력한다).
const CHECKED_FORMATS = new Set(['email', 'uri', 'uuid', 'date', 'time', 'date-time', 'date-time-local'])

// 검증에 실패하게 할 입력이 없을 때(비워 둘 필수 입력도, 어길 길이·범위·형식 규칙도 없을 때) 검증 실패 테스트와 스토리 대신 남기는 안내
const noValidationCheck = (what: string) =>
  `// 비워 두거나 규칙에 맞지 않게 입력해 검증에 실패하게 할 필드가 없어 ${what}는 만들지 않았다. 검증 규칙을 더하면 함께 더한다.`

export interface FormSchematicOptions {
  /** 폼을 둘 Feature. src/features/<feature>/에 만든다. */
  feature: string | undefined
}

/** 만든 폼 */
export interface GeneratedForm {
  componentName: string
  /** 입력 요소를 만들지 않은 선택 필드('<이름>(<모양>)') */
  skippedFields: string[]
  changed: ChangedFile[]
}

/** 요청 본문의 JSON 스키마에서 폼이 읽는 필드. 명세 버전(3.0, 3.1)마다 모양이 다른 필드(type, exclusiveMinimum 등)는 둘 다 받는다. */
interface JsonSchema {
  type?: string | string[]
  nullable?: boolean
  enum?: unknown[]
  const?: unknown
  format?: string
  title?: string
  description?: string
  default?: unknown
  example?: unknown
  examples?: unknown
  minLength?: number
  maxLength?: number
  pattern?: string
  minimum?: number
  maximum?: number
  exclusiveMinimum?: boolean | number
  exclusiveMaximum?: boolean | number
  multipleOf?: number
  readOnly?: boolean
  properties?: Record<string, JsonSchema>
  required?: string[]
  oneOf?: unknown
  anyOf?: unknown
  allOf?: unknown
  not?: unknown
}

/**
 * 필드 하나를 입력받는 공통 UI 컴포넌트. mustCheck는 반드시 true여야 하는 불리언(const: true, enum: [true])의 체크박스로,
 * 체크하지 않으면 formResolver가 값을 넣지 않은 것으로 본다.
 */
type Control =
  | { kind: 'text'; inputType: string }
  | { kind: 'number'; integer: boolean }
  | { kind: 'select'; options: string[] }
  | { kind: 'checkbox'; mustCheck: boolean }

/** 요청 본문의 속성 하나를 입력받는 폼 필드 */
interface FormField {
  /** 요청 본문의 속성 이름. React Hook Form의 필드 이름이 된다. */
  name: string
  /** 명세의 title. 없으면 속성 이름 */
  label: string
  description: string | undefined
  control: Control
  /** 요청 본문의 필수(required) 필드인가 */
  required: boolean
  /** null을 받는가(3.0의 nullable, 3.1의 type: [..., 'null'], null과 묶은 anyOf·oneOf) */
  nullable: boolean
  /** 명세의 기본값(default). 비워 두면 재생성 계층의 스키마가 이 값을 넣는다. */
  defaultValue: unknown
  /**
   * 비워 두고 제출하면 검증에 실패하는가. null을 받지 않고 기본값(default)이 없는 필수 필드다. 체크박스는 체크하지 않은 값(false)이
   * 있으므로 빠지고, 반드시 true여야 하는 체크박스만 체크하지 않으면 실패한다.
   */
  requiredInput: boolean
  /** 생성한 테스트가 입력할 값. undefined면 비워 둔다(만들 수 없는 선택 필드). */
  sample: string | number | boolean | undefined
  /** 검증 규칙(길이, 범위, 정수, format)에 맞지 않아 검증에 실패하는 입력. 어길 규칙이 없으면 undefined */
  invalidInput: string | undefined
}

/** 입력 요소로 만들 수 없는 속성. unsupported는 그 이유(속성의 모양: 배열, 객체 등)다. */
interface Unsupported {
  unsupported: string
}

/**
 * 생성한 테스트와 스토리가 검증 실패를 보이는 방법. 비워 두면 실패하는 필수 입력(requiredInput)이 있으면 모두 비워 두고
 * 제출하고(blank), 없으면 규칙에 맞지 않는 값을 필드 하나에 입력해 제출한다(invalid). 둘 다 할 수 없으면 undefined다.
 */
type ValidationCheck =
  | { kind: 'blank'; fields: [FormField, ...FormField[]] }
  | { kind: 'invalid'; field: FormField; input: string }
  | undefined

/** 폼이 props로 받아 뮤테이션에 함께 넘기는 인자(경로 파라미터) */
interface FormProp {
  name: string
  type: string
  /** 테스트와 스토리가 넘길 값(TypeScript 식) */
  sample: string
}

/** 생성할 폼. 세 파일(컴포넌트, 스토리, 테스트)의 소스를 이것으로 만든다. */
interface FormModel {
  operationId: string
  componentName: string
  fileName: string
  feature: Feature
  /** 제출 버튼 문구. 명세의 summary, 없으면 '제출' */
  submitLabel: string
  domainName: string
  /** 뮤테이션 훅(use<OperationId>Mutation) */
  hook: TypeImport
  /** 재생성 계층의 요청 본문 Zod 스키마(<OperationId>Body) */
  schema: TypeImport
  fields: FormField[]
  skippedFields: string[]
  validationCheck: ValidationCheck
  props: FormProp[]
  /** mutate에 넘길 값(TypeScript 식). 폼 값은 values다. */
  variables: string
  /** 재생성 계층의 MSW 핸들러(get<OperationId>MockHandler) */
  mockHandler: TypeImport
  /** 응답 본문을 만드는 MSW 목 함수. 응답 본문이 없는 operation이면 undefined */
  responseMock: string | undefined
}

/**
 * `form` Schematic. OpenAPI operation의 JSON 요청 본문을 입력받는 React Hook Form 폼을 Feature에 만든다. 폼은 재생성 계층의
 * 요청 본문 Zod 스키마로 검증하고(ADR-0003), 제출하면 mutation Schematic이 만든 뮤테이션 훅(ADR-0008)으로 보낸다.
 * 폼 컴포넌트, Storybook 스토리, 컴포넌트 테스트(제출 성공, 검증 실패)를 함께 만든다.
 * 요청 본문이나 뮤테이션 훅이 없거나, 입력 요소로 만들 수 없는 필수 필드가 있거나, 같은 이름의 파일이 있으면
 * SchematicError를 던지고 아무 파일도 만들지 않는다.
 */
export async function generateForm(
  cwd: string,
  operationId: string,
  options: FormSchematicOptions,
): Promise<GeneratedForm> {
  if (options.feature === undefined) {
    throw new SchematicError('폼을 둘 Feature를 고르세요: --feature <feature>(src/features/<feature>/).')
  }
  const feature = featureNamed(options.feature)
  const starter = StarterProject.open(cwd)
  const operation = await starter.findOperation(operationId)
  const { fields, skippedFields } = formFields(operationId, requestBodySchema(operation))

  const domain = queryDomainOf(operation)
  const fetcher = starter.generatedFunction(operation)
  const hookName = mutationHookName(fetcher)
  const queries = starter.existingModule(domain.queriesPath)
  if (queries === undefined || !hasDeclaration(queries, hookName)) {
    throw new SchematicError(
      `${domain.queriesPath}에 ${hookName}가 없습니다. 폼은 이 뮤테이션 훅으로 요청을 보내므로 먼저 npm run g -- mutation ${operationId}로 만드세요.`,
    )
  }
  const { props, variables, bodyType } = formArguments(operation, fetcher)
  // orval이 operation마다 만드는 이름은 fetch 함수 이름(camelCase operationId)을 PascalCase로 바꿔 쓴다.
  const operationName = upperFirst(fetcher.name)
  const schemaName = `${operationName}Body`
  const schemaModule = starter.generatedModuleOf(schemaName)
  const mockHandlerName = `get${operationName}MockHandler`
  const mockHandlerModule = starter.generatedModuleOf(mockHandlerName)
  if (schemaModule === undefined || mockHandlerModule === undefined) {
    throw new SchematicError(
      `재생성 계층에 ${operationId}의 요청 본문 Zod 스키마(${schemaName})나 MSW 핸들러(${mockHandlerName})가 없습니다. openapi.yaml을 고쳤다면 npm run api:gen으로 API 계층을 다시 만드세요.`,
    )
  }
  const responseMock = `get${operationName}ResponseMock`

  const form: FormModel = {
    operationId,
    ...formComponentOf(operationId, fetcher),
    feature,
    submitLabel: operation.definition.summary?.trim() || '제출',
    domainName: domain.name,
    hook: { name: hookName, moduleSpecifier: starter.importPath(domain.queriesPath) },
    // 스키마는 요청 본문 타입을 가져오는 곳(model의 index)에서 함께 가져온다.
    schema: {
      name: schemaName,
      moduleSpecifier:
        fetcher.typeImports.find((typeImport) => typeImport.name === bodyType)?.moduleSpecifier ?? schemaModule,
    },
    fields,
    skippedFields,
    validationCheck: validationCheckOf(fields),
    props,
    variables,
    mockHandler: { name: mockHandlerName, moduleSpecifier: mockHandlerModule },
    responseMock: starter.generatedModuleOf(responseMock) === undefined ? undefined : responseMock,
  }

  const stem = `${feature.directory}/${form.fileName}`
  starter.newModules([
    { stem, source: componentSource(form) },
    { stem: `${stem}.stories`, source: storySource(form) },
    { stem: `${stem}.test`, source: testSource(form) },
  ])
  return { componentName: form.componentName, skippedFields, changed: await starter.save() }
}

/** operation의 폼 컴포넌트(<OperationId>Form)와 파일 이름(<operation-id>-form). page Schematic이 끼워 넣을 폼을 찾을 때도 쓴다. */
export function formComponentOf(operationId: string, fetcher: GeneratedFunction): { componentName: string; fileName: string } {
  return { componentName: `${upperFirst(fetcher.name)}Form`, fileName: `${kebabCase(splitWords(operationId))}-form` }
}

/** 폼이 props로 받는 인자(필수 경로 파라미터)의 이름과 타입. page Schematic이 폼에 넘길 값을 정할 때 쓴다. */
export function formPropsOf(operation: Operation, fetcher: GeneratedFunction): { name: string; type: string }[] {
  return formArguments(operation, fetcher).props.map(({ name, type }) => ({ name, type }))
}

/** operation의 JSON 요청 본문 스키마. 없으면 폼을 만들 수 없다. */
function requestBodySchema(operation: Operation): JsonSchema {
  // findOperation이 $ref를 모두 풀었으므로 요청 본문은 RequestBodyObject다.
  const requestBody = operation.definition.requestBody as OpenAPIV3.RequestBodyObject | undefined
  const json = Object.entries(requestBody?.content ?? {}).find(([mediaType]) => JSON_MEDIA_TYPE.test(mediaType))
  const schema = json?.[1].schema
  if (schema === undefined) {
    throw new SchematicError(
      `form Schematic은 JSON 요청 본문(application/json)이 있는 operation으로만 폼을 만듭니다. ${operation.operationId}에는 JSON 요청 본문이 없습니다.`,
    )
  }
  return schema as JsonSchema
}

/**
 * 요청 본문의 속성마다 폼 필드를 정한다. 입력 요소로 만들 수 없는 속성(배열, 객체, 스키마 조합 등)이 선택 필드면 빼고 알리고,
 * 필수 필드면 폼을 만들지 않는다. 생성한 테스트가 입력할 값을 정할 수 없는 필수 필드도 폼을 만들지 않는다.
 */
function formFields(operationId: string, body: JsonSchema): { fields: FormField[]; skippedFields: string[] } {
  const properties = body.properties ?? {}
  if (typesOf(body).types.some((type) => type !== 'object') || Object.keys(properties).length === 0) {
    throw new SchematicError(
      `form Schematic은 속성(properties)이 있는 객체 요청 본문으로만 폼을 만듭니다. ${operationId}의 요청 본문은 객체가 아니거나 속성이 없습니다.`,
    )
  }
  const required = new Set(body.required ?? [])
  const fields: FormField[] = []
  const skippedFields: string[] = []
  const unsupported: string[] = []
  const withoutSample: string[] = []
  for (const [name, property] of Object.entries(properties)) {
    const schema = withoutNullUnion(property)
    // 응답에만 담기는 속성(readOnly)은 보내지 않는다.
    if (schema.readOnly === true) continue
    const control = controlOf(name, schema)
    if ('unsupported' in control) {
      ;(required.has(name) ? unsupported : skippedFields).push(`${name}(${control.unsupported})`)
      continue
    }
    const { nullable } = typesOf(schema)
    const requiredInput =
      required.has(name) &&
      !nullable &&
      schema.default === undefined &&
      (control.kind !== 'checkbox' || control.mustCheck)
    const sample = sampleOf(schema, control)
    if (requiredInput && sample === undefined) withoutSample.push(name)
    const description = schema.description?.trim()
    fields.push({
      name,
      label: schema.title?.trim() || name,
      description: description === '' ? undefined : description,
      control,
      required: required.has(name),
      nullable,
      defaultValue: schema.default,
      requiredInput,
      sample,
      invalidInput: invalidInputOf(schema, control),
    })
  }
  if (unsupported.length > 0) {
    throw new SchematicError(
      `${operationId}의 요청 본문에 입력 요소로 만들 수 없는 필수 필드가 있어 폼을 만들지 않았습니다. 폼은 문자열(enum은 Select), 정수·숫자, 불리언 필드와 그 필드에 null을 더한 필드만 입력받습니다.\n${unsupported.map((field) => `  ${field}`).join('\n')}`,
    )
  }
  if (withoutSample.length > 0) {
    throw new SchematicError(
      `생성한 테스트가 입력할 값을 정할 수 없는 필수 필드가 있어 폼을 만들지 않았습니다(pattern이나 multipleOf가 있는 필드). openapi.yaml의 이 필드에 example을 적으세요.\n${withoutSample.map((field) => `  ${field}`).join('\n')}`,
    )
  }
  if (fields.length === 0) {
    throw new SchematicError(`${operationId}의 요청 본문에 폼이 입력받을 수 있는 필드가 없습니다.`)
  }
  return { fields, skippedFields }
}

/**
 * 스키마 하나와 { type: 'null' }을 묶은 anyOf·oneOf(3.1에서 null을 더하는 흔한 방법)를 그 스키마에 null을 더한 것으로 푼다.
 * title, description 같은 바깥의 설명은 그대로 쓴다. 그 밖의 스키마는 그대로 돌려준다.
 */
function withoutNullUnion(schema: JsonSchema): JsonSchema {
  const { anyOf, oneOf, ...outer } = schema
  const members = anyOf ?? oneOf
  if (anyOf !== undefined && oneOf !== undefined) return schema
  if (!Array.isArray(members) || members.length !== 2) return schema
  const isNull = (member: JsonSchema) => [member.type].flat().join() === 'null'
  const [first, second] = members as [JsonSchema, JsonSchema]
  if (isNull(first) === isNull(second)) return schema
  return { ...(isNull(first) ? second : first), ...outer, nullable: true }
}

/** 속성을 입력받을 공통 UI 컴포넌트. 입력 요소로 만들 수 없으면 그 이유(속성의 모양)를 돌려준다. */
function controlOf(name: string, schema: JsonSchema): Control | Unsupported {
  const unsupported = (reason: string): Unsupported => ({ unsupported: reason })
  if (!FIELD_NAME.test(name)) return unsupported('필드 이름으로 쓸 수 없는 이름')
  if (schema.oneOf !== undefined || schema.anyOf !== undefined || schema.allOf !== undefined || schema.not !== undefined) {
    return unsupported('스키마 조합')
  }
  const { types } = typesOf(schema)
  // null을 받는 필드도 같은 입력 요소로 받는다. 비워 두면 formResolver가 null을 보낸다. enum의 null은 선택지로 만들지 않는다.
  const values = schema.enum?.filter((value) => value !== null)
  if (types.every((type) => type === 'boolean') && (schema.const === true || (values?.length === 1 && values[0] === true))) {
    return { kind: 'checkbox', mustCheck: true }
  }
  if ('const' in schema) return unsupported('상수')
  if (types.length > 1) return unsupported('여러 타입')
  if (values?.length === 0) return unsupported('enum')
  const strings = values?.every((value) => typeof value === 'string') === true
  const type = types[0] ?? (strings ? 'string' : undefined)
  switch (type) {
    case 'string':
      if (values !== undefined) {
        return strings ? { kind: 'select', options: values as string[] } : unsupported('enum')
      }
      if (schema.format === 'binary') return unsupported('파일')
      return { kind: 'text', inputType: INPUT_TYPES.get(schema.format ?? '') ?? 'text' }
    case 'integer':
    case 'number':
      return values === undefined ? { kind: 'number', integer: type === 'integer' } : unsupported('enum')
    case 'boolean':
      return values === undefined ? { kind: 'checkbox', mustCheck: false } : unsupported('enum')
    case 'array':
      return unsupported('배열')
    case 'object':
      return unsupported('객체')
    default:
      return unsupported(schema.properties === undefined ? '타입 없음' : '객체')
  }
}

/**
 * schema의 type에서 null을 뺀 타입들과 null을 허용하는지(3.0의 nullable, 3.1의 type: [..., 'null']).
 * 재생성 계층(orval)은 enum에 null이 있어도 null을 받는 스키마를 만들므로 그것도 null을 허용하는 것으로 본다.
 */
function typesOf(schema: JsonSchema): { types: string[]; nullable: boolean } {
  const declared = schema.type === undefined ? [] : [schema.type].flat()
  const types = declared.filter((type) => type !== 'null')
  const nullable = schema.nullable === true || types.length !== declared.length || schema.enum?.includes(null) === true
  return { types, nullable }
}

/**
 * 생성한 테스트가 입력할 값. 명세의 example을 먼저 쓰고, 없으면 검증 규칙(최소 길이, format, 범위)을 지키는 값을 만든다.
 * 규칙을 지키는 값을 만들 수 없으면(pattern, multipleOf) undefined다.
 */
function sampleOf(schema: JsonSchema, control: Control): string | number | boolean | undefined {
  const example = schema.example ?? (Array.isArray(schema.examples) ? (schema.examples as unknown[])[0] : undefined)
  switch (control.kind) {
    case 'text':
      if (typeof example === 'string' && example !== '') return example
      if (schema.pattern !== undefined) return undefined
      return FORMAT_SAMPLES.get(schema.format ?? '') ?? 'a'.repeat(Math.max(1, schema.minLength ?? 1))
    case 'number':
      if (typeof example === 'number' && (!control.integer || Number.isInteger(example))) return example
      return schema.multipleOf === undefined ? numberSample(schema) : undefined
    case 'select':
      return typeof example === 'string' && control.options.includes(example) ? example : control.options[0]
    case 'checkbox':
      return true
  }
}

/** 범위(minimum, maximum, 3.0과 3.1의 exclusiveMinimum, exclusiveMaximum) 안의 정수. 범위가 없으면 1이다. */
function numberSample(schema: JsonSchema): number {
  const { low, high } = rangeOf(schema)
  const value = low === undefined ? 1 : low.exclusive ? Math.floor(low.value) + 1 : Math.ceil(low.value)
  if (high === undefined || (high.exclusive ? value < high.value : value <= high.value)) return value
  return high.exclusive ? Math.ceil(high.value) - 1 : Math.floor(high.value)
}

/** 숫자의 범위. 3.0의 exclusiveMinimum은 minimum을 꾸미는 불리언이고, 3.1의 exclusiveMinimum은 경계 값이다. */
function rangeOf(schema: JsonSchema): Record<'low' | 'high', { value: number; exclusive: boolean } | undefined> {
  const bound = (inclusive: number | undefined, exclusive: boolean | number | undefined) => {
    if (typeof exclusive === 'number') return { value: exclusive, exclusive: true }
    return inclusive === undefined ? undefined : { value: inclusive, exclusive: exclusive === true }
  }
  return { low: bound(schema.minimum, schema.exclusiveMinimum), high: bound(schema.maximum, schema.exclusiveMaximum) }
}

/** 검증 규칙(최대·최소 길이, 검증하는 format, 범위, 정수)에 맞지 않아 검증에 실패하는 입력. 어길 규칙이 없으면 undefined다. */
function invalidInputOf(schema: JsonSchema, control: Control): string | undefined {
  if (control.kind === 'text') {
    if (schema.maxLength !== undefined) return 'a'.repeat(schema.maxLength + 1)
    if ((schema.minLength ?? 0) >= 2 || CHECKED_FORMATS.has(schema.format ?? '')) return 'a'
    return undefined
  }
  if (control.kind !== 'number') return undefined
  const { low, high } = rangeOf(schema)
  if (low !== undefined) return String(low.exclusive ? low.value : low.value - 1)
  if (high !== undefined) return String(high.exclusive ? high.value : high.value + 1)
  return control.integer ? '1.5' : undefined
}

/** 생성한 테스트와 스토리가 검증 실패를 보이는 방법(ValidationCheck) */
function validationCheckOf(fields: readonly FormField[]): ValidationCheck {
  const [first, ...rest] = fields.filter((field) => field.requiredInput)
  if (first !== undefined) return { kind: 'blank', fields: [first, ...rest] }
  // 명세의 description이 없는 필드를 먼저 고른다. 그런 필드는 오류 메시지만 입력 요소의 설명이 되므로 설명으로 오류를 확인할 수 있다.
  const candidates = fields.filter((field) => field.invalidInput !== undefined)
  const field = candidates.find((candidate) => candidate.description === undefined) ?? candidates[0]
  return field?.invalidInput === undefined ? undefined : { kind: 'invalid', field, input: field.invalidInput }
}

/**
 * 비워 두면 실패하는 필수 입력(requiredInput)이 알리는 오류 메시지. formResolver가 내보내는 상수의 이름이다.
 * requiredInput인 체크박스는 반드시 true여야 하는 체크박스뿐이다.
 */
function blankMessageOf(field: FormField): BlankMessage {
  return field.control.kind === 'checkbox' ? 'MUST_CHECK_MESSAGE' : 'REQUIRED_MESSAGE'
}

/**
 * 비워 두면 null을 보낼 수 있는 입력. 체크박스(늘 true나 false다)와 기본값이 있는 필드(비워 두면 기본값이 간다)는 빠진다.
 * 필수 필드는 늘 null을, 선택 필드는 처음 값이 있던 입력을 비웠을 때만 null을 보낸다(formResolver).
 */
function clearableFields(fields: readonly FormField[]): FormField[] {
  return fields.filter((field) => field.nullable && field.control.kind !== 'checkbox' && field.defaultValue === undefined)
}

/**
 * 필드를 비워 두고(체크박스는 체크하지 않고) 제출하면 요청 본문에 담기는 값. 담기지 않으면 undefined다. formResolver와
 * 재생성 계층의 스키마가 정하는 대로, 체크박스는 체크하지 않은 값(false. 반드시 true여야 하는 체크박스는 비워 둔 것으로 본다)이,
 * 기본값이 있으면 그 값이, null을 받는 필수 필드는 null이 간다.
 */
function blankValueOf(field: FormField): unknown {
  if (field.control.kind === 'checkbox' && !field.control.mustCheck) return false
  if (field.defaultValue !== undefined) return field.defaultValue
  return field.nullable && field.required ? null : undefined
}

/** filled의 필드에 sample을 넣고 나머지는 비워 둔 채 제출하면 보내는 요청 본문 */
function expectedBodyOf(fields: readonly FormField[], filled: readonly FormField[]): Record<string, unknown> {
  return Object.fromEntries(
    fields.flatMap((field) => {
      const value = filled.includes(field) ? field.sample : blankValueOf(field)
      return value === undefined ? [] : [[field.name, value]]
    }),
  )
}

/**
 * 폼이 뮤테이션에 넘기는 값. fetch 함수의 인자는 경로 파라미터, 요청 본문, 쿼리 파라미터 순서(orval)이므로 경로 파라미터 수로
 * 요청 본문 인자를 찾는다. 필수 경로 파라미터는 폼의 props로 받고, 선택 인자(쿼리 파라미터 등)는 넘기지 않는다.
 * mutate에는 mutation Schematic의 훅처럼 인자가 하나면 그 값을, 여럿이면 인자 이름을 키로 한 객체를 넘긴다.
 */
function formArguments(
  operation: Operation,
  fetcher: GeneratedFunction,
): { props: FormProp[]; variables: string; bodyType: string } {
  const bodyIndex = operation.parameters.filter((parameter) => parameter.in === 'path').length
  const body = fetcher.parameters[bodyIndex]
  if (body === undefined) {
    throw new SchematicError(
      `${fetcher.name}에서 요청 본문 인자를 찾지 못했습니다. openapi.yaml을 고쳤다면 npm run api:gen으로 API 계층을 다시 만드세요.`,
    )
  }
  const passed = fetcher.parameters.filter((parameter) => parameter === body || !parameter.optional)
  const props = passed
    .filter((parameter) => parameter !== body)
    .map(({ name, type }) => {
      const sample = PROP_SAMPLES.get(type)
      if (sample === undefined) {
        throw new SchematicError(
          `form Schematic은 숫자, 문자열, 불리언 경로 파라미터만 폼의 props로 받습니다. ${fetcher.name}의 필수 인자 ${name}(${type})는 폼이 넘길 수 없습니다.`,
        )
      }
      return { name, type, sample }
    })
  const variables =
    fetcher.parameters.length === 1
      ? 'values'
      : `{ ${passed.map((parameter) => (parameter === body ? `${parameter.name}: values` : parameter.name)).join(', ')} }`
  return { props, variables, bodyType: body.type }
}

/** 폼 컴포넌트 */
function componentSource(form: FormModel): string {
  const { fields } = form
  const uses = (kind: Control['kind']) => fields.some((field) => field.control.kind === kind)
  const usesRegister = uses('text') || uses('number')
  const usesController = uses('select') || uses('checkbox')
  const fieldParts = [
    'Field',
    ...(fields.some((field) => field.description !== undefined) ? ['FieldDescription'] : []),
    'FieldError',
    ...(usesRegister || uses('checkbox') ? ['FieldLabel'] : []),
  ]
  const imports = [
    ...(usesController ? [`import { Controller } from 'react-hook-form'`] : []),
    `import { ${form.hook.name} } from '${form.hook.moduleSpecifier}'`,
    `import { ${form.schema.name} } from '${form.schema.moduleSpecifier}'`,
    `import { useSchemaForm } from '${SCHEMA_FORM_IMPORT}'`,
    `import { Button } from '@/shared/ui/button'`,
    ...(uses('checkbox') ? [`import { Checkbox } from '@/shared/ui/checkbox'`] : []),
    `import { ${fieldParts.join(', ')} } from '@/shared/ui/field'`,
    ...(usesRegister ? [`import { Input } from '@/shared/ui/input'`] : []),
    ...(uses('select') ? [`import { Select } from '@/shared/ui/select'`] : []),
    `import { useToast } from '@/shared/ui/toast'`,
  ]
  const options = fields.flatMap((field) =>
    field.control.kind === 'select'
      ? [
          `// ${field.name}의 선택지. 레이블은 명세의 enum 값이므로 화면에 맞게 바꾼다.
const ${optionsName(field)} = ${JSON.stringify(field.control.options.map((value) => ({ value, label: value })))}`,
        ]
      : [],
  )
  const skipped =
    form.skippedFields.length === 0
      ? []
      : [
          `// 입력 요소로 만들지 않은 선택 필드: ${form.skippedFields.join(', ')}. 보내야 하면 입력 요소를 직접 더한다.`,
        ]
  const propsName = `${form.componentName}Props`
  const propsInterface =
    form.props.length === 0
      ? []
      : [
          `export interface ${propsName} {
${form.props.map(({ name, type }) => `  /** 요청 경로의 ${name} */\n  ${name}: ${type}`).join('\n')}
}`,
        ]
  const parameters =
    form.props.length === 0 ? '' : `{ ${form.props.map(({ name }) => name).join(', ')} }: ${propsName}`
  const formMethods = [
    ...(usesController ? ['control'] : []),
    ...(usesRegister ? ['register'] : []),
    'handleSubmit',
    'reset',
    'formState: { errors }',
  ]
  const checkboxes = fields.filter((field) => field.control.kind === 'checkbox')
  // 처음 값(defaultValues)은 useSchemaForm이 useForm과 formResolver에 함께 넘긴다.
  const schemaFormArguments =
    checkboxes.length === 0
      ? form.schema.name
      : `${form.schema.name}, {
    // 체크박스는 체크하지 않은 값(false)으로 시작한다. 비워 둔 다른 입력은 formResolver가 명세에 따라 빼거나 null로 보낸다.
    defaultValues: { ${checkboxes.map((field) => `${JSON.stringify(field.name)}: false`).join(', ')} },
  }`

  return `'use client'

${imports.join('\n')}

${[...options, ...skipped, ...propsInterface].map((block) => `${block}\n\n`).join('')}/**
 * ${form.operationId}(${form.submitLabel})의 요청 본문을 입력받아 보내는 폼. 입력 값은 재생성 계층의 요청 본문 스키마(${form.schema.name})로
 * 검증하고, 제출하면 ${form.domainName} Query Domain의 ${form.hook.name}으로 보낸다. 성공하든 실패하든 알림(토스트)으로 알린다.
 * 레이블은 명세의 title(없으면 필드 이름)이다. 문구와 성공한 뒤의 동작(지금은 폼을 비운다)은 화면에 맞게 고친다.${nullableNote(fields)}
 */
export function ${form.componentName}(${parameters}) {
  const {
    ${formMethods.join(',\n    ')},
  } = useSchemaForm(${schemaFormArguments})
  const mutation = ${form.hook.name}()
  const toast = useToast()

  const onSubmit = handleSubmit((values) => {
    mutation.mutate(${form.variables}, {
      onSuccess: () => {
        toast.add({ title: ${JSON.stringify(successTitle(form))} })
        reset()
      },
      onError: () => {
        toast.add({ type: 'error', title: ${JSON.stringify(failureTitle(form))}, description: '잠시 뒤에 다시 시도해 주세요.' })
      },
    })
  })

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(event) => void onSubmit(event)}>
${fields.map((field) => fieldSource(field)).join('\n')}
      <Button type="submit" disabled={mutation.isPending}>
        ${jsxText(form.submitLabel)}
      </Button>
    </form>
  )
}
`
}

/** 폼 컴포넌트의 설명에 더할, 비워 둔 null을 받는 입력(clearableFields)을 보내는 방법. 그런 입력이 없으면 빈 문자열이다. */
function nullableNote(fields: readonly FormField[]): string {
  const namesOf = (required: boolean) =>
    clearableFields(fields)
      .filter((field) => field.required === required)
      .map((field) => field.name)
      .join(', ')
  const requiredNames = namesOf(true)
  const optionalNames = namesOf(false)
  return [
    ...(requiredNames === '' ? [] : [`\n * null을 받는 필수 필드(${requiredNames})는 비워 두면 null을 보낸다.`]),
    ...(optionalNames === ''
      ? []
      : [
          `\n * null을 받는 선택 필드(${optionalNames})는 처음 값이 있던 입력을 비웠을 때만 null을 보내고(값을 지운다), 처음부터 비어 있으면 보내지 않는다.
 * 현재 값을 채워 수정 폼으로 쓰려면 그 값을 useSchemaForm의 defaultValues에 더한다(useForm과 formResolver가 함께 받는다).`,
        ]),
  ].join('')
}

/** 필드 하나의 입력 요소. 레이블과 설명, 오류 메시지를 Field로 묶어 입력 요소의 접근 가능한 이름과 설명으로 잇는다. */
function fieldSource(field: FormField): string {
  const error = `errors${IDENTIFIER.test(field.name) ? `.${field.name}` : `[${JSON.stringify(field.name)}]`}`
  const invalid = `${error} !== undefined`
  const name = JSON.stringify(field.name)
  const description =
    field.description === undefined ? [] : [`<FieldDescription>${jsxText(field.description)}</FieldDescription>`]
  const fieldError = `<FieldError match={${invalid}}>{${error}?.message}</FieldError>`
  const inField = (children: readonly string[]) =>
    `<Field invalid={${invalid}}>\n${[...children, ...description, fieldError].join('\n')}\n</Field>`
  const controller = (children: readonly string[]) =>
    `<Controller control={control} name=${jsxAttribute(field.name)} render={({ field }) => (${inField(children)})} />`

  const label = `<FieldLabel>${jsxText(field.label)}</FieldLabel>`
  switch (field.control.kind) {
    case 'text': {
      const type = field.control.inputType === 'text' ? '' : ` type="${field.control.inputType}"`
      return inField([label, `<Input${type} {...register(${name})} />`])
    }
    case 'number': {
      // 정수가 아닌 숫자는 소수를 입력할 수 있게 step을 풀어 둔다.
      const step = field.control.integer ? '' : ' step="any"'
      return inField([label, `<Input type="number"${step} {...register(${name}, { valueAsNumber: true })} />`])
    }
    case 'select': {
      // null을 받는 필드는 고른 값을 다시 비울 수 있게 맨 앞에 값을 비우는 선택지를 둔다. 고르면 null이 되어 formResolver가 명세대로 보낸다.
      const clear = field.nullable ? ` clearLabel=${jsxAttribute(CLEAR_SELECT_LABEL)}` : ''
      return controller([
        `<Select label=${jsxAttribute(field.label)}${clear} options={${optionsName(field)}} value={field.value ?? null} onValueChange={field.onChange} inputRef={field.ref} />`,
      ])
    }
    case 'checkbox':
      return controller([
        `<FieldLabel>\n<Checkbox checked={field.value ?? false} onCheckedChange={field.onChange} inputRef={field.ref} />\n${jsxText(field.label)}\n</FieldLabel>`,
      ])
  }
}

/** Storybook 스토리. 폼의 모양과, 검증에 실패했을 때의 오류를 보여 주고 둘 다 접근성(axe)을 검사받는다. */
function storySource(form: FormModel): string {
  const check = form.validationCheck
  const args =
    form.props.length === 0 ? '' : `\n  args: { ${form.props.map(({ name, sample }) => `${name}: ${sample}`).join(', ')} },`
  const submit = `await userEvent.click(canvas.getByRole('button', { name: ${JSON.stringify(form.submitLabel)} }))`
  const blankMessage = check?.kind === 'blank' ? blankMessageOf(check.fields[0]) : undefined
  const validationStory = (() => {
    if (check === undefined) return `\n${noValidationCheck('검증 오류 스토리')}\n`
    if (check.kind === 'blank') {
      return `
// 비워 둔 채 제출해 검증 오류를 보여 준다. npm run test:storybook이 오류가 보이는 화면도 접근성(axe)을 검사한다.
export const ValidationErrors: Story = {
  play: async ({ canvas, userEvent }) => {
    ${submit}

    const control = ${controlQuery(check.fields[0], 'canvas')}
    await waitFor(() => expect(control).toHaveAttribute('aria-invalid', 'true'))
    await expect(control).toHaveAccessibleDescription(expect.stringContaining(${blankMessage}))
  },
}
`
    }
    const description =
      check.field.description === undefined ? '\n    await expect(control).toHaveAccessibleDescription()' : ''
    return `
// 검증 규칙에 맞지 않는 값을 넣고 제출해 검증 오류를 보여 준다. npm run test:storybook이 오류가 보이는 화면도 접근성(axe)을 검사한다.
export const ValidationErrors: Story = {
  play: async ({ canvas, userEvent }) => {
    const control = ${controlQuery(check.field, 'canvas')}
    await userEvent.type(control, ${typedText(check.input)})
    ${submit}

    await waitFor(() => expect(control).toHaveAttribute('aria-invalid', 'true'))${description}
  },
}
`
  })()
  return `import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect${check === undefined ? '' : ', waitFor'} } from 'storybook/test'
${blankMessage === undefined ? '' : `import { ${blankMessage} } from '${FORM_RESOLVER_IMPORT}'\n`}import { ${form.componentName} } from './${form.fileName}'

const queryClient = new QueryClient()

const meta = {
  title: '${form.feature.storyTitle}/${form.componentName}',
  component: ${form.componentName},${args}
  // 폼이 뮤테이션 훅을 쓰므로 QueryClient로 감싼다. 스토리는 모양과 검증 오류만 보여 주고, 제출 성공은 테스트(${form.fileName}.test.tsx)가 MSW로 확인한다.
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <Story />
      </QueryClientProvider>
    ),
  ],
} satisfies Meta<typeof ${form.componentName}>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: ${JSON.stringify(form.submitLabel)} })).toBeVisible()
  },
}
${validationStory}`
}

/**
 * 컴포넌트 테스트. 입력한 값이 요청 본문으로 가는지(MSW), 검증에 실패하면 오류를 알리고 보내지 않는지 본다.
 * 비워 두면 null을 보낼 수 있는 입력(clearableFields)이 있으면 필수 입력만 채워 보냈을 때 비워 둔 입력이 어떻게 가는지
 * (null이나 생략)도 본다.
 */
function testSource(form: FormModel): string {
  const check = form.validationCheck
  const filled = form.fields.filter((field) => field.sample !== undefined)
  const requiredInputs = form.fields.filter((field) => field.requiredInput)
  const element = `<${form.componentName}${form.props.map(({ name, sample }) => ` ${name}={${sample}}`).join('')} />`
  const response = form.responseMock === undefined ? '' : `\n      return ${form.responseMock}()`
  const mockImports = [form.mockHandler.name, ...(form.responseMock === undefined ? [] : [form.responseMock])]
  const submit = `await user.click(screen.getByRole('button', { name: ${JSON.stringify(form.submitLabel)} }))`
  // 테스트 사이에는 빈 줄을 하나 둔다. 마지막 테스트(validationTest)는 빈 줄로 시작한다.
  const submitTest = (name: string, inputs: readonly FormField[]) => `test(${JSON.stringify(name)}, async () => {
  const user = userEvent.setup()
  const bodies = receivedBodies()
  renderForm()

  ${[...inputs.flatMap((field) => fillSource(field)), submit].join('\n  ')}

  expect(await screen.findByText(${JSON.stringify(successTitle(form))})).toBeInTheDocument()
  expect(bodies).toEqual([${JSON.stringify(expectedBodyOf(form.fields, inputs))}])
})
`
  const clearable = clearableFields(form.fields)
  const blankTest =
    clearable.length === 0
      ? ''
      : `\n${submitTest(
          clearable.some((field) => field.required)
            ? '비워 둔 입력은 보내지 않고, null을 받는 필수 필드는 null로 보낸다'
            : '비워 둔 입력은 보내지 않는다',
          requiredInputs,
        )}`
  const blankFields = check?.kind === 'blank' ? check.fields : []
  const blankMessages = [...new Set(blankFields.map((field) => blankMessageOf(field)))]
  const validationTest = (() => {
    if (check === undefined) return `\n${noValidationCheck('검증 실패 테스트')}\n`
    if (check.kind === 'blank') {
      const errorChecks = blankMessages.map((message) => {
        const fields = blankFields.filter((field) => blankMessageOf(field) === message)
        const { variable, comment } = BLANK_ERRORS[message]
        return `${comment}
  const ${variable} = new RegExp(RegExp.escape(${message}))
  for (const control of [
    ${fields.map((field) => controlQuery(field, 'screen')).join(',\n    ')},
  ]) {
    expect(control).toHaveAttribute('aria-invalid', 'true')
    expect(control).toHaveAccessibleDescription(${variable})
  }`
      })
      const [only] = blankMessages
      const name = blankMessages.length > 1 || only === undefined ? '비워 두거나 체크하지 않은' : BLANK_ERRORS[only].unfilled
      return `
test('${name} 필수 입력은 보내지 않고, 입력 요소마다 오류를 알린다', async () => {
  const user = userEvent.setup()
  const bodies = receivedBodies()
  renderForm()

  ${submit}

  // 오류 메시지는 입력 요소의 설명(aria-describedby)으로 읽힌다. 명세의 description이 있는 필드는 그 설명과 함께 읽힌다.${errorChecks.join('')}
  expect(bodies).toEqual([])
})
`
    }
    const description =
      check.field.description === undefined
        ? `\n  // 오류 메시지(Zod의 한국어 메시지)는 입력 요소의 설명(aria-describedby)으로 읽힌다.\n  expect(control).toHaveAccessibleDescription()`
        : ''
    return `
test('검증 규칙에 맞지 않는 값은 보내지 않고 오류를 알린다', async () => {
  const user = userEvent.setup()
  const bodies = receivedBodies()
  renderForm()

  const control = ${controlQuery(check.field, 'screen')}
  await user.type(control, ${typedText(check.input)})
  ${submit}

  expect(control).toHaveAttribute('aria-invalid', 'true')${description}
  expect(bodies).toEqual([])
})
`
  })()
  return `import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ${mockImports.join(', ')} } from '${form.mockHandler.moduleSpecifier}'
${blankMessages.length === 0 ? '' : `import { ${blankMessages.toSorted().join(', ')} } from '${FORM_RESOLVER_IMPORT}'\n`}import { server } from '@/shared/mocks/node'
import { ToastProvider } from '@/shared/ui/toast'
import { ${form.componentName} } from './${form.fileName}'

// Rendering Mode static-export에서는 브라우저가 백엔드를 직접 부르므로 그 요청을 MSW가 받도록 켠다. server에서는 이 값을 읽지 않는다.
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_API_MOCKING', 'enabled')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

function renderForm() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ToastProvider>
        ${element}
      </ToastProvider>
    </QueryClientProvider>,
  )
}

/** 폼이 보낸 요청 본문을 모은다. 응답은 생성된 MSW 핸들러가 명세대로 돌려준다. */
function receivedBodies(): unknown[] {
  const bodies: unknown[] = []
  server.use(
    ${form.mockHandler.name}(async ({ request }) => {
      bodies.push(await request.json())${response}
    }),
  )
  return bodies
}

${submitTest('입력한 값을 요청 본문으로 보내고 성공을 알린다', filled)}${blankTest}${validationTest}`
}

/** 테스트가 필드에 sample을 입력하는 문장 */
function fillSource(field: FormField): string[] {
  const control = controlQuery(field, 'screen')
  switch (field.control.kind) {
    case 'text':
    case 'number':
      return [`await user.type(${control}, ${typedText(String(field.sample))})`]
    case 'select':
      return [
        `await user.click(${control})`,
        `await user.click(await screen.findByRole('option', { name: ${JSON.stringify(field.sample)} }))`,
      ]
    case 'checkbox':
      return [`await user.click(${control})`]
  }
}

/** 필드의 입력 요소를 접근 가능한 역할과 이름(레이블)으로 찾는 식 */
function controlQuery(field: FormField, within: 'screen' | 'canvas'): string {
  const role = { text: 'textbox', number: 'spinbutton', select: 'combobox', checkbox: 'checkbox' }[field.control.kind]
  return `${within}.getByRole('${role}', { name: ${JSON.stringify(field.label)} })`
}

/** user-event의 type이 그대로 입력하는 문자열 식. user-event는 중괄호와 대괄호를 특수 키로 읽으므로 두 번 써서 글자로 입력한다. */
function typedText(text: string): string {
  return JSON.stringify(text.replace(/[{[]/g, '$&$&'))
}

function optionsName(field: FormField): string {
  return `${camelCase(splitWords(field.name))}Options`
}

function successTitle(form: FormModel): string {
  return `${form.submitLabel} 완료`
}

function failureTitle(form: FormModel): string {
  return `${form.submitLabel} 실패`
}

// JSX 안의 글자. JSX가 해석하는 문자(중괄호, 꺾쇠, &)나 줄바꿈이 있으면 문자열 식으로 넣는다.
export function jsxText(text: string): string {
  return /[{}<>&\n]/.test(text) ? `{${JSON.stringify(text)}}` : text
}

// JSX 속성 값. 큰따옴표나 줄바꿈이 있으면 문자열 식으로 넣는다.
function jsxAttribute(text: string): string {
  return /["\n]/.test(text) ? `{${JSON.stringify(text)}}` : `"${text}"`
}

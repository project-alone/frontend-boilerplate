import { existsSync, readdirSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join, relative, resolve, sep } from 'node:path'
import SwaggerParser from '@apidevtools/swagger-parser'
import type { OpenAPIV3 } from 'openapi-types'
import { Node, Project, QuoteKind, type SourceFile, type TypeNode } from 'ts-morph'
import { camelCase, splitWords } from './names.js'

// `dcgen g`가 읽고 쓰는 곳. 모두 Starter 최상위(package.json이 있는 디렉터리) 기준이다.
const SPEC_FILE = 'openapi.yaml'
const GENERATED_API_DIR = 'src/shared/api/generated'

/** 재생성 계층의 fetch 함수를 가져오는 경로. orval의 tags-split 결과를 index.ts가 모두 다시 내보낸다. */
export const GENERATED_API_IMPORT = '@/shared/api/generated'

// orval이 만드는 fetch 함수의 인자 이름. 쿼리 파라미터는 객체 하나(params)로, 요청 옵션(signal 등)은 마지막 인자로 받는다.
/** fetch 함수에서 쿼리 파라미터 객체를 받는 인자의 이름 */
export const QUERY_PARAMS_ARGUMENT = 'params'
const REQUEST_OPTIONS_ARGUMENT = 'options'

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] as const

// 확장자 없는 import('./order-summary')가 풀릴 수 있는 모듈 파일의 확장자. 이 가운데 하나라도 있으면 같은 이름의 코드다.
const MODULE_EXTENSIONS = ['.tsx', '.ts', '.d.ts', '.jsx', '.js']

/** Schematic이 사용자에게 알리고 멈추는 문제(없는 operationId, 이미 있는 코드 등). 이 오류로 멈추면 파일은 바뀌지 않는다. */
export class SchematicError extends Error {
  override readonly name = 'SchematicError'
}

/** OpenAPI 명세에서 찾은 operation. `$ref`는 모두 풀려 있다. */
export interface Operation {
  operationId: string
  method: (typeof HTTP_METHODS)[number]
  path: string
  definition: OpenAPIV3.OperationObject
  /** path와 operation에 적힌 파라미터 */
  parameters: OpenAPIV3.ParameterObject[]
}

/** 타입 이름과 그 이름을 가져올 Starter 안의 import 경로 */
export interface TypeImport {
  name: string
  moduleSpecifier: string
}

/** 재생성 계층(orval)이 operation마다 만든 fetch 함수 */
export interface GeneratedFunction {
  name: string
  /** 요청 옵션을 뺀 인자. 순서는 fetch 함수와 같다. */
  parameters: { name: string; type: string; optional: boolean }[]
  /** 인자 타입이 쓰는 이름의 import */
  typeImports: TypeImport[]
  /** fetch 함수가 돌려주는 데이터의 타입(Promise<T>의 T)과 그 타입이 쓰는 이름의 import */
  data: { type: string; typeImports: TypeImport[] }
}

/** 바꾼 파일. path는 Starter 최상위 기준이다. */
export interface ChangedFile {
  path: string
  created: boolean
}

interface Prettier {
  resolveConfig: (file: string, options: { editorconfig: boolean }) => Promise<object | null>
  format: (source: string, options: object) => Promise<string>
}

/**
 * Schematic이 코드를 만들어 넣을 Starter. 모든 Schematic이 같은 순서를 따르고, 명세를 읽지 않는 Schematic(component)은 2, 3을 건너뛴다.
 *
 * 1. `open`: 현재 디렉터리에서 위로 올라가며 package.json이 있는 Starter 최상위를 찾는다.
 * 2. `findOperation`: Starter 최상위의 openapi.yaml에서 operationId로 operation을 찾는다.
 * 3. `generatedFunction`: 생성 코드가 부를 재생성 계층의 fetch 함수를 찾는다(Query Domain은 query-domain.ts).
 * 4. `module`: 코드를 넣을 모듈을 연다(없으면 새로 만든다). 새 파일만 만드는 Schematic은 `newModules`를 쓴다.
 *    이 단계까지는 디스크를 바꾸지 않으므로, 같은 이름의 코드가 이미 있으면 SchematicError를 던져 아무 파일도 바꾸지 않고 멈춘다.
 * 5. `save`: 바뀐 모듈을 모두 Starter의 Prettier로 포맷한 뒤에 쓴다.
 */
export class StarterProject {
  private readonly project = new Project({
    skipAddingFilesFromTsConfig: true,
    manipulationSettings: { quoteKind: QuoteKind.Single },
  })
  private readonly modules = new Map<SourceFile, { path: string; created: boolean }>()

  private constructor(readonly root: string) {}

  static open(cwd: string): StarterProject {
    for (let directory = resolve(cwd); ; directory = dirname(directory)) {
      if (existsSync(join(directory, 'package.json'))) return new StarterProject(directory)
      if (dirname(directory) === directory) {
        throw new SchematicError('package.json을 찾지 못했습니다. dcgen g는 Starter 안에서 실행합니다.')
      }
    }
  }

  async findOperation(operationId: string): Promise<Operation> {
    const specPath = join(this.root, SPEC_FILE)
    if (!existsSync(specPath)) {
      throw new SchematicError(`${specPath} 파일이 없습니다. dcgen g는 Starter 최상위의 ${SPEC_FILE}에서 operation을 찾습니다.`)
    }
    // 명세 버전(3.0, 3.1)과 상관없이 Schematic이 읽는 필드는 같으므로 3.0 타입으로 읽는다.
    const spec = (await SwaggerParser.dereference(specPath)) as OpenAPIV3.Document
    for (const [path, item = {}] of Object.entries(spec.paths)) {
      for (const method of HTTP_METHODS) {
        const definition = item[method]
        if (definition?.operationId !== operationId) continue
        const parameters = [...(item.parameters ?? []), ...(definition.parameters ?? [])]
        return { operationId, method, path, definition, parameters: parameters as OpenAPIV3.ParameterObject[] }
      }
    }
    throw new SchematicError(`${SPEC_FILE}에 operationId가 '${operationId}'인 operation이 없습니다.`)
  }

  generatedFunction(operation: Operation): GeneratedFunction {
    // orval은 operationId를 camelCase로 바꿔 fetch 함수 이름으로 쓴다.
    const name = camelCase(splitWords(operation.operationId))
    for (const file of this.generatedFiles()) {
      const declaration = file.getVariableDeclaration(name) ?? file.getFunction(name)
      if (declaration?.isExported() !== true) continue
      const fn = Node.isVariableDeclaration(declaration) ? declaration.getInitializer() : declaration
      if (!Node.isFunctionLikeDeclaration(fn)) continue

      const parameters = fn.getParameters().filter((parameter) => parameter.getName() !== REQUEST_OPTIONS_ARGUMENT)
      const typeImportsOf = (typeNodes: readonly TypeNode[]): TypeImport[] => {
        const references = typeNodes.flatMap((typeNode) => [typeNode, ...typeNode.getDescendants()])
        const typeNames = references.filter(Node.isTypeReference).map((reference) => reference.getTypeName().getText())
        return [...new Set(typeNames)].flatMap((typeName) => {
          const moduleSpecifier = this.importOf(file, typeName)
          return moduleSpecifier === undefined ? [] : [{ name: typeName, moduleSpecifier }]
        })
      }
      // orval은 fetch 함수의 반환 타입을 Promise<T>로 적는다. 적지 않았으면 함수에서 타입을 끌어낸다.
      const returnType = fn.getReturnTypeNode()
      const dataType = Node.isTypeReference(returnType) && returnType.getTypeName().getText() === 'Promise'
        ? returnType.getTypeArguments()[0]
        : undefined
      return {
        name,
        parameters: parameters.map((parameter) => ({
          name: parameter.getName(),
          type: parameter.getTypeNodeOrThrow().getText(),
          optional: parameter.isOptional(),
        })),
        typeImports: typeImportsOf(parameters.map((parameter) => parameter.getTypeNodeOrThrow())),
        data:
          dataType === undefined
            ? { type: `Awaited<ReturnType<typeof ${name}>>`, typeImports: [] }
            : { type: dataType.getText(), typeImports: typeImportsOf([dataType]) },
      }
    }
    throw new SchematicError(
      `${GENERATED_API_DIR}에 ${operation.operationId}의 fetch 함수(${name})가 없습니다. ${SPEC_FILE}을 고쳤다면 npm run api:gen으로 API 계층을 다시 만드세요.`,
    )
  }

  /** Starter 최상위 기준 src 아래 파일(확장자는 있어도 되고 없어도 된다)의 Starter 안 import 경로(`@/...`) */
  importPath(path: string): string {
    const withoutExtension = path.replace(/\.tsx?$/, '')
    return `@/${relative('src', withoutExtension).split(sep).join('/')}`
  }

  /** 재생성 계층에서 name을 내보내는 모듈의 import 경로(`@/shared/api/generated/...`). 없으면 undefined다. */
  generatedModuleOf(name: string): string | undefined {
    for (const file of this.generatedFiles()) {
      const declaration = file.getVariableDeclaration(name) ?? file.getFunction(name)
      if (declaration?.isExported() === true) return this.importPath(relative(this.root, file.getFilePath()))
    }
    return undefined
  }

  /** Starter 최상위 기준 path의 모듈을 읽기만 한다. 없으면 undefined이고, 이렇게 연 모듈은 save가 쓰지 않는다. */
  existingModule(path: string): SourceFile | undefined {
    return this.project.addSourceFileAtPathIfExists(join(this.root, path))
  }

  /**
   * 새 모듈 여러 개를 함께 만든다. stem은 Starter 최상위 기준의 확장자를 뺀 경로이고, 모듈은 `<stem>.tsx`가 된다.
   * 같은 import 경로로 풀리는 파일(확장자만 다른 파일 포함)이 하나라도 있으면 손으로 쓴 코드일 수 있으므로
   * 있는 파일을 모두 알리는 SchematicError를 던지고 아무 모듈도 만들지 않는다.
   */
  newModules(files: readonly { stem: string; source: string }[]): void {
    const existing = files.flatMap(({ stem }) =>
      MODULE_EXTENSIONS.map((extension) => `${stem}${extension}`).filter((path) => existsSync(join(this.root, path))),
    )
    if (existing.length > 0) {
      throw new SchematicError(
        `같은 이름의 파일이 이미 있어 덮어쓰지 않았습니다. 파일은 만들지 않았습니다.\n${existing.map((path) => `  ${path}`).join('\n')}`,
      )
    }
    for (const { stem, source } of files) this.module(`${stem}.tsx`, source)
  }

  /** Starter 최상위 기준 path의 모듈을 연다. 없으면 initialSource로 새로 만든다. save 전에는 디스크를 바꾸지 않는다. */
  module(path: string, initialSource: string): SourceFile {
    const absolute = join(this.root, path)
    const existing = this.project.addSourceFileAtPathIfExists(absolute)
    const file = existing ?? this.project.createSourceFile(absolute, initialSource)
    this.modules.set(file, { path, created: existing === undefined })
    return file
  }

  /**
   * module로 연 모듈 가운데 바뀐 것을 Starter의 Prettier로 포맷해 쓴다. 생성한 코드가 바로 format:check를 통과하도록,
   * 모두 포맷한 뒤에야 쓰기 시작한다. Prettier가 없거나 포맷에 실패하면 아무 파일도 쓰지 않는다.
   */
  async save(): Promise<ChangedFile[]> {
    const prettier = this.prettier()
    const formatted = []
    for (const [file, { path, created }] of this.modules) {
      if (file.isSaved()) continue
      const absolute = file.getFilePath()
      const options = await prettier.resolveConfig(absolute, { editorconfig: true })
      const text = await prettier.format(file.getFullText(), { ...options, filepath: absolute })
      formatted.push({ absolute, text, path, created })
    }
    for (const { absolute, text } of formatted) {
      await mkdir(dirname(absolute), { recursive: true })
      await writeFile(absolute, text)
    }
    return formatted.map(({ path, created }) => ({ path, created }))
  }

  // Starter 경로에 glob 특수 문자가 있어도 되도록 glob 대신 디렉터리를 직접 읽는다.
  private *generatedFiles(): Generator<SourceFile> {
    const directory = join(this.root, GENERATED_API_DIR)
    if (!existsSync(directory)) return
    for (const path of readdirSync(directory, { recursive: true, encoding: 'utf8' })) {
      if (path.endsWith('.ts')) yield this.project.addSourceFileAtPath(join(directory, path))
    }
  }

  /** file에서 typeName을 가져오는 import를 Starter 안의 경로(`@/...`)로 바꿔 돌려준다. import하지 않은 이름(내장 타입 등)은 undefined다. */
  private importOf(file: SourceFile, typeName: string): string | undefined {
    const declaration = file
      .getImportDeclarations()
      .find((candidate) => candidate.getNamedImports().some((specifier) => specifier.getName() === typeName))
    if (declaration === undefined) return undefined
    const specifier = declaration.getModuleSpecifierValue()
    if (!specifier.startsWith('.')) return specifier
    return this.importPath(relative(this.root, join(dirname(file.getFilePath()), specifier)))
  }

  /** Starter가 설치한 Prettier(Base의 devDependency) */
  private prettier(): Prettier {
    try {
      return createRequire(join(this.root, 'package.json'))('prettier') as Prettier
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'MODULE_NOT_FOUND') {
        throw new SchematicError(`${this.root}에서 Prettier를 찾지 못해 파일을 쓰지 않았습니다. npm install을 먼저 실행하세요.`)
      }
      throw error
    }
  }
}

/**
 * file에 named import를 더한다. 이미 가져오고 있으면 그대로 두고, 같은 경로의 import(type 전용 여부도 같은)가 있으면
 * 거기에 더하고, 없으면 import 문을 새로 더한다.
 */
export function addNamedImport(
  file: SourceFile,
  { name, moduleSpecifier, typeOnly = false }: { name: string; moduleSpecifier: string; typeOnly?: boolean },
): void {
  const declarations = file.getImportDeclarations().filter((d) => d.getModuleSpecifierValue() === moduleSpecifier)
  if (declarations.some((d) => d.getNamedImports().some((specifier) => specifier.getName() === name))) return
  const target = declarations.find((d) => d.isTypeOnly() === typeOnly)
  if (target === undefined) file.addImportDeclaration({ moduleSpecifier, namedImports: [name], isTypeOnly: typeOnly })
  else target.addNamedImport(name)
}

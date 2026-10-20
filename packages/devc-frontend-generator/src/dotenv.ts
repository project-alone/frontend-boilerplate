// 환경 변수 파일(.env, .env.development, .env.example 등)을 변수 단위로 병합한다. 여러 overlay가 같은 파일에 자기 변수를
// 더해도 서로 덮어쓰지 않도록, overlay의 dotenv 파일은 파일을 대신하지 않고 Starter의 같은 파일에 병합한다(overlay.ts).

/** overlay 안에서 병합할 dotenv 파일인지. `.env`와 `.env.<이름>`이다. */
export function isDotenvFile(path: string): boolean {
  return /^(?:.*\/)?\.env(?:\.[\w.-]+)?$/.test(path)
}

// `NAME=값`(앞에 export가 붙어도 된다) 줄
const VARIABLE = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/

/** 빈 줄로 나뉜 문단 안의 항목. 변수는 바로 위의 주석과 한 항목이고, 변수에 붙지 않은 주석은 key가 없다. */
interface Item {
  key: string | undefined
  lines: string[]
}

/**
 * overlay의 dotenv 파일을 base에 병합한 내용을 돌려준다. 변수와 그 바로 위의 주석(빈 줄 없이 붙은 주석)을 한 항목으로 보고,
 * base에 같은 변수가 있으면 그 항목을 그 자리에서 바꾼다(값이 같은지는 findDotenvConflicts로 미리 확인하므로 주석만 바뀐다).
 * 나머지(새 변수와 변수에 붙지 않은 주석)는 overlay의 문단 그대로 base의 끝에 덧붙인다. 같은 문단이 이미 있으면 다시 덧붙이지 않는다.
 */
export function mergeDotenv(base: string, overlay: string): string {
  const paragraphs = parseParagraphs(base)
  const positions = new Map<string, Item>()
  for (const item of paragraphs.flat()) if (item.key !== undefined) positions.set(item.key, item)

  for (const paragraph of parseParagraphs(overlay)) {
    const added = paragraph.filter((item) => {
      const existing = item.key === undefined ? undefined : positions.get(item.key)
      if (existing === undefined) return true
      existing.lines = item.lines
      return false
    })
    const text = render([added])
    if (added.length > 0 && !paragraphs.some((existing) => render([existing]) === text)) {
      paragraphs.push(added)
      for (const item of added) if (item.key !== undefined) positions.set(item.key, item)
    }
  }
  return `${render(paragraphs)}\n`
}

/** Base나 overlay가 담은 dotenv 파일 하나 */
export interface DotenvSource {
  /** 파일을 담은 곳. 오류 메시지에 쓴다(예: 'Base', 'Recipe dark-mode'). */
  label: string
  /** Starter 최상위 기준 경로(예: .env.development) */
  path: string
  text: string
}

/** 같은 dotenv 파일의 같은 변수에 두 곳이 서로 다른 값을 적은 것. first가 먼저 덧입혀진다. */
export interface DotenvConflict {
  path: string
  key: string
  first: { label: string; value: string }
  second: { label: string; value: string }
}

/**
 * 덧입히는 순서(Base, Rendering Mode, Recipe)대로 늘어놓은 dotenv 파일에서, 같은 파일의 같은 변수에 먼저 적힌 값과 다른 값을
 * 적은 곳을 모두 찾는다. 나중 값이 조용히 앞의 값을 덮어쓰면 어느 Recipe의 값이 쓰일지 덧입히는 순서에 달리므로 병합하지 않는다.
 * 값은 dotenv가 읽는 값으로 비교하므로 감싼 따옴표나 값 뒤의 주석만 다른 것은 같은 값이다. 다른 파일(.env.development와
 * .env.production 등)의 같은 변수는 서로 다른 환경의 값이므로 비교하지 않는다.
 */
export function findDotenvConflicts(sources: readonly DotenvSource[]): DotenvConflict[] {
  const defined = new Map<string, { label: string; value: string }>()
  const conflicts: DotenvConflict[] = []
  for (const { label, path, text } of sources) {
    for (const item of parseParagraphs(text).flat()) {
      if (item.key === undefined) continue
      const value = valueOf(item.lines.at(-1) ?? '')
      const id = `${path}\n${item.key}`
      const first = defined.get(id)
      if (first === undefined) defined.set(id, { label, value })
      else if (first.value !== value) conflicts.push({ path, key: item.key, first, second: { label, value } })
    }
  }
  return conflicts
}

// `=` 뒤의 값: 따옴표로 감싼 값은 따옴표 안, 따옴표 없는 값은 `#`(주석) 앞까지에서 앞뒤 공백을 뺀 것. dotenv가 읽는 방법이다.
const VALUE = /^\s*(?:'([^']*)'|"((?:\\"|[^"])*)"|`([^`]*)`|([^#]*))/

/** 변수 줄(`NAME=값`)의 값 */
function valueOf(line: string): string {
  const [, single, double, backtick, bare] = VALUE.exec(line.slice(line.indexOf('=') + 1)) ?? []
  return single ?? double ?? backtick ?? (bare ?? '').trim()
}

function parseParagraphs(text: string): Item[][] {
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n[ \t]*\n/)
    .map((paragraph) => paragraph.split('\n').filter((line) => line.trim() !== ''))
    .filter((lines) => lines.length > 0)
    .map((lines) => {
      const items: Item[] = []
      let pending: string[] = []
      for (const line of lines) {
        const key = VARIABLE.exec(line)?.[1]
        pending.push(line)
        if (key !== undefined) {
          items.push({ key, lines: pending })
          pending = []
        }
      }
      if (pending.length > 0) items.push({ key: undefined, lines: pending })
      return items
    })
}

function render(paragraphs: readonly (readonly Item[])[]): string {
  return paragraphs.map((paragraph) => paragraph.flatMap((item) => item.lines).join('\n')).join('\n\n')
}

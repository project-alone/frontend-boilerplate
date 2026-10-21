import { kebabCase, pascalCase, splitWords } from './names.js'
import { SchematicError } from './starter-project.js'

/** Feature를 두는 폴더. Starter 최상위 기준이다. */
export const FEATURES_DIR = 'src/features'

// 컴포넌트, 폼, Feature의 이름. 영문자로 시작해 영문자·숫자를 하이픈으로 잇는 kebab-case, 또는 PascalCase·camelCase다.
// 폴더 깊이(src/<계층>/<이름>/<파일>, ADR-0005)를 넘지 않도록 경로 구분자는 받지 않는다.
const NAME_PATTERN = /^[A-Za-z][A-Za-z\d]*(?:-[A-Za-z\d]+)*$/

/** Schematic이 코드를 둘 Feature(src/features/<feature>/) */
export interface Feature {
  /** 폴더 이름(kebab-case) */
  name: string
  /** Starter 최상위 기준 폴더 */
  directory: string
  /** Storybook 스토리 제목의 Feature 단계(PascalCase) */
  storyTitle: string
}

/** --feature로 받은 이름의 Feature. 폴더 이름으로 쓸 수 없는 이름이면 SchematicError를 던진다. */
export function featureNamed(name: string): Feature {
  const words = nameWords('Feature', name)
  const folder = kebabCase(words)
  return { name: folder, directory: `${FEATURES_DIR}/${folder}`, storyTitle: `Features/${pascalCase(words)}` }
}

/**
 * kind의 이름을 단어로 나눈다. 파일이나 폴더 이름으로 쓸 수 없는 이름이면 SchematicError를 던진다.
 * names.ts는 SchematicError를 가진 starter-project.ts가 가져다 쓰므로, 서로 가져오지 않도록 여기에 둔다.
 */
export function nameWords(kind: '컴포넌트' | 'Feature', name: string): string[] {
  if (NAME_PATTERN.test(name)) return splitWords(name)
  const folder = /[\\/]/.test(name)
    ? ' 폴더 깊이는 src/<계층>/<이름>/<파일>을 넘지 않으므로(ADR-0005) 하위 폴더는 만들지 않습니다.'
    : ''
  throw new SchematicError(
    `쓸 수 없는 ${kind} 이름입니다: '${name}'. 영문자로 시작하고 영문자, 숫자, 하이픈(-)만 씁니다(예: order-summary, OrderSummary).${folder}`,
  )
}

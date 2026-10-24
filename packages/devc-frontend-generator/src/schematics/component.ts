import { camelCase, kebabCase, pascalCase } from '../utils/names.js'
import { featureNamed, nameWords } from './feature.js'
import { type ChangedFile, SchematicError, StarterProject } from './starter-project.js'

const SHARED_UI_DIR = 'src/shared/ui'

// 공통 UI의 컴포넌트 파일이 가져오는 이름. 컴포넌트나 그 Props 타입의 이름이 이와 같으면 생성한 코드가 컴파일되지 않는다.
const SHARED_UI_NAMES = ['VariantProps', 'ComponentProps', 'WithClassName']

export interface ComponentSchematicOptions {
  /** 컴포넌트를 둘 Feature. src/features/<feature>/에 만든다. */
  feature: string | undefined
  /** 공통 UI(src/shared/ui/)에 만든다. feature와 함께 쓸 수 없다. */
  shared: boolean
}

/**
 * `component` Schematic. 컴포넌트와 테스트를 지정한 Feature 폴더나 공통 UI 폴더에 함께 만든다. 스토리는 story Schematic이 만든다.
 * 둘 곳이나 이름이 맞지 않거나 같은 이름의 모듈이 하나라도 있으면 SchematicError를 던지고 아무 파일도 만들지 않는다.
 */
export async function generateComponent(
  cwd: string,
  name: string,
  options: ComponentSchematicOptions,
): Promise<ChangedFile[]> {
  const words = nameWords('컴포넌트', name)
  // 컴포넌트(PascalCase)와 파일 이름(kebab-case, 확장자 제외)
  const componentName = pascalCase(words)
  const fileName = kebabCase(words)

  // --feature와 --shared 가운데 꼭 하나를 골랐는지 보고, 컴포넌트를 둘 폴더(Starter 최상위 기준)와 그곳의 관례대로 만든
  // 컴포넌트·테스트의 소스 코드를 정한다.
  if (options.feature !== undefined && options.shared) {
    throw new SchematicError('--feature와 --shared는 함께 쓸 수 없습니다. 컴포넌트를 둘 곳을 하나만 고르세요.')
  }
  let directory: string
  let component: string
  let test: string
  if (options.feature !== undefined) {
    // Feature의 컴포넌트는 공통 UI와 Query Domain을 조합하는 평범한 컴포넌트다. 모양을 고르는 변형(cva)은 공통 UI에 둔다.
    const feature = featureNamed(options.feature)
    directory = feature.directory
    component = `export interface ${componentName}Props {
  /** 제목. 자리표시 prop이므로 화면에 맞게 바꾼다. */
  title: string
}

/**
 * ${feature.name} Feature의 컴포넌트. Feature는 공통 UI(@/shared/ui)와 Query Domain의 queryOptions(@/queries)를 조합해 화면을 그린다.
 * 모양은 공통 UI와 디자인 토큰으로 만든 유틸리티로만 정한다.
 */
export function ${componentName}({ title }: ${componentName}Props) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">{title}</h2>
    </section>
  )
}
`
    test = `import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { axeViolations } from '@/shared/a11y/axe-violations'
import { ${componentName} } from './${fileName}'

test('제목을 보여 주고 접근성 위반이 없다', async () => {
  const { container } = render(<${componentName} title="${componentName}" />)

  expect(screen.getByRole('heading', { name: '${componentName}' })).toBeInTheDocument()
  expect(await axeViolations(container)).toEqual([])
})
`
  } else if (options.shared) {
    // 공통 UI의 컴포넌트는 Base의 공통 컴포넌트(button.tsx 등)처럼 모양을 디자인 토큰 유틸리티와 변형(cva)으로 정하고,
    // className은 배치에만 받는다(class-name.ts). 생성하는 코드가 이미 쓰는 이름은 컴포넌트와 Props 타입에 쓸 수 없다.
    const clash = [componentName, `${componentName}Props`].find((identifier) => SHARED_UI_NAMES.includes(identifier))
    if (clash !== undefined) {
      throw new SchematicError(
        `쓸 수 없는 컴포넌트 이름입니다: '${name}'. 생성하는 코드가 쓰는 이름(${clash})과 겹칩니다. 다른 이름을 쓰세요.`,
      )
    }
    // 공통 UI의 변형(cva) 이름
    const variantsName = `${camelCase(words)}Variants`
    directory = SHARED_UI_DIR
    component = `import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import type { WithClassName } from './class-name'

// 모양은 디자인 토큰(tokens.css)으로 만든 유틸리티만 써서 정한다. 모양이 더 필요하면 variants에 변형을 더한다.
export const ${variantsName} = cva('rounded-md border p-4 text-md', {
  variants: {
    variant: {
      default: 'border-border bg-background text-foreground',
      muted: 'border-border bg-muted text-muted-foreground',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
})

export type ${componentName}Props = WithClassName<ComponentProps<'div'>> & VariantProps<typeof ${variantsName}>

/**
 * 공통 UI 컴포넌트. 키보드 조작이나 스크린 리더 지원이 필요한 부품이면 <div> 대신 Base UI(@base-ui/react)의 부품을 감싼다(예: button.tsx).
 */
export function ${componentName}({ variant, className, ...props }: ${componentName}Props) {
  return <div className={${variantsName}({ variant, className })} {...props} />
}
`
    test = `import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { axeViolations } from '@/shared/a11y/axe-violations'
import { ${componentName} } from './${fileName}'

// 변형마다 내용을 보여 주고 접근성 위반이 없는지 본다. 변형을 더하면 여기에도 더한다.
test.each(['default', 'muted'] as const)('%s 변형은 내용을 보여 주고 접근성 위반이 없다', async (variant) => {
  const { container } = render(<${componentName} variant={variant}>${componentName}</${componentName}>)

  expect(screen.getByText('${componentName}')).toBeInTheDocument()
  expect(await axeViolations(container)).toEqual([])
})
`
  } else {
    throw new SchematicError(
      '컴포넌트를 둘 곳을 고르세요: --feature <feature>(src/features/<feature>/) 또는 --shared(src/shared/ui/).',
    )
  }

  const starter = StarterProject.open(cwd)
  // 두 파일의 확장자를 뺀 경로(Starter 최상위 기준)
  const stem = `${directory}/${fileName}`
  // 두 파일은 함께 만든다. 하나라도 이미 있으면 아무 파일도 만들지 않는다.
  starter.newModules([
    { stem, source: component },
    { stem: `${stem}.test`, source: test },
  ])
  return starter.save()
}

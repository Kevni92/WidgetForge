import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

const eslint = new ESLint()

async function lintVirtualFile(filePath: string, code: string) {
  const [result] = await eslint.lintText(code, { filePath, warnIgnored: false })
  return result?.messages ?? []
}

describe('ESLint generated-artifact scope', () => {
  it('ignores nested generated dist and coverage files', async () => {
    const dist = await lintVirtualFile('examples/minimal-consumer/dist/assets/generated.js', 'this is not JavaScript')
    const coverage = await lintVirtualFile('playground/coverage/report.js', 'this is not JavaScript')

    expect(dist).toEqual([])
    expect(coverage).toEqual([])
  })

  it('keeps source files in the lint scope', async () => {
    const source = await lintVirtualFile('examples/minimal-consumer/src/source.ts', 'const unused = 1')

    expect(source.some((message) => message.ruleId === '@typescript-eslint/no-unused-vars')).toBe(true)
  })
})

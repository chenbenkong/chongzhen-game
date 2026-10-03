import { Project, PropertyAssignment, ObjectLiteralExpression, ArrayLiteralExpression, NumericLiteral, SyntaxKind } from 'ts-morph'
import * as path from 'path'
import { fileURLToPath } from 'url'

const project = new Project({
  tsConfigFilePath: path.join(path.dirname(fileURLToPath(import.meta.url)), '../tsconfig.json')
})

// 标签中的简写映射到数据字段名
const TAG_TO_DATA_KEY: Record<string, string> = {
  道德: '道德值',
  欲望: '欲望值',
  野心: '野心值',
  机敏: '机敏值',
  忠诚: '忠诚值',
  // 灰色支线中的旧版状态标签映射到当前五方态度
  商贾: '士绅',
  安全: '中官',
  军事: '国势',
  文化: '清议',
  军心: '国势',
  权势: '圣眷'
}

const eventFiles = project.getSourceFiles('src/data/events/**/*.ts')

const ATTR_KEYS = new Set(['财帛', '文韬', '理政', '武略', '体质'])
const HIDDEN_KEYS = new Set(['道德值', '欲望值', '野心值', '机敏值', '忠诚值'])
const STATE_KEYS = new Set(['圣眷', '中官', '清议', '士绅', '民望', '国势'])

function parseTag(tag: string): { key: string; value: number } | null {
  const match = tag.match(/^(.+?)([+-]\d+)$/)
  if (!match) return null
  return { key: match[1], value: parseInt(match[2], 10) }
}

function getCategory(key: string): 'attributes' | 'hidden' | 'gameState' | null {
  if (ATTR_KEYS.has(key)) return 'attributes'
  if (HIDDEN_KEYS.has(key)) return 'hidden'
  if (STATE_KEYS.has(key)) return 'gameState'
  return null
}

function ensureObjectProperty(obj: ObjectLiteralExpression, name: string): ObjectLiteralExpression {
  let prop = obj.getProperty(name) as PropertyAssignment | undefined
  if (!prop) {
    prop = obj.addPropertyAssignment({ name, initializer: '{}' }) as PropertyAssignment
  }
  const expr = prop.getInitializer()
  if (!expr || expr.getKind() !== SyntaxKind.ObjectLiteralExpression) {
    prop.setInitializer('{}')
    return (prop.getInitializer() as ObjectLiteralExpression)
  }
  return expr as ObjectLiteralExpression
}

function setNumericProperty(obj: ObjectLiteralExpression, key: string, value: number) {
  const existing = obj.getProperty(key) as PropertyAssignment | undefined
  if (existing) {
    const init = existing.getInitializer()
    if (init && init.getKind() === SyntaxKind.NumericLiteral) {
      const current = (init as NumericLiteral).getLiteralValue()
      if (current !== value) {
        existing.setInitializer(String(value))
        return true
      }
      return false
    }
    existing.setInitializer(String(value))
    return true
  }
  obj.addPropertyAssignment({ name: key, initializer: String(value) })
  return true
}

let fileChangeCount = 0
let choiceFixCount = 0

for (const sourceFile of eventFiles) {
  let changed = false
  const filePath = sourceFile.getFilePath()

  // 查找所有 GameEvent 对象字面量
  sourceFile.forEachDescendant(node => {
    if (node.getKind() !== SyntaxKind.ObjectLiteralExpression) return
    const obj = node as ObjectLiteralExpression
    const idProp = obj.getProperty('id') as PropertyAssignment | undefined
    const choicesProp = obj.getProperty('choices') as PropertyAssignment | undefined
    if (!idProp || !choicesProp) return

    const choicesExpr = choicesProp.getInitializer()
    if (!choicesExpr || choicesExpr.getKind() !== SyntaxKind.ArrayLiteralExpression) return
    const choicesArray = choicesExpr as ArrayLiteralExpression

    for (const choiceNode of choicesArray.getElements()) {
      if (choiceNode.getKind() !== SyntaxKind.ObjectLiteralExpression) continue
      const choiceObj = choiceNode as ObjectLiteralExpression

      const resultProp = choiceObj.getProperty('result') as PropertyAssignment | undefined
      if (!resultProp) continue
      const resultExpr = resultProp.getInitializer()
      if (!resultExpr || resultExpr.getKind() !== SyntaxKind.ObjectLiteralExpression) continue
      const resultObj = resultExpr as ObjectLiteralExpression

      const tagsProp = resultObj.getProperty('tags') as PropertyAssignment | undefined
      if (!tagsProp) continue
      const tagsExpr = tagsProp.getInitializer()
      if (!tagsExpr || tagsExpr.getKind() !== SyntaxKind.ArrayLiteralExpression) continue
      const tagsArray = tagsExpr as ArrayLiteralExpression

      const effectsProp = choiceObj.getProperty('effects') as PropertyAssignment | undefined
      if (!effectsProp) continue
      const effectsExpr = effectsProp.getInitializer()
      if (!effectsExpr || effectsExpr.getKind() !== SyntaxKind.ObjectLiteralExpression) continue
      const effectsObj = effectsExpr as ObjectLiteralExpression

      // 先汇总所有标签的期望值（多个标签可能映射到同一数据字段）
      const tagTotals = new Map<string, { category: 'attributes' | 'hidden' | 'gameState'; value: number }>()
      for (const tagNode of tagsArray.getElements()) {
        const tagText = tagNode.getText().replace(/['"]/g, '')
        const parsed = parseTag(tagText)
        if (!parsed) continue
        const dataKey = TAG_TO_DATA_KEY[parsed.key] ?? parsed.key
        const category = getCategory(dataKey)
        if (!category) continue

        const existing = tagTotals.get(dataKey)
        if (existing) {
          existing.value += parsed.value
        } else {
          tagTotals.set(dataKey, { category, value: parsed.value })
        }
      }

      // 将汇总后的期望值写入 effects
      for (const [dataKey, { category, value }] of tagTotals) {
        const categoryObj = ensureObjectProperty(effectsObj, category)
        const didChange = setNumericProperty(categoryObj, dataKey, value)
        if (didChange) {
          changed = true
          choiceFixCount++
        }
      }
    }
  })

  if (changed) {
    sourceFile.saveSync()
    fileChangeCount++
  }
}

console.log(`已修复 ${choiceFixCount} 处标签/效果不一致，涉及 ${fileChangeCount} 个文件。`)

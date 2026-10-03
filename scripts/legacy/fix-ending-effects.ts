import { Project, PropertyAssignment, ObjectLiteralExpression, ArrayLiteralExpression, SyntaxKind } from 'ts-morph'
import * as path from 'path'
import { fileURLToPath } from 'url'

const project = new Project({
  tsConfigFilePath: path.join(path.dirname(fileURLToPath(import.meta.url)), '../tsconfig.json')
})

const endingFiles = project.getSourceFiles('src/data/events/ending/**/*.ts')

let fileChangeCount = 0
let choiceFixCount = 0

for (const sourceFile of endingFiles) {
  let changed = false

  sourceFile.forEachDescendant(node => {
    if (node.getKind() !== SyntaxKind.ObjectLiteralExpression) return
    const obj = node as ObjectLiteralExpression

    const idProp = obj.getProperty('id') as PropertyAssignment | undefined
    const typeProp = obj.getProperty('type') as PropertyAssignment | undefined
    const choicesProp = obj.getProperty('choices') as PropertyAssignment | undefined
    if (!idProp || !typeProp || !choicesProp) return

    const typeExpr = typeProp.getInitializer()
    if (!typeExpr || typeExpr.getText().replace(/['"]/g, '') !== 'ending') return

    const choicesExpr = choicesProp.getInitializer()
    if (!choicesExpr || choicesExpr.getKind() !== SyntaxKind.ArrayLiteralExpression) return
    const choicesArray = choicesExpr as ArrayLiteralExpression

    for (const choiceNode of choicesArray.getElements()) {
      if (choiceNode.getKind() !== SyntaxKind.ObjectLiteralExpression) continue
      const choiceObj = choiceNode as ObjectLiteralExpression

      const effectsProp = choiceObj.getProperty('effects') as PropertyAssignment | undefined
      if (!effectsProp) continue
      const effectsExpr = effectsProp.getInitializer()
      if (!effectsExpr || effectsExpr.getKind() !== SyntaxKind.ObjectLiteralExpression) continue
      const effectsObj = effectsExpr as ObjectLiteralExpression

      // 跳过已经包含 special: ending 的选项
      const specialProp = effectsObj.getProperty('special') as PropertyAssignment | undefined
      if (specialProp) continue

      // 跳过效果非空的对象（保留反事实/升级分支的原有效果）
      const props = effectsObj.getProperties()
      if (props.length > 0) continue

      effectsObj.addPropertyAssignment({
        name: 'special',
        initializer: "{ type: 'ending' }"
      })
      changed = true
      choiceFixCount++
    }
  })

  if (changed) {
    sourceFile.saveSync()
    fileChangeCount++
  }
}

console.log(`已为 ${choiceFixCount} 个结局主选项添加 special: { type: 'ending' }，涉及 ${fileChangeCount} 个文件。`)

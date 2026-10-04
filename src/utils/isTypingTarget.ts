/**
 * 判断键盘事件的来源是否是"玩家正在输入"。
 *
 * 这是所有全局快捷键的第一道闸门：取名、填籍贯、在 AI 面板里填 Key 时，
 * 按 `1` / 空格 / `s` 必须是输入内容，不能被游戏快捷键截走。
 *
 * 除了 input / textarea / select，还要覆盖 `contenteditable`
 * —— 事件文本里有不少可编辑区域（如可编辑的日记类输入），
 * 只判断标签名会漏掉。
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') return false
  const el = target as HTMLElement

  const tag = (el.tagName || '').toUpperCase()
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true

  // contenteditable：元素自身或祖先带该属性都算
  if (el.isContentEditable === true) return true
  const editableParent = el.closest?.('[contenteditable="true"], [contenteditable=""]')
  if (editableParent) return true

  return false
}
const fs = require('fs')
const f = 'c:/Users/moli/Desktop/Trae/chongzhen-game/src/components/CheatMode.tsx'
let c = fs.readFileSync(f, 'utf8')
// Fix line 762 - replace the garbled notice text
c = c.replace(/cheat-ghost-notice[\s\S]*?结局图鉴[\s\S]*?自动触发/, 'cheat-ghost-notice">\n              🏁 结局图鉴：双击结局卡片可查看完整详情（叙事 + 选择 + 回音），结局由游戏系统根据属性/选择自动触发')
fs.writeFileSync(f, c, 'utf8')
console.log('Fixed!')

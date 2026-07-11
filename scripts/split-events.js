const fs = require('fs');
const path = require('path');

// 读取原始文件
const eventsFile = fs.readFileSync(
  path.join(__dirname, '../src/data/events.ts'),
  'utf-8'
);

// 提取 import 语句
const importMatch = eventsFile.match(/import.*?from.*?;\n/);
const importStatement = importMatch ? importMatch[0] : "import { GameEvent } from '../types/event'\n";

// 提取 initialEvents 数组内容
const initialEventsMatch = eventsFile.match(
  /export const initialEvents: GameEvent\[\] = ([\s\S]*?)(?=export const allEndingEvents)/
);

if (!initialEventsMatch) {
  console.error('Could not find initialEvents array');
  process.exit(1);
}

const initialEventsContent = initialEventsMatch[1];

// 解析事件对象
// 使用正则匹配每个事件对象
const eventRegex = /{\s*id:\s*['"]([^'"]+)['"],\s*title:\s*['"]([^'"]+)['"][\s\S]*?type:\s*['"]([^'"]+)['"]\s*}/g;

const events = [];
let match;

// 由于正则无法完美匹配嵌套对象，我们改用另一种方法
// 找到每个事件的开始和结束位置
const eventStartRegex = /{\s*\/\/\s*=+\s*\n\s*\/\/\s*(节点\d+：)?[^\n]+\s*\n\s*\/\/\s*=+/g;

// 更简单的方法：按事件ID分割
const lines = initialEventsContent.split('\n');
let currentEvent = [];
let currentEventId = null;
let currentEventYear = null;
let currentEventType = null;
let braceCount = 0;
let inEvent = false;

const historicalEvents = {};
const transitionEvents = {};

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // 检测事件开始
  if (line.includes("id: 'historical_") || line.includes("id: 'transition_")) {
    // 保存之前的事件
    if (currentEventId && currentEvent.length > 0) {
      const eventData = {
        id: currentEventId,
        year: currentEventYear,
        type: currentEventType,
        content: currentEvent.join('\n')
      };
      
      if (currentEventType === 'historical') {
        if (!historicalEvents[currentEventYear]) {
          historicalEvents[currentEventYear] = [];
        }
        historicalEvents[currentEventYear].push(eventData);
      } else if (currentEventType === 'transition') {
        if (!transitionEvents[currentEventYear]) {
          transitionEvents[currentEventYear] = [];
        }
        transitionEvents[currentEventYear].push(eventData);
      }
    }
    
    // 开始新事件
    inEvent = true;
    braceCount = 0;
    currentEvent = [line];
    
    // 提取ID
    const idMatch = line.match(/id:\s*['"]([^'"]+)['"]/);
    currentEventId = idMatch ? idMatch[1] : null;
    
    // 提取类型
    currentEventType = line.includes("historical_") ? 'historical' : 'transition';
    
    // 从conditions中找年份
    currentEventYear = null;
    for (let j = i + 1; j < Math.min(i + 30, lines.length); j++) {
      const yearMatch = lines[j].match(/year:\s*{\s*min:\s*(\d+)/);
      if (yearMatch) {
        currentEventYear = parseInt(yearMatch[1]);
        break;
      }
    }
    
    // 计算大括号
    braceCount += (line.match(/{/g) || []).length;
    braceCount -= (line.match(/}/g) || []).length;
    
    continue;
  }
  
  if (inEvent) {
    currentEvent.push(line);
    
    // 计算大括号
    braceCount += (line.match(/{/g) || []).length;
    braceCount -= (line.match(/}/g) || []).length;
    
    // 检测事件结束
    if (braceCount === 0 && line.includes('type:')) {
      inEvent = false;
      
      // 保存当前事件
      if (currentEventId && currentEvent.length > 0) {
        const eventData = {
          id: currentEventId,
          year: currentEventYear,
          type: currentEventType,
          content: currentEvent.join('\n')
        };
        
        if (currentEventType === 'historical') {
          if (!historicalEvents[currentEventYear]) {
            historicalEvents[currentEventYear] = [];
          }
          historicalEvents[currentEventYear].push(eventData);
        } else if (currentEventType === 'transition') {
          if (!transitionEvents[currentEventYear]) {
            transitionEvents[currentEventYear] = [];
          }
          transitionEvents[currentEventYear].push(eventData);
        }
      }
      
      currentEvent = [];
      currentEventId = null;
      currentEventYear = null;
      currentEventType = null;
    }
  }
}

// 处理最后一个事件
if (currentEventId && currentEvent.length > 0 && inEvent) {
  const eventData = {
    id: currentEventId,
    year: currentEventYear,
    type: currentEventType,
    content: currentEvent.join('\n')
  };
  
  if (currentEventType === 'historical') {
    if (!historicalEvents[currentEventYear]) {
      historicalEvents[currentEventYear] = [];
    }
    historicalEvents[currentEventYear].push(eventData);
  } else if (currentEventType === 'transition') {
    if (!transitionEvents[currentEventYear]) {
      transitionEvents[currentEventYear] = [];
    }
    transitionEvents[currentEventYear].push(eventData);
  }
}

console.log('Historical events by year:', Object.keys(historicalEvents));
console.log('Transition events by year:', Object.keys(transitionEvents));

// 创建输出目录
const baseDir = path.join(__dirname, '../src/data/events');

// 写入历史事件文件
Object.entries(historicalEvents).forEach(([year, events]) => {
  const filePath = path.join(baseDir, 'historical', `${year}.ts`);
  const content = `${importStatement}
export const events${year}: GameEvent[] = [
${events.map(e => e.content).join(',\n')}
];
`;
  fs.writeFileSync(filePath, content);
  console.log(`Created: ${filePath}`);
});

// 写入过渡事件文件
Object.entries(transitionEvents).forEach(([year, events]) => {
  const filePath = path.join(baseDir, 'transition', `${year}.ts`);
  const content = `${importStatement}
export const events${year}: GameEvent[] = [
${events.map(e => e.content).join(',\n')}
];
`;
  fs.writeFileSync(filePath, content);
  console.log(`Created: ${filePath}`);
});

// 创建索引文件
const historicalImports = Object.keys(historicalEvents)
  .sort()
  .map(year => `import { events${year} } from './historical/${year}'`)
  .join('\n');

const transitionImports = Object.keys(transitionEvents)
  .sort()
  .map(year => `import { events${year} } from './transition/${year}'`)
  .join('\n');

const historicalArray = Object.keys(historicalEvents)
  .sort()
  .map(year => `...events${year}`)
  .join(',\n  ');

const transitionArray = Object.keys(transitionEvents)
  .sort()
  .map(year => `...events${year}`)
  .join(',\n  ');

const indexContent = `${importStatement}
${historicalImports}
${transitionImports}

// 核心历史事件
export const historicalEvents: GameEvent[] = [
  ${historicalArray}
];

// 过渡事件
export const transitionEvents: GameEvent[] = [
  ${transitionArray}
];

// 所有初始事件（按时间顺序合并）
export const initialEvents: GameEvent[] = [
  ...historicalEvents,
  ...transitionEvents
];

// 结局事件（待实现）
export const allEndingEvents: GameEvent[] = [];

// 灰色选择事件（待实现）
export const allGrayChoiceEvents: GameEvent[] = [];
`;

fs.writeFileSync(path.join(baseDir, 'index.ts'), indexContent);
console.log(`Created: ${path.join(baseDir, 'index.ts')}`);

console.log('\nSplit complete!');

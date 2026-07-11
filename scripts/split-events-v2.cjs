const fs = require('fs');
const path = require('path');

// 读取原始文件
const eventsFile = fs.readFileSync(
  path.join(__dirname, '../src/data/events.ts'),
  'utf-8'
);

// 提取 import 语句
const importStatement = "import { GameEvent } from '../../types/event'";

// 提取 initialEvents 数组内容
const initialEventsMatch = eventsFile.match(
  /export const initialEvents: GameEvent\[\] = ([\s\S]*?)(?=export const allEndingEvents)/
);

if (!initialEventsMatch) {
  console.error('Could not find initialEvents array');
  process.exit(1);
}

const initialEventsContent = initialEventsMatch[1].trim();

// 找到所有事件的位置
const events = [];
let depth = 0;
let inEvent = false;
let eventStart = 0;
let braceCount = 0;

for (let i = 0; i < initialEventsContent.length; i++) {
  const char = initialEventsContent[i];
  
  if (char === '{') {
    if (braceCount === 0) {
      // 事件开始
      eventStart = i;
      inEvent = true;
    }
    braceCount++;
  } else if (char === '}') {
    braceCount--;
    if (braceCount === 0 && inEvent) {
      // 事件结束
      const eventContent = initialEventsContent.substring(eventStart, i + 1);
      events.push(eventContent);
      inEvent = false;
    }
  }
}

console.log(`Found ${events.length} events`);

// 解析每个事件，提取ID、年份和类型
const parsedEvents = events.map(eventContent => {
  // 提取ID
  const idMatch = eventContent.match(/id:\s*['"]([^'"]+)['"]/);
  const id = idMatch ? idMatch[1] : 'unknown';
  
  // 提取类型
  const type = id.includes('historical_') ? 'historical' : 
               id.includes('transition_') ? 'transition' : 'other';
  
  // 提取年份
  let year = null;
  const yearMatch = eventContent.match(/year:\s*{\s*min:\s*(\d+)/);
  if (yearMatch) {
    year = parseInt(yearMatch[1]);
  }
  
  // 如果找不到年份，从ID推断
  if (!year) {
    const yearFromId = id.match(/(\d{4})/);
    if (yearFromId) {
      year = parseInt(yearFromId[1]);
    }
  }
  
  // 默认年份
  if (!year) {
    year = 1628;
  }
  
  return {
    id,
    type,
    year,
    content: eventContent
  };
});

// 按类型和年份分组
const historicalEvents = {};
const transitionEvents = {};

parsedEvents.forEach(event => {
  if (event.type === 'historical') {
    if (!historicalEvents[event.year]) {
      historicalEvents[event.year] = [];
    }
    historicalEvents[event.year].push(event);
  } else if (event.type === 'transition') {
    if (!transitionEvents[event.year]) {
      transitionEvents[event.year] = [];
    }
    transitionEvents[event.year].push(event);
  }
});

console.log('Historical events by year:', Object.keys(historicalEvents).sort());
console.log('Transition events by year:', Object.keys(transitionEvents).sort());

// 统计事件数量
let historicalCount = 0;
Object.values(historicalEvents).forEach(arr => {
  historicalCount += arr.length;
});

let transitionCount = 0;
Object.values(transitionEvents).forEach(arr => {
  transitionCount += arr.length;
});

console.log(`Total historical events: ${historicalCount}`);
console.log(`Total transition events: ${transitionCount}`);

// 创建输出目录
const baseDir = path.join(__dirname, '../src/data/events');

// 确保目录存在
['historical', 'transition', 'ending', 'gray'].forEach(dir => {
  const dirPath = path.join(baseDir, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
});

// 写入历史事件文件
Object.entries(historicalEvents).forEach(([year, events]) => {
  const filePath = path.join(baseDir, 'historical', `${year}.ts`);
  const content = `${importStatement}

export const events${year}: GameEvent[] = [
${events.map(e => e.content).join(',\n\n')}
];
`;
  fs.writeFileSync(filePath, content);
  console.log(`Created: ${filePath} (${events.length} events)`);
});

// 写入过渡事件文件
Object.entries(transitionEvents).forEach(([year, events]) => {
  const filePath = path.join(baseDir, 'transition', `${year}.ts`);
  const content = `${importStatement}

export const events${year}: GameEvent[] = [
${events.map(e => e.content).join(',\n\n')}
];
`;
  fs.writeFileSync(filePath, content);
  console.log(`Created: ${filePath} (${events.length} events)`);
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

const indexContent = `import { GameEvent } from '../types/event'
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

console.log('\n✅ Split complete!');

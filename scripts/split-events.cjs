const fs = require('fs');
const path = require('path');

// 读取原始文件
const eventsFile = fs.readFileSync(
  path.join(__dirname, '../src/data/events.ts'),
  'utf-8'
);

// 提取 import 语句
const importMatch = eventsFile.match(/import.*?from.*?;\n/);
const importStatement = importMatch ? importMatch[0] : "import { GameEvent } from '../../types/event'\n";

// 提取 initialEvents 数组内容
const initialEventsMatch = eventsFile.match(
  /export const initialEvents: GameEvent\[\] = ([\s\S]*?)(?=export const allEndingEvents)/
);

if (!initialEventsMatch) {
  console.error('Could not find initialEvents array');
  process.exit(1);
}

const initialEventsContent = initialEventsMatch[1];

// 按行解析，找到每个事件
const lines = initialEventsContent.split('\n');
let currentEvent = [];
let currentEventId = null;
let currentEventYear = null;
let currentEventType = null;
let braceCount = 0;
let inEvent = false;
let eventStarted = false;

const historicalEvents = {};
const transitionEvents = {};

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // 检测事件开始 - 通过 id 字段
  if (line.trim().startsWith("id: '")) {
    // 如果已经有事件在处理，先保存它
    if (currentEventId && currentEvent.length > 0 && eventStarted) {
      // 找到最后一个type行，补全事件
      let eventContent = currentEvent.join('\n');
      
      const eventData = {
        id: currentEventId,
        year: currentEventYear,
        type: currentEventType,
        content: eventContent
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
    eventStarted = true;
    inEvent = true;
    braceCount = 0;
    currentEvent = [];
    
    // 提取ID
    const idMatch = line.match(/id:\s*['"]([^'"]+)['"]/);
    currentEventId = idMatch ? idMatch[1] : null;
    
    // 提取类型
    currentEventType = line.includes("historical_") ? 'historical' : 
                       line.includes("transition_") ? 'transition' : null;
    
    // 从conditions中找年份
    currentEventYear = null;
    for (let j = i + 1; j < Math.min(i + 30, lines.length); j++) {
      const yearMatch = lines[j].match(/year:\s*{\s*min:\s*(\d+)/);
      if (yearMatch) {
        currentEventYear = parseInt(yearMatch[1]);
        break;
      }
    }
    
    // 如果找不到年份，尝试从ID推断
    if (!currentEventYear && currentEventId) {
      const yearFromId = currentEventId.match(/(\d{4})/);
      if (yearFromId) {
        currentEventYear = parseInt(yearFromId[1]);
      }
    }
    
    // 默认年份
    if (!currentEventYear) {
      currentEventYear = 1628;
    }
  }
  
  if (eventStarted) {
    currentEvent.push(line);
    
    // 检测事件结束 - 通过 type: 'xxx' 行
    if (line.trim().match(/^type:\s*['"](historical|transition|ending)['"]\s*,?\s*$/)) {
      // 事件结束
      const eventContent = currentEvent.join('\n');
      
      const eventData = {
        id: currentEventId,
        year: currentEventYear,
        type: currentEventType,
        content: eventContent
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
      
      // 重置
      currentEvent = [];
      currentEventId = null;
      currentEventYear = null;
      currentEventType = null;
      eventStarted = false;
      inEvent = false;
    }
  }
}

// 处理最后一个事件
if (currentEventId && currentEvent.length > 0 && eventStarted) {
  const eventContent = currentEvent.join('\n');
  
  const eventData = {
    id: currentEventId,
    year: currentEventYear,
    type: currentEventType,
    content: eventContent
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
if (!fs.existsSync(path.join(baseDir, 'historical'))) {
  fs.mkdirSync(path.join(baseDir, 'historical'), { recursive: true });
}
if (!fs.existsSync(path.join(baseDir, 'transition'))) {
  fs.mkdirSync(path.join(baseDir, 'transition'), { recursive: true });
}

// 写入历史事件文件
Object.entries(historicalEvents).forEach(([year, events]) => {
  const filePath = path.join(baseDir, 'historical', `${year}.ts`);
  const content = `${importStatement}
export const events${year}: GameEvent[] = [
${events.map(e => e.content).join(',\n')}
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
${events.map(e => e.content).join(',\n')}
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

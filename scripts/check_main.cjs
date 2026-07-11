// 抓 main.tsx 编译产物看是否有错误
const http = require('http');

function fetch(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

(async () => {
  // 看 main.tsx
  const main = await fetch('http://localhost:5173/src/main.tsx');
  console.log('main.tsx:', main.status, 'len=', main.body.length);
  console.log('前 500 字符:\n', main.body.slice(0, 500));
  if (main.body.length > 500) {
    console.log('\n后 500 字符:\n', main.body.slice(-500));
  }

  // 找 React 渲染入口
  const idx = main.body.indexOf('createRoot');
  if (idx >= 0) {
    console.log('\n=== createRoot 上下文 ===');
    console.log(main.body.slice(Math.max(0, idx-100), idx+300));
  }

  // 看 App.tsx 编译产物中 BGM 按钮 + ErrorBoundary 包装顺序
  const app = await fetch('http://localhost:5173/src/App.tsx');
  const wrapperIdx = app.body.indexOf('BGMProvider');
  console.log('\n=== BGMProvider 包裹顺序 ===');
  console.log(app.body.slice(Math.max(0, wrapperIdx-300), wrapperIdx+800));

  // 检查 useBGM 钩子
  const usebgm = await fetch('http://localhost:5173/src/components/BGMContext.tsx');
  const useIdx = usebgm.body.indexOf('useBGM');
  console.log('\n=== useBGM 编译 ===');
  console.log(usebgm.body.slice(useIdx, useIdx + 500));
})();

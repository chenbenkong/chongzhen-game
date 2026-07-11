// 提取 App.tsx 编译产物里 BGMFixedButton 实际使用的位置
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
  const app = await fetch('http://localhost:5173/src/App.tsx');

  // 找所有 BGMFixedButton 出现的位置
  let i = 0;
  let count = 0;
  while ((i = app.body.indexOf('BGMFixedButton', i + 1)) >= 0) {
    count++;
    const ctx = app.body.slice(Math.max(0, i - 50), Math.min(app.body.length, i + 80));
    console.log(`[${count}] 位置 ${i}: ...${ctx.replace(/\n/g, '\\n')}...`);
  }
  console.log(`\n总共 BGMFixedButton 出现 ${count} 次`);

  // 看 title-screen 内的 JSX
  const titleIdx = app.body.indexOf('title-screen');
  if (titleIdx >= 0) {
    const snippet = app.body.slice(titleIdx, titleIdx + 1500);
    console.log('\n=== title-screen JSX 编译后片段 ===');
    console.log(snippet);
  }
})();

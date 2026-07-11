const http = require('http');
function fetch(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

(async () => {
  const ab = await fetch('http://localhost:5173/src/components/ActionBar.tsx');
  // 找 React 或 __vite__cjsImport
  console.log('=== 找 React/__vite__cjsImport 出现 ===');
  let i = 0;
  let count = 0;
  while ((i = ab.indexOf('React', i + 1)) >= 0) {
    count++;
    console.log(`位置 ${i}:`, ab.slice(Math.max(0, i-100), i+200));
    if (count > 5) break;
  }
  console.log('React 出现次数:', count);

  console.log('\n=== 找 __vite__cjsImport ===');
  i = 0;
  count = 0;
  while ((i = ab.indexOf('__vite__cjsImport', i + 1)) >= 0) {
    count++;
    console.log(`位置 ${i}:`, ab.slice(Math.max(0, i-50), i+150));
    if (count > 5) break;
  }
  console.log('__vite__cjsImport 出现次数:', count);
})();

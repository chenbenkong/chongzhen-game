// 对比 ActionBar 和 StatusBar 编译产物的 memo import
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
  const sb = await fetch('http://localhost:5173/src/components/StatusBar.tsx');

  // 找 import memo 上下文
  console.log('=== ActionBar memo import ===');
  const abMemo = ab.indexOf('"memo"');
  if (abMemo > 0) {
    console.log(ab.slice(Math.max(0, abMemo-300), abMemo+100));
  }

  console.log('\n=== StatusBar memo import ===');
  const sbMemo = sb.indexOf('"memo"');
  if (sbMemo > 0) {
    console.log(sb.slice(Math.max(0, sbMemo-300), sbMemo+100));
  }

  // 找调用 memo 的位置
  console.log('\n=== ActionBar memo() 调用 ===');
  const abCall = ab.indexOf('memo(');
  if (abCall > 0) {
    console.log(ab.slice(Math.max(0, abCall-100), abCall+200));
  }
})();

// 看 ActionBar.tsx 编译产物
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
  const r = await fetch('http://localhost:5173/src/components/ActionBar.tsx');
  console.log('ActionBar.tsx status:', r.status, 'len:', r.body.length);
  // 找 memo 和 default
  const memoIdx = r.body.indexOf('memo');
  if (memoIdx >= 0) {
    console.log('memo 出现位置:', memoIdx);
    console.log('  上下文:', r.body.slice(Math.max(0, memoIdx-50), memoIdx+200));
  } else {
    console.log('memo 没找到');
  }
  const defIdx = r.body.indexOf('export default');
  console.log('export default 位置:', defIdx);
  if (defIdx >= 0) {
    console.log('  上下文:', r.body.slice(Math.max(0, defIdx-100), defIdx+200));
  }
  // 最后 200 字符
  console.log('\n最后 500 字符:\n', r.body.slice(-500));
})();

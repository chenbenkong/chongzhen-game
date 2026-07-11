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
  const sb = await fetch('http://localhost:5173/src/components/StatusBar.tsx');
  console.log('StatusBar.tsx 长度:', sb.length);
  console.log('前 1500 字符:');
  console.log(sb.slice(0, 1500));

  // 找 memo 关键字
  let i = 0;
  while ((i = sb.indexOf('memo', i + 1)) >= 0) {
    console.log(`\n位置 ${i}:`, sb.slice(Math.max(0, i-50), i+150));
    if (i > 5000) break;
  }
})();

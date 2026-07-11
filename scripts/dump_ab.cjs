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
  // 输出完整文件
  console.log('=== ActionBar.tsx 完整编译产物 ===');
  console.log(ab);
})();

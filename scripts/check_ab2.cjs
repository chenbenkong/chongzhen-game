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
  console.log('=== ActionBar.tsx 前 800 字符 ===');
  console.log(ab.slice(0, 800));
})();

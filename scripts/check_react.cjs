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
  // 先 fetch 一下 react.js deps
  const r = await fetch('http://localhost:5173/node_modules/.vite/deps/react.js?v=6f5dbdab');
  console.log('react.js status: 200, len:', r.length);
  console.log('前 1500 字符:');
  console.log(r.slice(0, 1500));
  console.log('\n后 500 字符:');
  console.log(r.slice(-500));
})();

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
  const r = await fetch('http://localhost:5173/node_modules/.vite/deps/chunk-REFQX4J5.js?v=6f5dbdab');
  console.log('chunk 长度:', r.length);
  console.log(r);
})();

// 验证 Vite 编译产物 + 检查 BGM 按钮是否被加载
const http = require('http');

function fetch(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data, headers: res.headers }));
    }).on('error', reject);
  });
}

(async () => {
  console.log('=== Vite 5173 健康检查 ===');
  const root = await fetch('http://localhost:5173/');
  console.log('GET /:', root.status, 'len=', root.body.length);

  console.log('\n=== BGM.tsx 编译产物 ===');
  const bgm = await fetch('http://localhost:5173/src/components/BGM.tsx');
  console.log('GET BGM.tsx:', bgm.status, 'len=', bgm.body.length);
  console.log('前 200 字符:', bgm.body.slice(0, 200));

  console.log('\n=== BGMContext.tsx 编译产物 ===');
  const bgmctx = await fetch('http://localhost:5173/src/components/BGMContext.tsx');
  console.log('GET BGMContext.tsx:', bgmctx.status, 'len=', bgmctx.body.length);
  console.log('前 200 字符:', bgmctx.body.slice(0, 200));

  console.log('\n=== App.tsx 编译产物 ===');
  const app = await fetch('http://localhost:5173/src/App.tsx');
  console.log('GET App.tsx:', app.status, 'len=', app.body.length);
  // 找 BGMFixedButton
  const idx = app.body.indexOf('BGMFixedButton');
  console.log('BGMFixedButton 在 App.tsx 编译产物中的位置:', idx);
  if (idx >= 0) {
    console.log('  上下文:', app.body.slice(Math.max(0, idx-100), idx+200));
  }

  console.log('\n=== App.css ===');
  const css = await fetch('http://localhost:5173/src/App.css');
  console.log('GET App.css:', css.status, 'len=', css.body.length);
  const bgmCss = await fetch('http://localhost:5173/src/components/BGM.css');
  console.log('GET BGM.css:', bgmCss.status, 'len=', bgmCss.body.length);
})();

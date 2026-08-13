// 本地冒烟测试：启动静态服务器，验证关键资源可访问
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = 'E:/AI/site';
const PORT = 8123;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const absRoot = path.resolve(ROOT);
  const file = path.resolve(path.join(ROOT, p));
  if (!file.startsWith(absRoot) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('not found'); return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  res.end(fs.readFileSync(file));
});

server.listen(PORT, '127.0.0.1', () => {
  const checks = ['/', '/css/style.css', '/js/app.js', '/js/adapters/index.js', '/js/views/faq.js', '/package.json'];
  let done = 0;
  const finish = (ok) => {
    if (++done === checks.length) {
      console.log(ok ? 'ALL RESOURCES OK' : 'SOME CHECKS FAILED');
      server.close();
      process.exit(ok ? 0 : 1);
    }
  };
  let allOk = true;
  for (const c of checks) {
    http.get({ host: '127.0.0.1', port: PORT, path: c }, (res) => {
      let body = '';
      res.on('data', (d) => (body += d));
      res.on('end', () => {
        const ok = res.statusCode === 200;
        if (!ok) allOk = false;
        console.log(`${ok ? 'OK ' : 'FAIL'} ${c} -> ${res.statusCode} (${res.headers['content-type'] || ''}) ${body.length}B`);
        finish(allOk);
      });
    }).on('error', (e) => {
      allOk = false;
      console.log('FAIL', c, e.message);
      finish(allOk);
    });
  }
});

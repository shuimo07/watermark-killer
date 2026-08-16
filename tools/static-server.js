// 静态服务器（服务 E:\AI 根目录，供无头 Chrome 测试）
const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = 'E:/AI';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.wasm': 'application/wasm', '.json': 'application/json; charset=utf-8' };
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/site/index.html';
  const absRoot = path.resolve(ROOT);
  const file = path.resolve(path.join(ROOT, p));
  if (!file.startsWith(absRoot) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  res.end(fs.readFileSync(file));
}).listen(8123, '127.0.0.1', () => console.log('serving E:/AI on http://127.0.0.1:8123'));

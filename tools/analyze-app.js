// 分析水印斩 app-service.js：提取 URL、API 相关逻辑
const fs = require('fs');
const file = 'E:/AI/decompiled/out/wx09306887f42a77a3/app-service.js';
const s = fs.readFileSync(file, 'utf8');
console.log('total chars:', s.length);

// 1. URL strings
const urls = [...new Set(s.match(/https?:\/\/[^\s"'`]+/g) || [])];
console.log('\n--- URL strings (' + urls.length + ') ---');
urls.forEach((u) => console.log('  ' + u.slice(0, 200)));

// 2. request / api call sites
console.log('\n--- request-ish patterns ---');
const reqPatterns = [...new Set(s.match(/\w{1,3}\.request\([^)]{0,120}/g) || [])].slice(0, 20);
reqPatterns.forEach((r) => console.log('  ' + r.slice(0, 200)));

// 3. strings near 'url' key assignments
console.log('\n--- url: assignments ---');
const urlAssigns = [...new Set(s.match(/url:\s*[^,}]{0,140}/g) || [])].slice(0, 25);
urlAssigns.forEach((r) => console.log('  ' + r.slice(0, 200)));

// 4. appid/secret/token-like
console.log('\n--- key-ish strings ---');
['appid', 'appId', 'secret', 'token', 'sign'].forEach((kw) => {
  const m = [...new Set(s.match(new RegExp('.{0,40}' + kw + '.{0,60}', 'g')) || [])].slice(0, 6);
  if (m.length) { console.log('  [' + kw + ']'); m.forEach((x) => console.log('    ' + x.slice(0, 150))); }
});

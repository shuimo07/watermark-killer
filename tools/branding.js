// 品牌名 + 平台识别 + 解析返回结构
const fs = require('fs');
const file = 'E:/AI/decompiled/out/wx09306887f42a77a3/app-service.js';
const s = fs.readFileSync(file, 'utf8');

console.log('--- 品牌名 occurrences ---');
['字幕斩', '水印斩', '斩', '字幕'].forEach((kw) => {
  let i = -1, n = 0;
  const out = [];
  while ((i = s.indexOf(kw, i + 1)) !== -1 && n < 6) {
    out.push(s.slice(Math.max(0, i - 30), i + 40).replace(/\n/g, ' '));
    n++;
  }
  console.log('[' + kw + '] x' + n);
  out.forEach((o) => console.log('  ' + o));
});

console.log('\n--- 平台识别（域名→平台映射）---');
const m = s.match(/"kuaishouapp\.com"[^;]{0,600}/);
if (m) console.log('  ' + m[0].slice(0, 600));

console.log('\n--- 平台枚举 ---');
['douyin', 'kuaishou', 'xhs', 'weishi', 'taobao', 'bilibili', 'weibo'].forEach((p) => {
  const hits = [...new Set(s.match(new RegExp('[^\\w]' + p + '[^\\w].{0,50}', 'g')) || [])].slice(0, 3);
  if (hits.length) { console.log('[' + p + ']'); hits.forEach((h) => console.log('  ' + h)); }
});

console.log('\n--- miniParse 返回处理 ---');
const parseRes = s.match(/miniParse[^}]{0,200}/);
const resp = s.match(/c\.data\.data[^;]{0,200}|res\.data\.data[^;]{0,200}/g) || [];
resp.slice(0, 8).forEach((r) => console.log('  ' + r.slice(0, 200)));

console.log('\n--- 解析入参构造 ---');
const e = s.match(/e\.platform=this\.globalData\.platform[^}]{0,300}/);
if (e) console.log('  ' + e[0].slice(0, 300));

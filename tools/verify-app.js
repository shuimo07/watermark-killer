// 快速验证新小程序身份
const fs = require('fs');
const path = require('path');
const appDir = 'E:/AI/decompiled/out/wx696e796a7655bba4';

// 1. app-config.json
const cfg = fs.readFileSync(path.join(appDir, 'app-config.json'), 'utf8');
console.log('--- app-config.json (前 400 字) ---');
console.log(cfg.slice(0, 400));

// 2. 品牌关键词
console.log('\n--- 品牌关键词 ---');
const files = [];
(function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else files.push(p); } })(appDir);
const gbk = new TextDecoder('gbk');
const utf8 = new TextDecoder('utf-8');
for (const kw of ['水印斩', '字幕斩', '水印', '去水印', '斩']) {
  let total = 0;
  const examples = [];
  for (const f of files) {
    const buf = fs.readFileSync(f);
    for (const dec of [gbk, utf8]) {
      let s;
      try { s = dec.decode(buf); } catch (e) { continue; }
      let i = -1;
      while ((i = s.indexOf(kw, i + 1)) !== -1) {
        total++;
        if (examples.length < 3) examples.push(s.slice(Math.max(0, i - 25), i + 35).replace(/\s+/g, ' '));
      }
    }
  }
  console.log(`[${kw}] x${total}`);
  examples.forEach((e) => console.log('    ' + e));
}

// 3. 平台域名
console.log('\n--- 平台域名 ---');
const js = files.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
const domains = js.match(/"[a-z0-9.-]+\.[a-z]{2,4}"/g) || [];
const unique = [...new Set(domains)].filter((d) => /douyin|kuaishou|weishi|weibo|taobao|tb\.cn|bili|xiaohongshu|xhscdn|yuantujun|mynxn/.test(d));
console.log(unique.join(' '));

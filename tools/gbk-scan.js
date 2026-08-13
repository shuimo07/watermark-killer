// GBK/UTF-8 双编码关键词扫描器（识别水印类小程序）
const fs = require('fs');
const path = require('path');

const root = 'E:\\AI\\decompiled\\out';
const keywords = ['水印', '去水印', '抖音', '快手', '小红书', 'bilibili', '解析', 'watermark', 'douyin', 'kuaishou', '视频'];
const gbk = new TextDecoder('gbk');
const utf8 = new TextDecoder('utf-8');

function scanFile(file) {
  const buf = fs.readFileSync(file);
  const candidates = [];
  try { candidates.push(['gbk', gbk.decode(buf)]); } catch (e) {}
  try { candidates.push(['utf8', utf8.decode(buf)]); } catch (e) {}
  const hits = [];
  for (const [enc, s] of candidates) {
    for (const kw of keywords) {
      if (s.includes(kw)) {
        let ctx = '';
        const i = s.indexOf(kw);
        ctx = s.slice(Math.max(0, i - 20), i + 40).replace(/\s+/g, ' ');
        hits.push(`${enc}:${kw} ~ ${ctx}`);
      }
    }
  }
  return hits;
}

const appDirs = fs.readdirSync(root);
for (const app of appDirs) {
  const appDir = path.join(root, app);
  if (!fs.statSync(appDir).isDirectory()) continue;
  const files = [];
  (function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else files.push(p); } })(appDir);
  console.log(`\n=== ${app} (${files.length} files) ===`);
  for (const f of files) {
    const hits = scanFile(f);
    if (hits.length) {
      console.log(`  ${path.relative(appDir, f)}:`);
      for (const h of hits.slice(0, 5)) console.log(`    ${h}`);
    }
  }
}

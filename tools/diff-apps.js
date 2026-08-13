// 水印斩 vs 字幕斩 app-service.js 差异对比
const fs = require('fs');
const a = fs.readFileSync('E:/AI/decompiled/out/wx696e796a7655bba4/app-service.js', 'utf8');
const b = fs.readFileSync('E:/AI/decompiled/out/wx09306887f42a77a3/app-service.js', 'utf8');

console.log('水印斩 size:', a.length, ' 字幕斩 size:', b.length);

// 提取所有双引号/单引号字符串集合对比
function strings(s) {
  const out = new Set();
  const re = /["']([^"']{4,120})["']/g;
  let m;
  while ((m = re.exec(s))) out.add(m[1]);
  return out;
}
const sa = strings(a), sb = strings(b);
const onlyA = [...sa].filter((x) => !sb.has(x));
const onlyB = [...sb].filter((x) => !sa.has(x));

console.log('\n--- 仅水印斩有的字符串（前 40）---');
onlyA.slice(0, 40).forEach((x) => console.log('  ' + x.slice(0, 140)));
console.log('\n--- 仅字幕斩有的字符串（前 30）---');
onlyB.slice(0, 30).forEach((x) => console.log('  ' + x.slice(0, 140)));

// URL 对比
console.log('\n--- URL 对比 ---');
const urls = (s) => new Set(s.match(/https?:\/\/[^\s"'`]+/g) || []);
const ua = urls(a), ub = urls(b);
console.log('仅水印斩:', [...ua].filter((x) => !ub.has(x)).join('\n  '));
console.log('仅字幕斩:', [...ub].filter((x) => !ua.has(x)).join('\n  '));

// 远端配置域名
console.log('\n--- 配置关键项 ---');
['api_root', 'fixHost', 'mainColor', 'userType', 'defaultWechat'].forEach((k) => {
  const ma = a.match(new RegExp(k + '\\s*[:=]\\s*[^,;]{0,50}'));
  const mb = b.match(new RegExp(k + '\\s*[:=]\\s*[^,;]{0,50}'));
  console.log(`  ${k}: 水印斩=${ma ? ma[0].slice(0, 60) : '?'} | 字幕斩=${mb ? mb[0].slice(0, 60) : '?'}`);
});

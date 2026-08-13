// 校验 site/ 下所有 JS 的 import 路径
const fs = require('fs');
const path = require('path');
const root = 'E:/AI/site';
const files = [];
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.js')) files.push(p);
  }
})(root);
let bad = 0;
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  const re = /from\s+['"](\.[^'"]+)['"]/g;
  let m;
  while ((m = re.exec(s))) {
    const target = path.resolve(path.dirname(f), m[1]);
    if (!fs.existsSync(target)) {
      console.log('MISSING:', m[1], 'in', path.relative(root, f));
      bad++;
    }
  }
}
console.log(bad === 0 ? 'ALL IMPORTS RESOLVE OK' : bad + ' broken imports');
process.exit(bad === 0 ? 0 : 1);

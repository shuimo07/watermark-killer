// 解析返回结构 + index2/index3 用途
const fs = require('fs');
const s = fs.readFileSync('E:/AI/decompiled/out/wx09306887f42a77a3/app-service.js', 'utf8');

function ctx(pattern, label, max = 6, radius = 130) {
  console.log('\n--- ' + label + ' ---');
  const seen = new Set();
  const re = new RegExp(pattern, 'g');
  let m, n = 0;
  while ((m = re.exec(s)) && n < max) {
    const snip = s.slice(Math.max(0, m.index - 30), m.index + radius).replace(/\s+/g, ' ');
    const key = snip.slice(0, 80);
    if (!seen.has(key)) { seen.add(key); console.log('  ' + snip); n++; }
  }
}

ctx(/video_url|videoUrl|videourl/, 'video url fields');
ctx(/\.cover|cover:/, 'cover fields', 5, 100);
ctx(/images|image_list|imgList/, 'images fields', 5, 110);
ctx(/music|audio/, 'music fields', 4, 100);
ctx(/index2/, 'index2 endpoint context', 3, 160);
ctx(/index3/, 'index3 endpoint context', 3, 160);
ctx(/setData\([^)]{0,80}result|parse-result/, 'result page setData', 4, 120);
ctx(/downloadFile|saveVideo|saveImage/, 'save/download logic', 5, 110);

// 验证线上 watermark.js Blob 优先修复
const https = require('https');
https.get('https://shuimo07.github.io/watermark-killer/js/lib/watermark.js?t=' + Date.now(), { rejectUnauthorized: false }, (res) => {
  let d = '';
  res.on('data', (c) => (d += c));
  res.on('end', () => {
    console.log('watermark.js:', res.statusCode, '(' + d.length + 'B)');
    console.log('Blob优先 createObjectURL:', d.includes('createObjectURL'));
    console.log('referrer空 下载:', d.includes("referrer: ''"));
    console.log('挂载DOM:', d.includes('appendChild(v)'));
  });
});

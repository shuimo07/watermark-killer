const https = require('https');
https.get('https://shuimo07.github.io/watermark-killer/js/app.js?t=' + Date.now(), { rejectUnauthorized: false }, (res) => {
  let d = '';
  res.on('data', (c) => (d += c));
  res.on('end', () => {
    console.log('app.js:', res.statusCode, '(' + d.length + 'B)');
    console.log('自动去水印 runWatermark:', d.includes('runWatermark(r)'));
    console.log('全局默认 wmCorner all:', d.includes("wmCorner: 'all'"));
    console.log('全局四边 all:', d.includes("'all'"));
    console.log('去水印完成预览:', d.includes('wm-preview'));
  });
});

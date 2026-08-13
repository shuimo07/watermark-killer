// 验证线上 watermark.js 修复
const https = require('https');
https.get('https://shuimo07.github.io/watermark-killer/js/lib/watermark.js', { rejectUnauthorized: false }, (res) => {
  let d = '';
  res.on('data', (c) => (d += c));
  res.on('end', () => {
    console.log('watermark.js 线上:', res.statusCode, '(' + d.length + 'B)');
    console.log('webm优先:', d.includes('video/webm;codecs=vp9'));
    console.log('DOM挂载:', d.includes('document.body.appendChild(v)'));
    console.log('静音播放:', d.includes('v.muted = true'));
    console.log('无音频重试:', d.includes('audioTrack: null'));
  });
});

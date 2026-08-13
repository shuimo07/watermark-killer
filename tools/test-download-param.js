// 终极水印参数矩阵：对比 download/logo 等参数变体的视频字节
const https = require('https');
const crypto = require('crypto');

function req(method, url, { headers = {}, body } = {}, timeout = 40000) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const r = https.request(u, { method, rejectUnauthorized: false, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/148.0.0.0 Safari/537.36 Edg/148.0.0.0', ...headers } }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    r.setTimeout(timeout, () => { r.destroy(); resolve({ status: 0, headers: {}, body: Buffer.from('TIMEOUT') }); });
    r.on('error', (e) => resolve({ status: 0, headers: {}, body: Buffer.from('ERR ' + e.message) }));
    if (body) r.write(typeof body === 'string' ? body : JSON.stringify(body));
    r.end();
  });
}

const P = new URLSearchParams({ version_code: '20800', language: 'zh-CN', device_platform: 'web', aid: '497858', real_aid: '497858', pkg_type: 'release_version', device_id: '', pc_version: '2.51.7', region: '', sys_region: '', samantha_web: '1', 'use-olympus-account': '1', web_tab_id: '' }).toString();
const TARGET = 'https://www.doubao.com/samantha/media/get_play_info?' + P;

async function apiCall(vid) {
  for (let i = 0; i < 6; i++) {
    const r = await req('POST', TARGET, { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: vid }) });
    if (r.status === 200) { try { const j = JSON.parse(r.body.toString()); if (j.code === 0) return j; } catch {} }
    await new Promise((x) => setTimeout(x, 5000));
  }
  return null;
}

(async () => {
  const j = await apiCall('v0269cg10004d9v2uga7dld8dlfmap30');
  if (!j) { console.log('API 重试失败'); return; }
  const u = j.data.original_media_info.main_url;
  console.log('main_url 参数:', new URL(u).searchParams.toString().slice(0, 250));

  const variants = [
    ['A 原样(download=true)', u],
    ['B 去 download=true', u.replace(/&?download=true/, '')],
    ['C download=false', u.replace(/download=true/, 'download=false')],
    ['D 去 download + 去 lr', u.replace(/&?download=true/, '').replace('lr=video_gen_watermark_dyn&', '')],
    ['E 加 logo_type=0', u.replace(/&?download=true/, '') + '&logo_type=0'],
  ];
  const hashes = {};
  for (const [name, url] of variants) {
    const r = await req('GET', url, { headers: { Referer: 'https://www.doubao.com/' } }, 60000);
    if (r.status === 200) {
      const md5 = crypto.createHash('md5').update(r.body).digest('hex');
      hashes[name] = md5;
      console.log(`${name} => 200 ${r.body.length}B md5=${md5}`);
    } else console.log(`${name} => ${r.status}`);
  }
  const keys = Object.keys(hashes);
  if (keys.length >= 2) {
    const base = hashes[keys[0]];
    const diff = keys.filter((k) => hashes[k] !== base);
    console.log(diff.length ? `🎯 变体 ${diff.join(', ')} 字节不同 → 找到有效参数！` : '⚠️ 全部相同 → 水印烤入，参数无用');
  }
})();

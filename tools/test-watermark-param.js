// 关键实验：下载带/不带水印参数的视频，逐字节对比，找出控制水印的参数
const https = require('https');
const crypto = require('crypto');

function req(method, url, { headers = {}, body } = {}) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const r = https.request(u, { method, rejectUnauthorized: false, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/148.0.0.0 Safari/537.36 Edg/148.0.0.0', ...headers } }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    r.setTimeout(30000, () => { r.destroy(); resolve({ status: 0, headers: {}, body: Buffer.from('TIMEOUT') }); });
    r.on('error', (e) => resolve({ status: 0, headers: {}, body: Buffer.from('ERR ' + e.message) }));
    if (body) r.write(typeof body === 'string' ? body : JSON.stringify(body));
    r.end();
  });
}

function apiCall(vid) {
  return new Promise((resolve) => {
    const P = new URLSearchParams({ version_code: '20800', language: 'zh-CN', device_platform: 'web', aid: '497858', real_aid: '497858', pkg_type: 'release_version', device_id: '', pc_version: '2.51.7', region: '', sys_region: '', samantha_web: '1', 'use-olympus-account': '1', web_tab_id: '' }).toString();
    const u = new URL('https://www.doubao.com/samantha/media/get_play_info?' + P);
    const r = https.request(u, { method: 'POST', rejectUnauthorized: false, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/148.0.0.0 Safari/537.36 Edg/148.0.0.0', 'Content-Type': 'application/json' }, body: JSON.stringify({ key: vid }) });
    let d = '';
    r.on('response', (res) => { res.on('data', (c) => (d += c)); res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } }); });
    r.on('error', () => resolve(null));
    r.end();
  });
}

(async () => {
  const j = await apiCall('v0269cg10004d9v2uga7dld8dlfmap30');
  if (!j || j.code !== 0) { console.log('API 失败:', j && j.code); return; }
  const d = j.data;
  const m1 = d.media_info[0].main_url;
  const m2 = d.original_media_info.main_url;
  console.log('media_info.main_url 与 original 相同:', m1 === m2);

  // 生成 URL 变体
  const variants = [
    ['原样(lr=video_gen_watermark_dyn)', m2],
    ['去掉 lr 参数', m2.replace('lr=video_gen_watermark_dyn&', '')],
    ['lr 置空', m2.replace('lr=video_gen_watermark_dyn', 'lr=')],
    ['lr 改 logo_type=0', m2.replace('lr=video_gen_watermark_dyn', 'logo_type=0')],
  ];

  for (const [name, u] of variants) {
    if (!u) { console.log(name, '=> 无'); continue; }
    const r = await req('GET', u, { headers: { Referer: 'https://www.doubao.com/' } });
    if (r.status === 200) {
      const md5 = crypto.createHash('md5').update(r.body).digest('hex');
      console.log(`${name} => ${r.status} ${r.body.length}B md5:${md5}`);
    } else {
      console.log(`${name} => ${r.status}`);
    }
  }
})();

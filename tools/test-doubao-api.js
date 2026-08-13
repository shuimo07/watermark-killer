// 实测豆包两个公开接口（用用户提供的 video_id）
const https = require('https');

function request(method, url, { headers = {}, body } = {}) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const req = https.request(
      u,
      { method, rejectUnauthorized: false, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36 Edg/148.0.0.0', ...headers } },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
      }
    );
    req.setTimeout(20000, () => { req.destroy(); resolve({ status: 0, headers: {}, body: Buffer.from('TIMEOUT') }); });
    req.on('error', (e) => resolve({ status: 0, headers: {}, body: Buffer.from('ERR ' + e.message) }));
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

const VID = 'v0269cg10004d9v15ha7dld1id7csccg';

(async () => {
  // 接口 1：samantha/media/get_play_info
  const params = new URLSearchParams({
    version_code: '20800', language: 'zh-CN', device_platform: 'web', aid: '497858', real_aid: '497858',
    pkg_type: 'release_version', device_id: '', pc_version: '2.51.7', region: '', sys_region: '',
    samantha_web: '1', 'use-olympus-account': '1', web_tab_id: '',
  });
  let r = await request('POST', 'https://www.doubao.com/samantha/media/get_play_info?' + params, {
    headers: { 'Content-Type': 'application/json', Origin: 'https://www.doubao.com', Referer: 'https://www.doubao.com/' },
    body: { key: VID },
  });
  console.log('=== get_play_info ===');
  console.log('status:', r.status, '| len:', r.body.length);
  console.log('CORS ACAO:', r.headers['access-control-allow-origin'] || '(无)');
  let j;
  try { j = JSON.parse(r.body.toString('utf8')); } catch { console.log('raw:', r.body.toString().slice(0, 200)); }
  if (j) {
    console.log('code:', j.code, '| msg:', j.msg || j.message || '');
    const d = j.data || {};
    console.log('poster_url:', (d.poster_url || '').slice(0, 120));
    const om = d.original_media_info || {};
    console.log('main_url:', (om.main_url || '').slice(0, 160));
    console.log('meta:', JSON.stringify(om.meta || {}).slice(0, 200));
  }

  // 接口 2：alice/resource/get_video_model
  r = await request('POST', 'https://www.doubao.com/alice/resource/get_video_model', {
    headers: { 'Content-Type': 'application/json', Referer: 'https://www.doubao.com/video-sharing' },
    body: { params: [{ uri: VID }] },
  });
  console.log('\n=== get_video_model ===');
  console.log('status:', r.status, '| len:', r.body.length);
  console.log('CORS ACAO:', r.headers['access-control-allow-origin'] || '(无)');
  const raw = r.body.toString('utf8');
  console.log('head:', raw.slice(0, 400));
})();

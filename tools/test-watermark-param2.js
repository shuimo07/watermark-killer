// 带重试的 API 调用 + 水印参数对比（双通道）
const https = require('https');
const crypto = require('crypto');

function req(method, url, { headers = {}, body } = {}, timeout = 30000) {
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
  // 通道1：直连（重试5次）；通道2：corsproxy.io
  for (let i = 0; i < 5; i++) {
    const r = await req('POST', TARGET, { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: vid }) });
    if (r.status === 200) { try { return JSON.parse(r.body.toString()); } catch {} }
    await new Promise((x) => setTimeout(x, 4000));
  }
  const r2 = await req('POST', 'https://corsproxy.io/?url=' + encodeURIComponent(TARGET), { headers: { 'Content-Type': 'application/json', Origin: 'https://shuimo07.github.io' }, body: JSON.stringify({ key: vid }) });
  try { return JSON.parse(r2.body.toString()); } catch { return null; }
}

async function run(vid, label) {
  console.log(`\n========== ${label} (${vid}) ==========`);
  const j = await apiCall(vid);
  if (!j || j.code !== 0) { console.log('API 失败:', j && (j.code + ' ' + j.msg)); return; }
  const d = j.data;
  const m1 = d.media_info && d.media_info[0] && d.media_info[0].main_url;
  const m2 = d.original_media_info && d.original_media_info.main_url;
  console.log('media_info === original:', m1 === m2);
  console.log('含 lr=video_gen_watermark_dyn:', (m2 || '').includes('lr=video_gen_watermark_dyn'));

  const variants = [
    ['A 原样', m2],
    ['B 去 lr', m2 && m2.replace('lr=video_gen_watermark_dyn&', '')],
    ['C lr 置空', m2 && m2.replace('lr=video_gen_watermark_dyn', 'lr=')],
    ['D lr→logo_type=0', m2 && m2.replace('lr=video_gen_watermark_dyn', 'logo_type=0')],
  ];
  const hashes = {};
  for (const [name, u] of variants) {
    if (!u) { console.log(`  ${name} => 无 URL`); continue; }
    const r = await req('GET', u, { headers: { Referer: 'https://www.doubao.com/' } }, 60000);
    if (r.status === 200) {
      const md5 = crypto.createHash('md5').update(r.body).digest('hex');
      hashes[name] = md5;
      console.log(`  ${name} => ${r.status} ${r.body.length}B md5=${md5}`);
    } else console.log(`  ${name} => ${r.status} ${r.body.length}B`);
  }
  const keys = Object.keys(hashes);
  if (keys.length >= 2) {
    const first = hashes[keys[0]];
    const diff = keys.filter((k) => hashes[k] !== first);
    console.log(diff.length === 0 ? '  ⚠️ 所有变体字节相同 → lr 参数被忽略，水印已烤入视频' : `  ✅ 变体 ${diff.join(',')} 内容不同 → 参数有效！`);
  }
}

(async () => {
  await run('v0269cg10004d9v2uga7dld8dlfmap30', '用户新视频');
  await run('v0269cg10004d9v15ha7dld1id7csccg', '用户旧视频');
})();

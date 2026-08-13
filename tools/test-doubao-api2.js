// 打印完整 get_play_info 响应 + 探测视频 URL 可下载性
const https = require('https');

function req(method, url, { headers = {}, body } = {}) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const r = https.request(u, { method, rejectUnauthorized: false, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36 Edg/148.0.0.0', ...headers } }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    r.setTimeout(20000, () => { r.destroy(); resolve({ status: 0, headers: {}, body: Buffer.from('TIMEOUT') }); });
    r.on('error', (e) => resolve({ status: 0, headers: {}, body: Buffer.from('ERR ' + e.message) }));
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

(async () => {
  const params = new URLSearchParams({ version_code: '20800', language: 'zh-CN', device_platform: 'web', aid: '497858', real_aid: '497858', pkg_type: 'release_version', device_id: '', pc_version: '2.51.7', region: '', sys_region: '', samantha_web: '1', 'use-olympus-account': '1', web_tab_id: '' });
  const r = await req('POST', 'https://www.doubao.com/samantha/media/get_play_info?' + params, { headers: { 'Content-Type': 'application/json', Origin: 'https://www.doubao.com' }, body: { key: 'v0269cg10004d9v15ha7dld1id7csccg' } });
  const j = JSON.parse(r.body.toString('utf8'));
  console.log('=== 完整响应 ===');
  console.log(JSON.stringify(j, null, 2).slice(0, 2500));

  const mainUrl = j.data.original_media_info.main_url;
  console.log('\n=== HEAD 视频 URL ===');
  const h = await req('HEAD', mainUrl, { headers: { Referer: 'https://www.doubao.com/' } });
  console.log('status:', h.status, '| type:', h.headers['content-type'], '| len:', h.headers['content-length']);
  console.log('CORS ACAO:', h.headers['access-control-allow-origin'] || '(无)');
  console.log('CORS ACAH:', h.headers['access-control-allow-headers'] || '(无)');
})();

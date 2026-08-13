// 测试 corsproxy.io 对不同 Origin 的放行策略
const https = require('https');

function req(method, url, { headers = {}, body } = {}) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const r = https.request(u, { method, rejectUnauthorized: false, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/148.0.0.0 Safari/537.36 Edg/148.0.0.0', ...headers } }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    r.setTimeout(20000, () => { r.destroy(); resolve({ status: 0, headers: {}, body: Buffer.from('TIMEOUT') }); });
    r.on('error', (e) => resolve({ status: 0, headers: {}, body: Buffer.from('ERR ' + e.message) }));
    if (body) r.write(typeof body === 'string' ? body : JSON.stringify(body));
    r.end();
  });
}

const VID = 'v0269cg10004d9v15ha7dld1id7csccg';
const P = new URLSearchParams({ version_code: '20800', language: 'zh-CN', device_platform: 'web', aid: '497858', real_aid: '497858', pkg_type: 'release_version', device_id: '', pc_version: '2.51.7', region: '', sys_region: '', samantha_web: '1', 'use-olympus-account': '1', web_tab_id: '' }).toString();
const TARGET = 'https://www.doubao.com/samantha/media/get_play_info?' + P;
const PROXY = 'https://corsproxy.io/?url=' + encodeURIComponent(TARGET);

const variants = [
  ['Origin: localhost:3000', { Origin: 'http://localhost:3000' }],
  ['Origin: null', { Origin: 'null' }],
  ['Origin: github.io 站点', { Origin: 'https://shuimo07.github.io' }],
  ['仅 Referer: localhost', { Referer: 'http://localhost:3000/' }],
  ['仅 Origin: shuimo07.github.io + Referer 无', { Origin: 'https://shuimo07.github.io' }],
];

(async () => {
  for (const [name, hdrs] of variants) {
    const r = await req('POST', PROXY, { headers: { 'Content-Type': 'application/json', ...hdrs }, body: { key: VID } });
    const ok = r.status === 200;
    console.log(`${ok ? '✅' : '❌'} ${name} => ${r.status} ${r.body.length}B ${ok ? '(成功!)' : r.body.toString().slice(0, 80)}`);
  }
})();

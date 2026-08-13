// 测试 get_video_model 免登录可行性（多 UA/头组合）
const https = require('https');

function req(method, url, { headers = {}, body } = {}) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const r = https.request(u, { method, rejectUnauthorized: false, headers, body }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    r.setTimeout(20000, () => { r.destroy(); resolve({ status: 0, headers: {}, body: Buffer.from('TIMEOUT') }); });
    r.on('error', (e) => resolve({ status: 0, headers: {}, body: Buffer.from('ERR ' + e.message) }));
    r.end();
  });
}

const VID = 'v0269cg10004d9v2uga7dld8dlfmap30';
const UAS = {
  chrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36 Edg/148.0.0.0',
  wechat: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 NetType/WIFI MicroMessenger/7.0.20.1781(0x6700143B) WindowsWechat(0x63090c33) XWEB/14315 Flue',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
};

const scenarios = [
  ['chrome 无额外头', { 'User-Agent': UAS.chrome }],
  ['chrome + Origin/Referer doubao', { 'User-Agent': UAS.chrome, Origin: 'https://www.doubao.com', Referer: 'https://www.doubao.com/video-sharing' }],
  ['wechat UA + Origin', { 'User-Agent': UAS.wechat, Origin: 'https://www.doubao.com' }],
  ['iphone UA + Origin', { 'User-Agent': UAS.iphone, Origin: 'https://www.doubao.com' }],
  ['chrome + 假 ttwid cookie', { 'User-Agent': UAS.chrome, Origin: 'https://www.doubao.com', Cookie: 'ttwid=20260814%7Cxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx%7C1; sessionid=' }],
];

(async () => {
  for (const [name, hdrs] of scenarios) {
    const r = await req('POST', 'https://www.doubao.com/alice/resource/get_video_model', {
      headers: { 'Content-Type': 'application/json', ...hdrs },
      body: JSON.stringify({ params: [{ uri: VID }] }),
    });
    let brief = r.body.toString().slice(0, 140).replace(/\s+/g, ' ');
    console.log(`${r.status === 200 ? '✅' : '❌'} ${name} => ${r.status} ${brief}`);
  }
})();

// CDP 驱动：真实时间运行测试页并读取结果（最小 WebSocket 客户端，无第三方依赖）
const { spawn } = require('child_process');
const net = require('net');
const http = require('http');
const crypto = require('crypto');

const CHROME = 'C:\\Users\\legion\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9333;
const TEST_URL = process.argv[2] || 'http://127.0.0.1:8123/test-wm3.html';
const WATCH_SECONDS = Number(process.argv[3] || 90);

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => resolve(d));
    }).on('error', reject);
  });
}

function wsConnect(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const key = crypto.randomBytes(16).toString('base64');
    const sock = net.connect(Number(u.port), u.hostname, () => {
      sock.write(`GET ${u.pathname}${u.search} HTTP/1.1\r\nHost: ${u.host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`);
    });
    let buf = Buffer.alloc(0);
    let opened = false;
    const listeners = [];
    sock.on('data', (d) => {
      buf = Buffer.concat([buf, d]);
      if (!opened) {
        const idx = buf.indexOf('\r\n\r\n');
        if (idx === -1) return;
        const head = buf.slice(0, idx).toString();
        if (!/ 101 /.test(head)) { reject(new Error('WS handshake failed: ' + head.slice(0, 80))); sock.destroy(); return; }
        buf = buf.slice(idx + 4);
        opened = true;
        resolve(api);
      }
      while (buf.length >= 2) {
        const b0 = buf[0], b1 = buf[1];
        let headerLen = 2, payloadLen = b1 & 0x7f;
        if (payloadLen === 126) { if (buf.length < 4) break; payloadLen = buf.readUInt16BE(2); headerLen = 4; }
        else if (payloadLen === 127) { if (buf.length < 10) break; payloadLen = Number(buf.readBigUInt64BE(2)); headerLen = 10; }
        if (buf.length < headerLen + payloadLen) break;
        const payload = buf.slice(headerLen, headerLen + payloadLen);
        buf = buf.slice(headerLen + payloadLen);
        const opcode = b0 & 0x0f;
        if (opcode === 1) listeners.forEach((f) => f(payload.toString('utf8')));
        else if (opcode === 8) sock.destroy();
        else if (opcode === 9) sock.write(makeFrame(0xA, payload));
      }
    });
    function makeFrame(opcode, payload) {
      const mask = crypto.randomBytes(4);
      let header;
      if (payload.length < 126) header = Buffer.from([0x80 | opcode, 0x80 | payload.length]);
      else if (payload.length < 65536) { header = Buffer.alloc(4); header[0] = 0x80 | opcode; header[1] = 0x80 | 126; header.writeUInt16BE(payload.length, 2); }
      else { header = Buffer.alloc(10); header[0] = 0x80 | opcode; header[1] = 0x80 | 127; header.writeBigUInt64BE(BigInt(payload.length), 2); }
      const masked = Buffer.from(payload);
      for (let i = 0; i < masked.length; i++) masked[i] ^= mask[i % 4];
      return Buffer.concat([header, mask, masked]);
    }
    const api = {
      send(obj) { sock.write(makeFrame(1, Buffer.from(JSON.stringify(obj)))); },
      onMessage(fn) { listeners.push(fn); },
      close() { sock.destroy(); },
    };
  });
}

(async () => {
  console.log('启动 Chrome (remote debugging port ' + PORT + ')…');
  const chrome = spawn(CHROME, [
    '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-crash-reporter',
    '--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader',
    '--user-agent=Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    '--user-data-dir=E:\\AI\\.chrome-cdp', '--remote-debugging-port=' + PORT, 'about:blank',
  ], { stdio: 'ignore' });

  // 等调试端口就绪
  let targets = null;
  for (let i = 0; i < 30; i++) {
    try { targets = JSON.parse(await httpGet(`http://127.0.0.1:${PORT}/json`)); if (targets.length) break; } catch { /* retry */ }
    await sleep(500);
  }
  if (!targets) { console.log('❌ Chrome 调试端口未就绪'); chrome.kill(); process.exit(1); }

  const page = targets.find((t) => t.type === 'page');
  console.log('连接页面:', page.url);
  const ws = await wsConnect(page.webSocketDebuggerUrl);
  let msgId = 0;
  const pending = {};
  ws.onMessage((raw) => {
    const m = JSON.parse(raw);
    if (m.id && pending[m.id]) { pending[m.id](m); delete pending[m.id]; }
    if (m.method === 'Runtime.consoleAPICalled') {
      const args = (m.params.args || []).map((a) => a.value !== undefined ? a.value : a.description || '').join(' ');
      if (args) console.log('[console]', args.slice(0, 300));
    }
  });
  const send = (method, params) => new Promise((res) => { const i = ++msgId; pending[i] = res; ws.send({ id: i, method, params: params || {} }); });

  await send('Runtime.enable');
  await send('Page.enable');
  console.log('导航到测试页:', TEST_URL);
  await send('Page.navigate', { url: TEST_URL });

  // 实时轮询日志
  let lastLog = '';
  let done = false;
  const deadline = Date.now() + WATCH_SECONDS * 1000;
  while (Date.now() < deadline) {
    await sleep(1000);
    const r = await send('Runtime.evaluate', { expression: "document.getElementById('log') && document.getElementById('log').textContent", returnByValue: true });
    const val = r.result && r.result.result && r.result.result.value;
    if (val && val !== lastLog) {
      lastLog = val;
      console.log('---- 日志更新 ----');
      console.log(val);
      if (val.includes('=== DONE ===')) { done = true; break; }
    }
  }
  console.log(done ? '\n✅ 测试完成' : '\n⏰ 超时未完成');
  ws.close();
  chrome.kill();
  process.exit(done ? 0 : 1);
})();

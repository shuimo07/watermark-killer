// E2E 测试 v3：本地文件去水印全流程（真实浏览器 + 真实 ffmpeg.wasm）
// 安全约束：本脚本只管控【自己 spawn 的】静态服务器与无头 Chrome（各自持有句柄，结束时只 kill 自己的句柄），
//           绝不使用 Get-Process/Stop-Process 等全局杀进程操作，避免误伤用户正在使用的浏览器/管理页面会话。
const { spawn, spawnSync } = require('child_process');
const net = require('net');
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:\\Users\\legion\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9341; // 与其它可能占用的端口错开
const SITE_URL = 'http://127.0.0.1:8123/watermark-killer/site/index.html';
// 测试视频由脚本先生成（tools/gen-e2e-video.mjs → 仓库 .tmp/ 目录），
// 再由静态服务器（服务 E:/AI 根目录）提供
const VIDEO_REL = '/watermark-killer/.tmp/e2e-input.mp4';
const VIDEO_URL = 'http://127.0.0.1:8123' + VIDEO_REL;
const VIDEO_FILE = 'E:/AI/watermark-killer/.tmp/e2e-input.mp4';
const WATCH_SECONDS = Number(process.argv[2] || 300);
const OUT = 'E:/AI/e2e-log.txt';
// 独立临时 profile：仅本次测试使用，测试结束会删除
const PROFILE = 'E:/AI/.e2e-profile-' + process.pid;

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
function log(msg) { fs.appendFileSync(OUT, msg + '\n'); console.log(msg); }

// 只 kill 本脚本启动的进程（按句柄/PID），绝不全局搜索杀进程
function killOwn(proc, name) {
  if (!proc) return;
  try {
    if (proc.pid) process.kill(proc.pid, 'SIGKILL');
  } catch { /* 已退出 */ }
  try { proc.kill(); } catch { /* 已退出 */ }
  log(`[cleanup] ${name} (pid=${proc.pid}) 已结束`);
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
        if (!/ 101 /.test(head)) { reject(new Error('WS handshake failed')); sock.destroy(); return; }
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
  let server = null;
  let chrome = null;
  try {
    fs.writeFileSync(OUT, '');
    log('生成测试视频（tools/gen-e2e-video.mjs）…');
    const genRet = spawnSync('node', ['E:/AI/watermark-killer/tools/gen-e2e-video.mjs', VIDEO_FILE], { stdio: 'inherit' });
    if (genRet.status !== 0 || !fs.existsSync(VIDEO_FILE)) {
      log('❌ 测试视频生成失败');
      process.exitCode = 1;
      return;
    }

    log('启动静态服务器 :8123…');
    server = spawn('node', ['E:/AI/watermark-killer/tools/static-server.js'], { stdio: 'ignore' });
    await sleep(1500);

    log('启动无头 Chrome (remote debugging port ' + PORT + ', profile ' + PROFILE + ')…');
    chrome = spawn(CHROME, [
      '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-crash-reporter',
      '--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader',
      '--user-data-dir=' + PROFILE, '--remote-debugging-port=' + PORT, 'about:blank',
    ], { stdio: 'ignore' });

    let targets = null;
    for (let i = 0; i < 40; i++) {
      try { targets = JSON.parse(await httpGet(`http://127.0.0.1:${PORT}/json`)); if (targets.length) break; } catch { /* retry */ }
      await sleep(500);
    }
    if (!targets) { log('❌ Chrome 调试端口未就绪'); process.exitCode = 1; return; }

    const page = targets.find((t) => t.type === 'page');
    const ws = await wsConnect(page.webSocketDebuggerUrl);
    let msgId = 0;
    const pending = {};
    ws.onMessage((raw) => {
      const m = JSON.parse(raw);
      if (m.id && pending[m.id]) { pending[m.id](m); delete pending[m.id]; }
      if (m.method === 'Runtime.consoleAPICalled') {
        const args = (m.params.args || []).map((a) => a.value !== undefined ? a.value : a.description || '').join(' ');
        if (args) log('[page] ' + args.slice(0, 500));
      }
      if (m.method === 'Runtime.exceptionThrown') {
        const t = m.params.exceptionDetails;
        log('[page-exception] ' + (t && t.exception && t.exception.description ? t.exception.description.slice(0, 800) : (t && t.text)));
      }
      if (m.method === 'Log.entryAdded') {
        const e = m.params.entry;
        if (e && e.level === 'error') log('[page-error] ' + e.text + ' ' + (e.url || ''));
      }
    });
    const send = (method, params) => new Promise((res) => { const i = ++msgId; pending[i] = res; ws.send({ id: i, method, params: params || {} }); });
    const evalJs = async (expr) => {
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
      if (r.result && r.result.exceptionDetails) {
        log('[eval-error] ' + JSON.stringify(r.result.exceptionDetails.exception ? r.result.exceptionDetails.exception.description : r.result.exceptionDetails.text).slice(0, 500));
        return null;
      }
      return r.result && r.result.result ? r.result.result.value : undefined;
    };

    await send('Runtime.enable');
    await send('Page.enable');
    await send('Log.enable');
    log('导航到站点: ' + SITE_URL);
    await send('Page.navigate', { url: SITE_URL });
    await sleep(3000);

    const initState = await evalJs(`({
      hasDropzone: !!document.getElementById('wm-dropzone'),
      hasInput: !!document.getElementById('wm-file-input'),
      startBtnDisabled: document.getElementById('wm-start-btn') ? document.getElementById('wm-start-btn').disabled : 'no-el'
    })`);
    log('页面初始化状态: ' + JSON.stringify(initState));

    log('注入测试视频…');
    const inject = await evalJs(`(async () => {
      const res = await fetch('${VIDEO_URL}');
      const blob = await res.blob();
      const file = new File([blob], 'E2E-input.mp4', { type: 'video/mp4' });
      const input = document.getElementById('wm-file-input');
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return 'injected size=' + file.size + ' files=' + input.files.length;
    })()`);
    log('注入结果: ' + inject);

    let detected = null;
    for (let i = 0; i < 50; i++) {
      await sleep(1000);
      detected = await evalJs(`({
        startDisabled: document.getElementById('wm-start-btn').disabled,
        status: document.getElementById('wm-status').textContent,
        previewVisible: !document.getElementById('wm-preview-wrap').classList.contains('hidden'),
        fileMeta: document.getElementById('wm-file-meta').textContent,
        fileCardVisible: !document.getElementById('wm-file-card').classList.contains('hidden')
      })`);
      if (detected && !detected.startDisabled) break;
    }
    log('检测状态: ' + JSON.stringify(detected));
    if (!detected || detected.startDisabled) {
      log('❌ 未检测到水印框（或超时）');
      ws.close();
      process.exitCode = 1;
      return;
    }

    log('开始去水印…');
    await evalJs(`document.getElementById('wm-start-btn').click()`);

    let result = null;
    const deadline = Date.now() + WATCH_SECONDS * 1000;
    while (Date.now() < deadline) {
      await sleep(2000);
      result = await evalJs(`({
        done: !document.getElementById('wm-result-wrap').classList.contains('hidden'),
        status: document.getElementById('wm-status').textContent,
        progressVisible: !document.getElementById('wm-progress').classList.contains('hidden'),
        log: document.getElementById('wm-log').innerText.slice(-1800)
      })`);
      if (result && (result.done || (result.status && result.status.includes('失败')))) break;
    }
    log('处理结果: ' + JSON.stringify(result));

    if (result && result.done) {
      const probe = await evalJs(`(async () => {
        const v = document.getElementById('wm-result-video');
        await new Promise((r) => { if (v.readyState >= 1) r(); else { v.onloadeddata = r; setTimeout(r, 5000); } });
        return { w: v.videoWidth, h: v.videoHeight, dur: v.duration, src: (v.src || '').slice(0, 50) };
      })()`);
      log('输出视频信息: ' + JSON.stringify(probe));
      log('\n✅ E2E 测试通过：检测 → delogo → mp4 全流程可用');
      ws.close();
      process.exitCode = 0;
      return;
    }

    log('\n❌ E2E 测试失败（未得到 mp4 输出）');
    ws.close();
    process.exitCode = 1;
  } catch (e) {
    log('❌ E2E 异常: ' + (e && e.message ? e.message : e));
    process.exitCode = 1;
  } finally {
    // 只清理自己启动的进程
    killOwn(chrome, '无头Chrome');
    killOwn(server, '静态服务器');
    try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch { /* ignore */ }
    log('[cleanup] 临时 profile 已删除');
  }
  process.exit(process.exitCode || 0);
})();

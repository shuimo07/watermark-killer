// 本地文件去水印工作流控制器：
// 拖入/选择豆包等 AI 生成的视频 → 自动检测水印（可手动微调框）→ ffmpeg delogo → mp4 下载
import { detectWatermarks, drawFrame } from './detect.js';
import { removeWatermarksToMp4, probeSize, ffmpegSourceName } from './ffmpeg.js';

const $ = (id) => document.getElementById(id);

export function initFileWM() {
  const zone = $('wm-dropzone');
  const input = $('wm-file-input');
  const card = $('wm-file-card');
  const preview = $('wm-preview');
  const previewWrap = $('wm-preview-wrap');
  const detectBtn = $('wm-detect-btn');
  const clearBtn = $('wm-clear-btn');
  const startBtn = $('wm-start-btn');
  const status = $('wm-status');
  const progress = $('wm-progress');
  const progressBar = $('wm-progress-bar');
  const logEl = $('wm-log');
  const resultWrap = $('wm-result-wrap');
  const resultVideo = $('wm-result-video');
  const downloadBtn = $('wm-download-btn');
  const againBtn = $('wm-again-btn');
  const fileMeta = $('wm-file-meta');
  const hint = $('wm-hint');

  const state = {
    file: null,
    video: null,
    boxes: [],
    processing: false,
  };

  const ctx = preview.getContext('2d');
  let drag = null; // { mode:'move'|'resize', index, sx, sy, orig }

  /* ---------- 工具 ---------- */
  function toast(msg, ms = 2200) {
    const el = $('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.add('hidden'), ms);
  }

  function setStatus(msg, cls = '') {
    status.className = 'status-area' + (cls ? ' ' + cls : '');
    status.textContent = msg;
  }

  function addLog(msg) {
    const line = document.createElement('div');
    line.textContent = msg;
    logEl.appendChild(line);
    logEl.scrollTop = logEl.scrollHeight;
  }

  function fmtSize(n) {
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1024 / 1024).toFixed(1) + ' MB';
  }

  function reset() {
    state.boxes = [];
    state.processing = false;
    previewWrap.classList.add('hidden');
    resultWrap.classList.add('hidden');
    progress.classList.add('hidden');
    logEl.innerHTML = '';
    setStatus('');
    detectBtn.classList.remove('hidden');
    clearBtn.classList.add('hidden');
    startBtn.disabled = true;
    if (state.video) { state.video.pause(); state.video.removeAttribute('src'); state.video.load(); state.video = null; }
    URL.revokeObjectURL(preview.dataset.url || '');
    delete preview.dataset.url;
  }

  /* ---------- 画框交互 ---------- */
  function scaleBoxes() {
    const r = preview.getBoundingClientRect();
    const sx = preview.width / r.width, sy = preview.height / r.height;
    return { sx, sy };
  }

  function drawBoxes() {
    ctx.clearRect(0, 0, preview.width, preview.height);
    // 重绘背景帧
    if (state.video && state.video.videoWidth) {
      const scale = Math.min(preview.width / state.video.videoWidth, preview.height / state.video.videoHeight);
      const dw = state.video.videoWidth * scale, dh = state.video.videoHeight * scale;
      const dx = (preview.width - dw) / 2, dy = (preview.height - dh) / 2;
      ctx.drawImage(state.video, dx, dy, dw, dh);
      state._frameOffset = { dx, dy, scale };
    }
    const off = state._frameOffset || { dx: 0, dy: 0, scale: 1 };
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#4a9eff';
    state.boxes.forEach((b, i) => {
      const bx = off.dx + b.x * off.scale;
      const by = off.dy + b.y * off.scale;
      const bw = b.w * off.scale, bh = b.h * off.scale;
      ctx.strokeRect(bx, by, bw, bh);
      ctx.fillStyle = 'rgba(74,158,255,0.15)';
      ctx.fillRect(bx, by, bw, bh);
      // 手柄
      ctx.fillStyle = '#fff';
      const hs = 7;
      [[bx, by], [bx + bw, by], [bx, by + bh], [bx + bw, by + bh]].forEach(([hx, hy]) => {
        ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
        ctx.strokeRect(hx - hs / 2, hy - hs / 2, hs, hs);
      });
      ctx.fillStyle = '#4a9eff';
      ctx.font = '12px sans-serif';
      ctx.fillText(`水印${i + 1} (${Math.round(b.w)}×${Math.round(b.h)})`, bx, Math.max(14, by - 6));
    });
  }

  function onPointerDown(e) {
    if (!state.video || state.processing) return;
    const rect = preview.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (preview.width / rect.width);
    const y = (e.clientY - rect.top) * (preview.height / rect.height);
    const off = state._frameOffset || { dx: 0, dy: 0, scale: 1 };
    // 命中手柄 → resize；命中框内 → move；否则新建
    for (let i = state.boxes.length - 1; i >= 0; i--) {
      const b = state.boxes[i];
      const bx = off.dx + b.x * off.scale, by = off.dy + b.y * off.scale;
      const bw = b.w * off.scale, bh = b.h * off.scale;
      const hs = 10;
      const corners = [
        ['nw', bx, by], ['ne', bx + bw, by], ['sw', bx, by + bh], ['se', bx + bw, by + bh],
        ['n', bx + bw / 2, by], ['s', bx + bw / 2, by + bh], ['w', bx, by + bh / 2], ['e', bx + bw, by + bh / 2],
      ];
      for (const [mode, hx, hy] of corners) {
        if (Math.abs(x - hx) <= hs && Math.abs(y - hy) <= hs) {
          drag = { mode, index: i, sx: x, sy: y, orig: { ...b, bx, by, bw, bh } };
          preview.setPointerCapture(e.pointerId);
          return;
        }
      }
      if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) {
        drag = { mode: 'move', index: i, sx: x, sy: y, orig: { ...b, bx, by, bw, bh } };
        preview.setPointerCapture(e.pointerId);
        return;
      }
    }
    // 新建框（以点击点为中心，60px 起步）
    const w = 120 / off.scale, h = 60 / off.scale;
    const nx = Math.max(0, Math.min(state.video.videoWidth - w, (x - off.dx) / off.scale));
    const ny = Math.max(0, Math.min(state.video.videoHeight - h, (y - off.dy) / off.scale));
    state.boxes.push({ x: nx, y: ny, w, h });
    drag = { mode: 'move', index: state.boxes.length - 1, sx: x, sy: y, orig: { ...state.boxes[state.boxes.length - 1], bx: x, by: y, bw: w * off.scale, bh: h * off.scale } };
    startBtn.disabled = state.boxes.length === 0;
  }

  function onPointerMove(e) {
    if (!drag) return;
    const rect = preview.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (preview.width / rect.width);
    const y = (e.clientY - rect.top) * (preview.height / rect.height);
    const b = state.boxes[drag.index];
    if (!b) return;
    const off = state._frameOffset || { dx: 0, dy: 0, scale: 1 };
    const toV = (px) => (px - off.dx) / off.scale;
    const toH = (py) => (py - off.dy) / off.scale;
    const dx = (x - drag.sx) / off.scale, dy = (y - drag.sy) / off.scale;

    if (drag.mode === 'move') {
      b.x = Math.max(0, Math.min(state.video.videoWidth - b.w, drag.orig.x + dx));
      b.y = Math.max(0, Math.min(state.video.videoHeight - b.h, drag.orig.y + dy));
    } else if (drag.mode === 'resize' || drag.mode.startsWith('n') || drag.mode.startsWith('s') || drag.mode.startsWith('e') || drag.mode.startsWith('w')) {
      // 按角/边调整
      let { x1, y1, x2, y2 } = boxToCorners(b);
      const nx = toV(x), ny = toH(y);
      if (drag.mode.includes('e')) x2 = nx;
      if (drag.mode.includes('w')) x1 = nx;
      if (drag.mode.includes('s')) y2 = ny;
      if (drag.mode.includes('n')) y1 = ny;
      if (x2 - x1 < 8 || y2 - y1 < 8) return;
      b.x = Math.max(0, x1); b.y = Math.max(0, y1);
      b.w = Math.min(state.video.videoWidth - b.x, x2 - x1);
      b.h = Math.min(state.video.videoHeight - b.y, y2 - y1);
    }
    drawBoxes();
  }
  function boxToCorners(b) { return { x1: b.x, y1: b.y, x2: b.x + b.w, y2: b.y + b.h }; }
  function onPointerUp() { drag = null; }

  preview.addEventListener('pointerdown', onPointerDown);
  preview.addEventListener('pointermove', onPointerMove);
  preview.addEventListener('pointerup', onPointerUp);
  preview.addEventListener('pointercancel', onPointerUp);

  /* ---------- 文件加载 ---------- */
  function acceptFile(file) {
    if (!file) return;
    if (!/^video\//.test(file.type) && !/\.(mp4|mov|webm|mkv|avi|m4v)$/i.test(file.name)) {
      toast('请选择视频文件（mp4/mov/webm 等）');
      return;
    }
    if (file.size > 600 * 1024 * 1024) {
      toast('文件过大（>600MB），浏览器内存可能不足');
    }
    reset();
    state.file = file;
    fileMeta.textContent = `${file.name} · ${fmtSize(file.size)}`;
    card.classList.remove('hidden');
    hint.classList.add('hidden');

    const url = URL.createObjectURL(file);
    preview.dataset.url = url;
    const v = document.createElement('video');
    v.preload = 'auto';
    v.muted = true;
    v.playsInline = true;
    v.src = url;
    v.onloadedmetadata = async () => {
      state.video = v;
      previewWrap.classList.remove('hidden');
      // 画布尺寸固定 640×360 逻辑分辨率，内容等比适配
      preview.width = 640;
      preview.height = 360;
      await drawFrame(v, preview, Math.min(1, v.duration / 2));
      setStatus('已加载视频，正在自动检测水印…', 'loading');
      detectBtn.classList.add('hidden');
      await autoDetect();
    };
    v.onerror = () => { setStatus('视频加载失败，请更换文件', 'error'); };
  }

  async function autoDetect() {
    const v = state.video;
    if (!v) return;
    try {
      const boxes = await detectWatermarks(v, { samples: 8 });
      state.boxes = boxes;
      drawBoxes();
      if (boxes.length) {
        setStatus(`✅ 自动检测到 ${boxes.length} 处水印${ffmpegSourceName() ? '' : ''}，可拖动/缩放微调`, '');
      } else {
        setStatus('未检测到明显水印，可在画面中点击添加水印框，或手动框选', '');
      }
      startBtn.disabled = state.boxes.length === 0;
      clearBtn.classList.remove('hidden');
    } catch (e) {
      console.error(e);
      setStatus('检测失败：' + (e.message || '未知错误') + '，可手动框选', 'error');
      startBtn.disabled = true;
    } finally {
      detectBtn.classList.remove('hidden');
    }
  }

  /* ---------- 处理 ---------- */
  async function start() {
    if (state.processing || !state.file) return;
    if (!state.boxes.length) { toast('请先框选水印区域'); return; }
    state.processing = true;
    startBtn.disabled = true;
    detectBtn.disabled = true;
    clearBtn.disabled = true;
    resultWrap.classList.add('hidden');
    progress.classList.remove('hidden');
    logEl.innerHTML = '';
    setStatus('正在处理…首次使用需在浏览器内加载 ffmpeg 引擎（约 30MB），请耐心等待', 'loading');
    addLog('引擎来源：' + (ffmpegSourceName() || '加载中…'));

    let lastPct = -1;
    const onLog = (msg) => {
      if (msg.startsWith('progress:')) {
        const [, p, t] = msg.split(':');
        const pct = Math.min(100, Math.round(Number(p) * 100));
        if (pct !== lastPct) {
          lastPct = pct;
          progressBar.style.width = pct + '%';
          const secs = (Number(t) / 1000).toFixed(1);
          setStatus(`正在去水印… ${pct}%（已处理 ${secs}s / ${state.video ? state.video.duration.toFixed(1) : '?'}s）`, 'loading');
        }
      } else {
        addLog(msg);
      }
    };

    try {
      const blob = await removeWatermarksToMp4(state.file, state.boxes, onLog);
      if (!blob || blob.size < 1024) throw new Error('输出为空（编码失败）');
      progressBar.style.width = '100%';
      setStatus(`✅ 去水印完成（${(blob.size / 1024 / 1024).toFixed(1)} MB mp4）`);
      resultVideo.src = URL.createObjectURL(blob);
      resultWrap.classList.remove('hidden');
      downloadBtn.dataset.size = blob.size;
      downloadBtn._blob = blob;
    } catch (e) {
      console.error(e);
      setStatus('处理失败：' + (e.message || '未知错误') + '（可尝试 Chrome/Edge 最新版）', 'error');
      addLog('失败原因：' + (e.message || '未知错误'));
    } finally {
      state.processing = false;
      startBtn.disabled = false;
      detectBtn.disabled = false;
      clearBtn.disabled = false;
    }
  }

  downloadBtn.addEventListener('click', () => {
    const blob = downloadBtn._blob;
    if (!blob || !state.file) return;
    const base = (state.file.name || 'video').replace(/\.[^.]+$/, '');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = base + '_去水印.mp4';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
    toast('开始下载 mp4');
  });

  againBtn.addEventListener('click', () => { reset(); card.classList.add('hidden'); hint.classList.remove('hidden'); input.value = ''; });

  /* ---------- 事件绑定 ---------- */
  zone.addEventListener('click', (e) => { if (e.target === zone || e.target.closest('.dropzone-inner')) input.click(); });
  input.addEventListener('change', () => acceptFile(input.files && input.files[0]));
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) acceptFile(f);
  });
  detectBtn.addEventListener('click', async () => {
    if (!state.video) return;
    detectBtn.classList.add('hidden');
    setStatus('正在重新检测…', 'loading');
    await autoDetect();
  });
  startBtn.addEventListener('click', () => start());
  clearBtn.addEventListener('click', () => {
    state.boxes = [];
    drawBoxes();
    startBtn.disabled = true;
    toast('已清空水印框');
  });
}

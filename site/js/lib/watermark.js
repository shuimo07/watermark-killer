// 去水印处理：裁剪掉水印区域后本地重编码导出（纯前端，无需登录）
// 兼容性要点：webm(vp8/vp9) 优先（Chromium/Edge 最稳）；mp4 仅作 Safari 回退；
// 视频/画布挂载到 DOM（否则部分浏览器 rAF/rVFC 不触发导致空输出）；失败自动无音频重试

const CORNERS = {
  all: { label: '全局（四边）', crop: (w, h, r) => ({ x: Math.round(w * r), y: Math.round(h * r), w: Math.round(w * (1 - 2 * r)), h: Math.round(h * (1 - 2 * r)) }) },
  br: { label: '右下角', crop: (w, h, r) => ({ x: 0, y: 0, w: Math.round(w * (1 - r)), h: Math.round(h * (1 - r)) }) },
  bc: { label: '底部居中', crop: (w, h, r) => ({ x: 0, y: 0, w, h: Math.round(h * (1 - r)) }) },
  bl: { label: '左下角', crop: (w, h, r) => ({ x: Math.round(w * r), y: 0, w: Math.round(w * (1 - r)), h: Math.round(h * (1 - r)) }) },
  tr: { label: '右上角', crop: (w, h, r) => ({ x: 0, y: Math.round(h * r), w: Math.round(w * (1 - r)), h: Math.round(h * (1 - r)) }) },
};

export const WATERMARK_CORNERS = CORNERS;

/** webm 优先，mp4 兜底（Safari） */
function pickMime() {
  const candidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4',
    'video/mp4;codecs=avc1',
  ];
  for (const m of candidates) {
    try { if (window.MediaRecorder && MediaRecorder.isTypeSupported(m)) return m; } catch { /* ignore */ }
  }
  return 'video/webm';
}

/** 先抓取为 Blob（referrer:'' 绕过防盗链 + CORS 读取），再以 objectURL 加载
 *  → 画布永不跨域污染（captureStream 不会抛 "not origin-clean"） */
async function loadVideo(url, onProgress) {
  if (onProgress) onProgress(0, '正在下载视频…');
  let res;
  try {
    res = await fetch(url, { mode: 'cors', referrer: '' });
  } catch (e) {
    throw new Error('视频下载失败：' + e.message);
  }
  if (!res.ok) throw new Error('视频下载失败：HTTP ' + res.status);
  const blob = await res.blob();
  if (onProgress) onProgress(1, '视频已就绪，开始处理…');

  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.playsInline = true;
    v.muted = true; // 静音播放：自动播放策略不拦截（手势会在异步加载期间过期）
    v.style.cssText = 'position:fixed;opacity:0;width:2px;height:2px;pointer-events:none;';
    document.body.appendChild(v); // 挂载到 DOM：保证 rAF/rVFC 正常触发
    v.src = URL.createObjectURL(blob);
    v.onloadeddata = () => resolve(v);
    v.onerror = () => reject(new Error('视频加载失败'));
    setTimeout(() => reject(new Error('视频加载超时（20秒）')), 20000);
  });
}

/**
 * 裁剪重编码去水印
 * @param {string} url 视频地址
 * @param {object} opts { corner, ratio }
 * @param {(p:number, msg:string)=>void} onProgress
 */
export async function removeWatermarkByCrop(url, { corner = 'br', ratio = 0.12 } = {}, onProgress) {
  const spec = CORNERS[corner] || CORNERS.br;
  const video = await loadVideo(url, onProgress);
  try {
    const w = video.videoWidth;
    const h = video.videoHeight;
    const crop = spec.crop(w, h, ratio);
    if (crop.w < 10 || crop.h < 10) throw new Error('裁剪区域过小');

    const canvas = document.createElement('canvas');
    canvas.width = crop.w;
    canvas.height = crop.h;
    canvas.style.cssText = 'position:fixed;opacity:0;width:2px;height:2px;pointer-events:none;';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    const mime = pickMime();
    const isMp4 = mime.indexOf('mp4') !== -1;

    await video.play();

    // 播放确认后恢复音频（captureStream 取原始音频数据，不受音量影响）
    await new Promise((r) => setTimeout(r, 1200));
    if (video.currentTime < 0.05 && video.duration > 1) {
      throw new Error('视频未能开始播放，请检查网络后重试');
    }
    video.muted = false;
    video.volume = 0;

    // 绘制循环（rAF 为主，稳定跨浏览器）
    let rafId = 0;
    const draw = () => ctx.drawImage(video, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h);
    const loop = () => { draw(); rafId = requestAnimationFrame(loop); };
    draw(); // 预热一帧
    loop();

    // 音轨（可选，失败自动无音频重试）
    let audioTrack = null;
    try {
      const vs = video.captureStream ? video.captureStream() : null;
      const at = vs && vs.getAudioTracks && vs.getAudioTracks();
      if (at && at.length) audioTrack = at[0];
    } catch { /* ignore */ }

    let blob = await record(canvas, video, { mime, audioTrack, onProgress, duration: video.duration });
    if (blob.size < 1000 && audioTrack) {
      // 音频轨疑似导致空输出 → 重试一次不带音频
      blob = await record(canvas, video, { mime, audioTrack: null, onProgress, duration: video.duration });
    }
    if (blob.size < 1000) {
      throw new Error('处理输出为空（浏览器编码器异常），请改用 Chrome/Edge 最新版重试');
    }
    return { blob, ext: isMp4 ? 'mp4' : 'webm' };
  } finally {
    video.pause();
    video.removeAttribute('src');
    video.load();
    video.remove();
  }
}

function record(canvas, video, { mime, audioTrack, onProgress, duration }) {
  return new Promise((resolve) => {
    const stream = canvas.captureStream(30);
    if (audioTrack) {
      try { stream.addTrack(audioTrack); } catch { /* ignore */ }
    }
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6000000, audioBitsPerSecond: 128000 });
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = () => resolve(new Blob(chunks, { type: mime.split(';')[0] }));

    const progTimer = setInterval(() => {
      if (onProgress && duration) onProgress(Math.min(1, video.currentTime / duration), '正在处理…');
    }, 300);

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearInterval(progTimer);
      if (rec.state === 'recording') rec.stop();
    };
    video.onended = finish;
    setTimeout(finish, duration * 1000 + 10000);

    rec.start(1000);
  });
}

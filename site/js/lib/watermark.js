// 去水印处理：裁剪掉水印区域后本地重编码导出（纯前端，无需登录）
// 输出：mp4 优先（Chromium 支持 H.264 录制），webm 仅作兜底（Firefox 等）
// 兼容性要点：Blob 优先加载（避免 canvas 跨域污染）；静音播放绕过自动播放策略；
// 视频/画布挂载 DOM（保证绘制循环触发）；mp4 空输出自动重试（无音频 → webm）

const CORNERS = {
  all: { label: '全局（四边）', crop: (w, h, r) => ({ x: Math.round(w * r), y: Math.round(h * r), w: Math.round(w * (1 - 2 * r)), h: Math.round(h * (1 - 2 * r)) }) },
  br: { label: '右下角', crop: (w, h, r) => ({ x: 0, y: 0, w: Math.round(w * (1 - r)), h: Math.round(h * (1 - r)) }) },
  bc: { label: '底部居中', crop: (w, h, r) => ({ x: 0, y: 0, w, h: Math.round(h * (1 - r)) }) },
  bl: { label: '左下角', crop: (w, h, r) => ({ x: Math.round(w * r), y: 0, w: Math.round(w * (1 - r)), h: Math.round(h * (1 - r)) }) },
  tr: { label: '右上角', crop: (w, h, r) => ({ x: 0, y: Math.round(h * r), w: Math.round(w * (1 - r)), h: Math.round(h * (1 - r)) }) },
};

export const WATERMARK_CORNERS = CORNERS;

/** mp4 优先，webm 兜底 */
function pickMimes() {
  const candidates = [
    'video/mp4;codecs=avc1.42E01E',
    'video/mp4;codecs=avc1',
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  return candidates.filter((m) => {
    try { return window.MediaRecorder && MediaRecorder.isTypeSupported(m); } catch { return false; }
  });
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

/** 重播到开头（静音播放后再恢复音频，规避自动播放策略） */
async function resetPlay(video) {
  video.muted = true;
  video.currentTime = 0;
  await video.play().catch(() => {});
  await new Promise((r) => setTimeout(r, 400));
  video.muted = false;
  video.volume = 0;
}

/**
 * 裁剪重编码去水印
 * @param {string} url 视频地址
 * @param {object} opts { corner, ratio }
 * @param {(p:number, msg:string)=>void} onProgress
 */
export async function removeWatermarkByCrop(url, { corner = 'all', ratio = 0.10 } = {}, onProgress) {
  const spec = CORNERS[corner] || CORNERS.all;
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

    const mimes = pickMimes();
    if (!mimes.length) throw new Error('当前浏览器不支持视频编码');

    await video.play();
    await new Promise((r) => setTimeout(r, 1200));
    if (video.currentTime < 0.05 && video.duration > 1) {
      throw new Error('视频未能开始播放，请检查网络后重试');
    }
    video.muted = false;
    video.volume = 0;

    // 音轨（可选）
    let audioTrack = null;
    try {
      const vs = video.captureStream ? video.captureStream() : null;
      const at = vs && vs.getAudioTracks && vs.getAudioTracks();
      if (at && at.length) audioTrack = at[0];
    } catch { /* ignore */ }

    // 绘制循环
    let rafId = 0;
    const draw = () => ctx.drawImage(video, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h);
    const loop = () => { draw(); rafId = requestAnimationFrame(loop); };
    draw(); // 预热一帧
    loop();

    video.currentTime = 0; // 回卷到开头，确保录制覆盖全片（seek 不触发自动播放策略）

    // 编码尝试链：mp4(带音频) → mp4(无音频) → webm(无音频)
    let blob = null;
    let ext = 'webm';
    outer: for (const mime of mimes) {
      const attempts = mime.indexOf('mp4') !== -1 ? [audioTrack, null] : [null];
      for (const at of attempts) {
        if (blob && blob.size >= 1000) break outer;
        if (video.ended || video.currentTime >= video.duration - 0.05) await resetPlay(video);
        blob = await record(canvas, video, { mime, audioTrack: at, onProgress, duration: video.duration });
        if (blob.size >= 1000) {
          ext = mime.indexOf('mp4') !== -1 ? 'mp4' : 'webm';
          break outer;
        }
      }
    }
    if (!blob || blob.size < 1000) {
      throw new Error('处理输出为空（浏览器编码器异常），请换用 Chrome/Edge 最新版重试');
    }
    return { blob, ext };
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

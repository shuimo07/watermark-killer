// 去水印处理：裁剪掉水印区域后本地重编码导出（纯前端，无需登录）
// 原理：豆包/Seedance 水印固定在下角 → 用 canvas 裁掉该区域 → MediaRecorder 重编码为 mp4/webm

const CORNERS = {
  br: { label: '右下角', crop: (w, h, r) => ({ x: 0, y: 0, w: Math.round(w * (1 - r)), h: Math.round(h * (1 - r)) }) },
  bc: { label: '底部居中', crop: (w, h, r) => ({ x: 0, y: 0, w, h: Math.round(h * (1 - r)) }) },
  bl: { label: '左下角', crop: (w, h, r) => ({ x: Math.round(w * r), y: 0, w: Math.round(w * (1 - r)), h: Math.round(h * (1 - r)) }) },
  tr: { label: '右上角', crop: (w, h, r) => ({ x: 0, y: Math.round(h * r), w: Math.round(w * (1 - r)), h: Math.round(h * (1 - r)) }) },
};

export const WATERMARK_CORNERS = CORNERS;

function pickMime() {
  const candidates = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  for (const m of candidates) {
    try { if (window.MediaRecorder && MediaRecorder.isTypeSupported(m)) return m; } catch { /* ignore */ }
  }
  return 'video/webm';
}

/** 加载视频（referrer:'' 绕过防盗链），返回 video 元素 */
function loadVideo(url) {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.playsInline = true;
    v.volume = 0; // 保留音频轨道但静音（muted 会掐掉音频轨）
    v.setAttribute('referrerpolicy', 'no-referrer');
    v.src = url;
    v.onloadeddata = () => resolve(v);
    v.onerror = () => reject(new Error('视频加载失败'));
    setTimeout(() => reject(new Error('视频加载超时（20秒）')), 20000);
  });
}

/**
 * 裁剪重编码去水印
 * @param {string} url 视频地址
 * @param {object} opts { corner: 'br'|'bc'|'bl'|'tr', ratio: 裁剪比例(0-1) }
 * @param {(p:number, msg:string)=>void} onProgress
 * @returns {Promise<{blob: Blob, ext: string}>}
 */
export async function removeWatermarkByCrop(url, { corner = 'br', ratio = 0.12 } = {}, onProgress) {
  const spec = CORNERS[corner] || CORNERS.br;
  const video = await loadVideo(url);
  const w = video.videoWidth;
  const h = video.videoHeight;
  const crop = spec.crop(w, h, ratio);
  if (crop.w < 10 || crop.h < 10) throw new Error('裁剪区域过小');

  const canvas = document.createElement('canvas');
  canvas.width = crop.w;
  canvas.height = crop.h;
  const ctx = canvas.getContext('2d');

  const stream = canvas.captureStream(30);
  // 附加音轨
  try {
    const vs = video.captureStream ? video.captureStream() : null;
    const at = vs && vs.getAudioTracks && vs.getAudioTracks();
    if (at && at.length) stream.addTrack(at[0]);
  } catch { /* 无音轨则静音输出 */ }

  const mime = pickMime();
  const isMp4 = mime.indexOf('mp4') !== -1;
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6000000, audioBitsPerSecond: 128000 });
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  const stopped = new Promise((res) => { rec.onstop = () => res(new Blob(chunks, { type: mime.split(';')[0] })); });

  await video.play();

  // 健壮性：确认视频真的在播放（部分浏览器/网络下 play() 静默失败）
  const stallTimer = setTimeout(() => {
    if (video.currentTime < 0.05 && video.duration > 1) {
      try { rec.stop(); } catch { /* ignore */ }
      video.pause();
    }
  }, 3000);
  await new Promise((r) => setTimeout(r, 2500));
  clearTimeout(stallTimer);
  if (video.currentTime < 0.05 && video.duration > 1) {
    throw new Error('视频未能开始播放，请检查网络后重试');
  }

  rec.start(500);

  const draw = () => ctx.drawImage(video, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h);
  let raf = 0;
  if ('requestVideoFrameCallback' in video) {
    const tick = () => { video.requestVideoFrameCallback(() => { draw(); tick(); }); };
    tick();
  } else {
    const iv = setInterval(draw, 33);
    raf = iv;
  }

  // 进度
  const progTimer = setInterval(() => {
    if (onProgress && video.duration) onProgress(Math.min(1, video.currentTime / video.duration), '正在处理…');
  }, 300);

  const finish = () => {
    if (rec.state === 'recording') rec.stop();
    clearInterval(progTimer);
    if (raf) clearInterval(raf);
    video.pause();
  };

  video.onended = finish;
  setTimeout(finish, video.duration * 1000 + 8000); // 兜底

  const blob = await stopped;
  if (blob.size < 1000) throw new Error('处理输出为空（浏览器编码器不可用，请换用 Chrome/Edge）');
  return { blob, ext: isMp4 ? 'mp4' : 'webm' };
}

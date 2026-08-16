// ffmpeg.wasm 封装：本地文件 → delogo 去水印 → mp4（H.264 + AAC）
// 核心：FFmpeg 的 delogo 滤镜会用周围像素插值填补水印区域（非裁剪、非模糊补丁），
//       是纯前端可用的最佳「真·去水印」手段。输出固定为 .mp4。
// 加载策略：优先同仓库 vendor 文件（GitHub Pages 自托管，国内可访问）；
//          失败回退 jsDelivr CDN（跨域 Worker 需 blob URL 包装）。

import { FFmpeg } from '../../vendor/ffmpeg/index.js';

let ffmpegPromise = null;
let loadedFrom = null;

/** 把远程文件包装成同源 blob URL（绕过跨域 Worker import 限制）；带超时防挂起 */
async function toBlobURL(url, mime, timeoutMs = 45000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error('加载 ffmpeg 资源失败：HTTP ' + res.status + ' (' + url + ')');
    const blob = await res.blob();
    return URL.createObjectURL(new Blob([blob], { type: mime }));
  } finally {
    clearTimeout(timer);
  }
}

const VENDOR_BASE = new URL('../../vendor/ffmpeg/', import.meta.url).href;
const CDN_BASE = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm/';

async function loadFFmpeg() {
  // 1) 优先本地 vendor
  const sources = [
    { name: '本地内置', base: VENDOR_BASE },
    { name: 'CDN 回退', base: CDN_BASE },
  ];
  let lastErr = null;
  for (const src of sources) {
    try {
      const coreURL = await toBlobURL(src.base + 'ffmpeg-core.js', 'text/javascript');
      const wasmURL = await toBlobURL(src.base + 'ffmpeg-core.wasm', 'application/wasm');
      const ffmpeg = new FFmpeg();
      await ffmpeg.load({ coreURL, wasmURL });
      loadedFrom = src.name;
      return ffmpeg;
    } catch (e) {
      lastErr = e;
      console.warn(`[ffmpeg] ${src.name} 加载失败`, e);
    }
  }
  throw new Error('ffmpeg 引擎加载失败：' + (lastErr && lastErr.message ? lastErr.message : '未知错误'));
}

/** 获取（懒加载）ffmpeg 实例 */
export async function getFFmpeg() {
  if (!ffmpegPromise) ffmpegPromise = loadFFmpeg();
  return ffmpegPromise;
}

/** 释放引擎（处理超大文件后可选调用） */
export async function disposeFFmpeg() {
  if (ffmpegPromise) {
    try { (await ffmpegPromise).terminate(); } catch { /* ignore */ }
    ffmpegPromise = null;
  }
}

export function ffmpegSourceName() {
  return loadedFrom;
}

/**
 * 用 delogo 滤镜去除水印并输出 mp4
 * @param {File|Blob} file 原始视频文件
 * @param {Array<{x,y,w,h}>} boxes 水印框（原始分辨率）
 * @param {(msg:string)=>void} onLog 日志/进度回调（progress:百分比:毫秒）
 * @returns {Promise<Blob>} mp4 文件
 */
export async function removeWatermarksToMp4(file, boxes, onLog) {
  const ffmpeg = await getFFmpeg();
  const t0 = Date.now();

  // 每次运行挂独立的 log/progress 监听（引擎实例被缓存，避免回调串台）
  const logCb = ({ message }) => onLog && onLog(message);
  const progCb = ({ progress, time }) => {
    if (onLog) onLog(`progress:${Math.round(progress * 100)}:${Math.round(time / 1e6)}`);
  };
  ffmpeg.on('log', logCb);
  ffmpeg.on('progress', progCb);

  onLog && onLog('写入输入文件…');
  const inName = 'input_' + Date.now() + '.mp4';
  const outName = 'output_' + Date.now() + '.mp4';
  await ffmpeg.writeFile(inName, new Uint8Array(await file.arrayBuffer()));

  // 生成 delogo 滤镜串（多框串联）；delogo 要求框完全在帧内（x>=1, x+w<=vw-1, 最小 2px）
  const { videoWidth: vw, videoHeight: vh } = await probeSize(file);
  const filters = boxes
    .map((b) => {
      const x = Math.min(Math.max(1, Math.round(b.x)), vw - 2);
      const y = Math.min(Math.max(1, Math.round(b.y)), vh - 2);
      const w = Math.min(vw - 1 - x, Math.max(2, Math.round(b.w)));
      const h = Math.min(vh - 1 - y, Math.max(2, Math.round(b.h)));
      return `delogo=x=${x}:y=${y}:w=${w}:h=${h}`;
    })
    .join(',');

  // 参数：libx264 + aac → mp4；crf 20 高质；veryfast 提速；faststart 网页直播
  const args = [
    '-i', inName,
    '-vf', filters || 'null',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '20',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-movflags', '+faststart',
    '-y', outName,
  ];

  onLog && onLog('开始编码（delogo 逐帧插值，请耐心等待）…');
  let data;
  try {
    await ffmpeg.exec(args);
    data = await ffmpeg.readFile(outName);
  } finally {
    // 卸载本次监听，避免多次处理后回调堆积
    ffmpeg.off('log', logCb);
    ffmpeg.off('progress', progCb);
  }

  try { await ffmpeg.deleteFile(inName); } catch { /* ignore */ }
  try { await ffmpeg.deleteFile(outName); } catch { /* ignore */ }

  onLog && onLog(`编码完成，耗时 ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  return new Blob([data.buffer], { type: 'video/mp4' });
}

/** 从 File 读取视频宽高（不加载整段） */
function probeSize(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    v.onloadedmetadata = () => {
      const info = { videoWidth: v.videoWidth, videoHeight: v.videoHeight, duration: v.duration };
      URL.revokeObjectURL(url);
      resolve(info);
    };
    v.onerror = () => { URL.revokeObjectURL(url); reject(new Error('无法读取视频信息')); };
    v.src = url;
  });
}

export { probeSize };

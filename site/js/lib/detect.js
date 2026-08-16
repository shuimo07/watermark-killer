// 水印自动检测：对视频抽帧做时间维分析，找出「静止 + 文字/logo 边缘」区域 → 返回水印框
// 原理：
//   1. 等间隔抽 K 帧（覆盖全片），缩放到工作分辨率
//   2. 逐像素计算时间维 均值/标准差 —— 半透明水印 α·W+(1-α)·C(t) 的方差被压缩为 (1-α)²·var(C)
//   3. 关键判别：像素时间方差 / 邻域平均时间方差 的比值 —— 水印处显著低于周围（相对压缩），
//      而静止场景（整个画面方差都低）比值≈1，不会误报
//   4. 再对均值帧做 Sobel 边缘检测 —— 水印（文字/logo）边缘强，静止背景平坦
//   5. mask = 方差相对压缩 AND 强边缘 → 形态学闭运算 → 连通域 → 外接框
// 适用：豆包/即梦等 AI 视频的「半透明静态水印」（logo/文字），纯前端、无需模型

const WORK_HEIGHT = 360; // 检测用工作分辨率（高度），宽按比例

/** 等间隔抽取视频帧（canvas 像素数据，灰度） */
async function sampleFrames(video, count) {
  const vw = video.videoWidth, vh = video.videoHeight;
  const scale = WORK_HEIGHT / vh;
  const w = Math.max(2, Math.round(vw * scale));
  const h = WORK_HEIGHT;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const frames = [];
  const dur = video.duration;
  for (let i = 0; i < count; i++) {
    const t = dur * (i + 0.5) / count;
    video.currentTime = t;
    await new Promise((res) => {
      const done = () => { video.removeEventListener('seeked', done); res(); };
      video.addEventListener('seeked', done);
      setTimeout(() => { video.removeEventListener('seeked', done); res(); }, 3000);
    });
    ctx.drawImage(video, 0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h).data;
    const gray = new Float32Array(w * h);
    for (let p = 0, j = 0; p < img.length; p += 4, j++) {
      gray[j] = img[p] * 0.299 + img[p + 1] * 0.587 + img[p + 2] * 0.114;
    }
    frames.push(gray);
  }
  return { frames, w, h, scale: 1 / scale, vw, vh };
}

/** Sobel 梯度幅值（8bit 图） */
function sobel(gray, w, h) {
  const out = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx =
        gray[i - w - 1] - gray[i - w + 1] +
        2 * gray[i - 1] - 2 * gray[i + 1] +
        gray[i + w - 1] - gray[i + w + 1];
      const gy =
        gray[i - w - 1] + 2 * gray[i - w] + gray[i - w + 1] -
        gray[i + w - 1] - 2 * gray[i + w] - gray[i + w + 1];
      out[i] = Math.sqrt(gx * gx + gy * gy);
    }
  }
  return out;
}

/** 盒式模糊（滑动窗口均值，o(1) 累积和） */
function boxBlur(src, w, h, r) {
  const out = new Float32Array(w * h);
  const col = new Float32Array(w * h);
  const k = 2 * r + 1;
  // 横向
  for (let y = 0; y < h; y++) {
    let acc = 0;
    const row = y * w;
    for (let x = 0; x < w; x++) {
      acc += src[row + x];
      if (x - k >= 0) acc -= src[row + x - k];
      col[row + x] = acc / Math.min(k, x + 1);
    }
  }
  // 纵向
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = 0; y < h; y++) {
      acc += col[y * w + x];
      if (y - k >= 0) acc -= col[(y - k) * w + x];
      out[y * w + x] = acc / Math.min(k, y + 1);
    }
  }
  return out;
}

/** 形态学膨胀（3x3 十字） */
function dilate(mask, w, h, passes) {
  let m = mask;
  for (let k = 0; k < passes; k++) {
    const next = new Uint8Array(m);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        if (m[i]) continue;
        if (m[i - 1] || m[i + 1] || m[i - w] || m[i + w]) next[i] = 1;
      }
    }
    m = next;
  }
  return m;
}

/** 连通域外接框 */
function connectedBoxes(mask, w, h) {
  const visited = new Uint8Array(w * h);
  const boxes = [];
  const stack = [];
  for (let i = 0; i < w * h; i++) {
    if (!mask[i] || visited[i]) continue;
    visited[i] = 1;
    stack.push(i);
    let minX = w, minY = h, maxX = -1, maxY = -1, count = 0;
    while (stack.length) {
      const p = stack.pop();
      const x = p % w, y = (p / w) | 0;
      count++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (x > 0 && mask[p - 1] && !visited[p - 1]) { visited[p - 1] = 1; stack.push(p - 1); }
      if (x < w - 1 && mask[p + 1] && !visited[p + 1]) { visited[p + 1] = 1; stack.push(p + 1); }
      if (y > 0 && mask[p - w] && !visited[p - w]) { visited[p - w] = 1; stack.push(p - w); }
      if (y < h - 1 && mask[p + w] && !visited[p + w]) { visited[p + w] = 1; stack.push(p + w); }
    }
    boxes.push({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, count });
  }
  return boxes;
}

/**
 * 核心检测：给定灰度帧序列，返回工作分辨率下的水印框
 * （纯函数，可在 Node 中单元测试）
 * @param {Float32Array[]} frames 每帧灰度数据（长度 w*h）
 * @param {number} w @param {number} h
 * @param {object} opts
 */
export function computeWatermarkBoxes(frames, w, h, opts = {}) {
  const {
    relVarThresh = 0.45, // 像素时间方差 / 邻域时间方差 比值阈值（低于此 → 相对压缩 → 疑似水印）
    motionFloor = 1.5,   // 邻域时间方差下限：低于此说明周边也静止（整块静止场景），不判为水印
    edgeThresh = 30,     // Sobel 边缘阈值
    blurRadius = 8,      // 邻域统计半径（工作分辨率）
    areaRatioMin = 0.001,  // 最小面积占比（滤掉噪点/细线）
    areaRatioMax = 0.18,   // 最大面积占比（整屏静止场景不判为水印）
    pad = 0.01,
  } = opts;

  const n = w * h;

  // 时间维均值 + 标准差
  const mean = new Float32Array(n);
  for (const f of frames) for (let i = 0; i < n; i++) mean[i] += f[i];
  for (let i = 0; i < n; i++) mean[i] /= frames.length;
  const sqSum = new Float32Array(n);
  for (const f of frames) {
    for (let i = 0; i < n; i++) { const d = f[i] - mean[i]; sqSum[i] += d * d; }
  }
  const std = new Float32Array(n);
  for (let i = 0; i < n; i++) std[i] = Math.sqrt(sqSum[i] / frames.length);

  // 邻域平均时间方差（盒式模糊）—— 归一化参照
  const stdBlur = boxBlur(std, w, h, blurRadius);

  // 均值帧 Sobel 边缘
  const edge = sobel(mean, w, h);

  // mask：水印 = 自身方差被压缩（相对周边）AND 周边在运动 AND 文字/logo 边缘
  // 关键：静态内容区域（std≈0 且周边也静止）不满足 motionFloor，不会误报
  let mask = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const ref = stdBlur[i];
    if (ref < motionFloor) continue;              // 周边静止 → 不是水印（静止场景）
    if (std[i] / ref < relVarThresh && edge[i] > edgeThresh) mask[i] = 1;
  }

  // 形态学闭运算（膨胀多次连接文字笔画 → 收缩去毛刺）
  mask = dilate(mask, w, h, 2);
  mask = dilate(mask, w, h, 2);
  mask = dilate(mask, w, h, 1);

  let boxes = connectedBoxes(mask, w, h);

  // 过滤：尺寸占画面合理比例（排除整屏静止场景/过小噪点/细线）
  const padPx = (w + h) / 2 * pad;
  const filtered = [];
  for (const b of boxes) {
    const ratio = (b.w * b.h) / (w * h);
    if (ratio < areaRatioMin || ratio > areaRatioMax) continue;
    if (b.w < w * 0.008 || b.h < h * 0.008) continue; // 太细（边框线/单像素噪点）
    let bx = Math.max(0, b.x - padPx);
    let by = Math.max(0, b.y - padPx);
    let bw = Math.min(w, b.x + b.w + padPx) - bx;
    let bh = Math.min(h, b.y + b.h + padPx) - by;
    if (bw < 6 || bh < 6) continue;
    filtered.push({ x: bx, y: by, w: bw, h: bh });
  }
  boxes = filtered;

  // 合并重叠/相邻的框（同一水印的文字笔画可能被拆成多个连通域）
  boxes = mergeBoxes(boxes, w, h);

  return { boxes, std, w, h };
}

/** 合并重叠或紧邻的框（迭代直到稳定） */
function mergeBoxes(boxes, w, h) {
  if (boxes.length <= 1) return boxes;
  let merged = true;
  let cur = boxes.map((b) => ({ ...b }));
  while (merged && cur.length > 1) {
    merged = false;
    const next = [];
    const used = new Array(cur.length).fill(false);
    for (let i = 0; i < cur.length; i++) {
      if (used[i]) continue;
      let box = { ...cur[i] };
      for (let j = i + 1; j < cur.length; j++) {
        if (used[j]) continue;
        const a = box, b = cur[j];
        // 膨胀后的矩形是否相交（含紧邻）
        const exp = Math.max(w, h) * 0.015;
        if (
          a.x - exp < b.x + b.w && a.x + a.w + exp > b.x &&
          a.y - exp < b.y + b.h && a.y + a.h + exp > b.y
        ) {
          box = {
            x: Math.min(a.x, b.x),
            y: Math.min(a.y, b.y),
            w: Math.max(a.x + a.w, b.x + b.w) - Math.min(a.x, b.x),
            h: Math.max(a.y + a.h, b.y + b.h) - Math.min(a.y, b.y),
          };
          used[j] = true;
          merged = true;
        }
      }
      next.push(box);
      used[i] = true;
    }
    cur = next;
  }
  return cur;
}

/**
 * 自动检测水印区域
 * @param {HTMLVideoElement} video 已加载元数据的视频
 * @param {object} opts
 * @returns {Promise<Array<{x,y,w,h}>>} 原始分辨率下的水印框列表
 */
export async function detectWatermarks(video, opts = {}) {
  const { samples = 8 } = opts;
  const { frames, w, h, scale, vw, vh } = await sampleFrames(video, samples);
  const { boxes } = computeWatermarkBoxes(frames, w, h, opts);

  // 映射回原始分辨率
  const out = boxes.map((b) => ({
    x: Math.round(b.x * scale),
    y: Math.round(b.y * scale),
    w: Math.round(b.w * scale),
    h: Math.round(b.h * scale),
  }));

  // 若一个都没检出（画面几乎全静止等极端情况），回退：检查四个角落的常用水印位
  if (!out.length) {
    const corners = [
      { x: vw * 0.6, y: vh * 0.82, w: vw * 0.38, h: vh * 0.16 }, // 右下
      { x: vw * 0.02, y: vh * 0.82, w: vw * 0.38, h: vh * 0.16 }, // 左下
      { x: vw * 0.6, y: vh * 0.02, w: vw * 0.38, h: vh * 0.16 }, // 右上
      { x: vw * 0.02, y: vh * 0.02, w: vw * 0.38, h: vh * 0.16 }, // 左上
    ];
    // 仅当角落区域时间方差也低时采纳（避免误伤动态内容）
    const cw = Math.max(8, Math.round(w * 0.38)), ch = Math.max(8, Math.round(h * 0.16));
    const std = computeWatermarkBoxes(frames, w, h, opts).std;
    const hasStatic = (cx, cy) => {
      const sx = Math.round(cx * scale), sy = Math.round(cy * scale);
      let sum = 0, cnt = 0;
      for (let yy = sy; yy < sy + ch && yy < h; yy += 2) {
        for (let xx = sx; xx < sx + cw && xx < w; xx += 2) {
          sum += std[yy * w + xx]; cnt++;
        }
      }
      return cnt ? sum / cnt < 6 : false;
    };
    for (const c of corners) {
      if (hasStatic(c.x, c.y)) out.push({ x: Math.round(c.x), y: Math.round(c.y), w: Math.round(c.w), h: Math.round(c.h) });
    }
  }

  return out;
}

/** 把视频某一帧画到 canvas（预览用） */
export function drawFrame(video, canvas, t = 1) {
  return new Promise((res) => {
    const draw = () => {
      const scale = Math.min(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
      const dw = video.videoWidth * scale, dh = video.videoHeight * scale;
      const dx = (canvas.width - dw) / 2, dy = (canvas.height - dh) / 2;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(video, dx, dy, dw, dh);
      res();
    };
    if (Math.abs(video.currentTime - t) < 0.05) { draw(); return; }
    const onSeeked = () => { video.removeEventListener('seeked', onSeeked); draw(); };
    video.addEventListener('seeked', onSeeked);
    video.currentTime = t;
    setTimeout(() => { video.removeEventListener('seeked', onSeeked); draw(); }, 3000);
  });
}

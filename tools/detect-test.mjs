// detect.js 算法单元测试：合成「动态内容 + 半透明静态水印」帧序列，验证能定位水印框
// 运行：node tools/detect-test.mjs
import { computeWatermarkBoxes } from '../site/js/lib/detect.js';

const W = 320, H = 180;
const N = 8;

// 合成一帧：动态斜纹（位置随时间移动）+ 右下角半透明白色水印文字块
function synthFrame(t) {
  const f = new Float32Array(W * H);
  const shift = Math.round(t * 6) % 40; // 内容每帧移动
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = 60 + ((x + y + shift) % 40) * 2; // 动态斜纹 60~138
      f[y * W + x] = v;
    }
  }
  // 半透明水印：右下角 200,130 ~ 300,170 白色 60% 叠加
  const alpha = 0.6;
  for (let y = 130; y < 170; y++) {
    for (let x = 200; x < 300; x++) {
      const i = y * W + x;
      f[i] = f[i] * (1 - alpha) + 255 * alpha;
    }
  }
  // 加一点水印纹理（模拟文字笔画，制造边缘）
  for (let y = 138; y < 162; y += 6) {
    for (let x = 205; x < 295; x++) {
      if ((x + y) % 7 < 3) f[y * W + x] = 235;
    }
  }
  return f;
}

const frames = [];
for (let i = 0; i < N; i++) frames.push(synthFrame(i));

const { boxes } = computeWatermarkBoxes(frames, W, H);

console.log('detected boxes:', JSON.stringify(boxes));
if (!boxes.length) {
  console.error('FAIL: no watermark box detected');
  process.exit(1);
}
// 期望框大致覆盖 200,130 ~ 300,170
const b = boxes[0];
const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
const okX = cx > 230 && cx < 280;
const okY = cy > 135 && cy < 165;
const okArea = b.w > 50 && b.h > 15 && b.w < 140 && b.h < 60;
console.log(`box center=(${cx.toFixed(1)},${cy.toFixed(1)}) size=${b.w}x${b.h}`);
if (!(okX && okY && okArea)) {
  console.error('FAIL: box does not match expected watermark region (200,130)-(300,170)');
  process.exit(1);
}
console.log('=== DETECT TEST PASSED ===');
process.exit(0);

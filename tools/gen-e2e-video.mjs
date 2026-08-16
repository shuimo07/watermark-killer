// 生成带水印的测试视频文件（供浏览器 E2E 使用）
// 运行：node tools/gen-e2e-video.mjs <输出路径>
const { default: createFFmpegCore } = await import('../site/vendor/ffmpeg/ffmpeg-core.js');
const fs = await import('node:fs');
const path = await import('node:path');

const OUT = process.argv[2] || 'E:/AI/watermark-killer/.tmp/e2e-input.mp4';
const locateFile = (p) => {
  if (p.endsWith('.wasm')) return new URL('../site/vendor/ffmpeg/ffmpeg-core.wasm', import.meta.url).pathname;
  return p;
};
const mod = await createFFmpegCore({ locateFile, mainScriptUrlOrBlob: '' });
const ffmpeg = mod;

// 720x480 测试视频：动态测试图 + 右下角半透明水印框 + 顶部居中水印（模拟豆包多水印）
let ret = await ffmpeg.exec(
  '-f', 'lavfi', '-i', 'testsrc2=duration=4:size=720x480:rate=25',
  '-vf', "drawbox=x=560:y=400:w=140:h=60:color=white@0.6:t=fill,drawbox=x=200:y=30:w=320:h=48:color=white@0.55:t=fill",
  '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
  '-f', 'mp4', '-y', 'test.mp4',
);
if (ret !== 0) throw new Error('gen failed ' + ret);

const data = ffmpeg.FS.readFile('test.mp4');
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, Buffer.from(data));
console.log('written:', OUT, data.length, 'bytes');
process.exit(0);

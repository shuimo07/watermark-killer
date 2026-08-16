// Node 端冒烟测试：验证 ffmpeg-core.wasm 可加载、delogo 滤镜可用、mp4 可产出
// 用 ffmpeg 自己生成一个带水印框的测试视频 → delogo 去除 → 校验输出
// 运行：node tools/smoke-test.mjs
const { default: createFFmpegCore } = await import('../site/vendor/ffmpeg/ffmpeg-core.js');

const locateFile = (path) => {
  if (path.endsWith('.wasm')) return new URL('../site/vendor/ffmpeg/ffmpeg-core.wasm', import.meta.url).pathname;
  return path;
};

console.log('loading core...');
const mod = await createFFmpegCore({ locateFile, mainScriptUrlOrBlob: '' });
console.log('core loaded OK');
const ffmpeg = mod;

ffmpeg.setLogger((d) => { if (d.level === 'error' || d.level === 'fatal') console.log('FFLOG', d.level, d.message); });

// 生成 320x240 测试视频：动态测试图 + 右下角半透明水印框（模拟豆包水印）
console.log('generating test input...');
let ret = await ffmpeg.exec(
  '-f', 'lavfi', '-i', 'testsrc2=duration=2:size=320x240:rate=25',
  '-vf', "drawbox=x=252:y=192:w=60:h=40:color=white@0.65:t=fill",
  '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
  '-y', 'in.mp4',
);
if (ret !== 0) throw new Error('input generation failed ret=' + ret);
const inSize = ffmpeg.FS.stat('in.mp4').size;
console.log('input.mp4 size:', inSize, 'bytes');
if (inSize < 1000) throw new Error('input too small - generation failed');

// delogo 去除水印框（框：x=252,y=192,w=60,h=40）
console.log('running delogo...');
ret = await ffmpeg.exec(
  '-i', 'in.mp4',
  '-vf', 'delogo=x=252:y=192:w=60:h=40',
  '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '20', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart',
  '-y', 'out.mp4',
);
if (ret !== 0) throw new Error('delogo failed ret=' + ret);
const outSize = ffmpeg.FS.stat('out.mp4').size;
console.log('output.mp4 size:', outSize, 'bytes');
if (outSize < 1000) throw new Error('output too small - delogo failed');

// 校验 mp4 头（ftyp box）
const data = ffmpeg.FS.readFile('out.mp4');
const head = Buffer.from(data.slice(0, 16)).toString('ascii');
console.log('output header:', head);
if (!head.includes('ftyp')) throw new Error('not a valid mp4');

console.log('=== SMOKE TEST PASSED: delogo + mp4 pipeline works ===');
process.exit(0);

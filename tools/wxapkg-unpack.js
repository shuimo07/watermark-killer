// wxapkg V1MMWX 解密 + 解包脚本（算法源自 unveilr 开源项目，Node 零依赖实现）
// 用法: node wxapkg-unpack.js <输入wxapkg> <输出目录> [appid]
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function decryptWxapkg(buf, appid) {
  if (buf.subarray(0, 6).toString('hex') !== '56314d4d5758') {
    throw new Error('not a V1MMWX encrypted package');
  }
  const header = buf.subarray(6, 0x406);
  const contents = buf.subarray(0x406);
  const key = crypto.pbkdf2Sync(appid, 'saltiest', 1000, 32, 'sha1');
  const iv = Buffer.from('the iv: 16 bytes', 'utf8');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  decipher.setAutoPadding(false);
  const oriHeader = Buffer.concat([decipher.update(header), decipher.final()]);
  const xorKey = appid.charCodeAt(appid.length - 2);
  const oriContents = Buffer.alloc(contents.length);
  for (let i = 0; i < contents.length; i++) oriContents[i] = contents[i] ^ xorKey;
  const decrypted = Buffer.concat([oriHeader.subarray(0, 0x3ff), oriContents]);
  if (decrypted[0] !== 0xbe || decrypted[13] !== 0xed) {
    throw new Error('decrypt check failed (wrong appid or unsupported version)');
  }
  return decrypted;
}

function extractFiles(decrypted, outDir) {
  const infoLength = decrypted.readUInt32BE(5);
  const idx = decrypted.subarray(14, 14 + infoLength);
  const fileCount = idx.readUInt32BE(0);
  let off = 4;
  const files = [];
  for (let i = 0; i < fileCount; i++) {
    const nameLen = idx.readUInt32BE(off); off += 4;
    const name = idx.toString('utf8', off, off + nameLen); off += nameLen;
    const start = idx.readUInt32BE(off); off += 4;
    const len = idx.readUInt32BE(off); off += 4;
    files.push({ name, start, end: start + len });
  }
  for (const f of files) {
    const rel = f.name.startsWith('/') ? f.name.slice(1) : f.name;
    const target = path.join(outDir, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, decrypted.subarray(f.start, f.end));
  }
  return files.map((f) => f.name);
}

const input = process.argv[2];
const outDir = process.argv[3];
const appid = (process.argv[4] || input.match(/wx[a-z\d]{16}/)?.[0] || '').toLowerCase();

if (!appid) { console.error('appid not found in path, pass it explicitly'); process.exit(1); }

const buf = fs.readFileSync(input);
console.log(`[${appid}] input: ${input} (${buf.length} bytes)`);
const decrypted = decryptWxapkg(buf, appid);
const files = extractFiles(decrypted, outDir);
console.log(`[${appid}] decrypted OK, extracted ${files.length} files to ${outDir}`);
console.log(files.join('\n'));

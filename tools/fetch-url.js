// Universal downloader: fetches a URL (skipping TLS verification for the SteamTools MITM proxy) and
// either prints to stdout or saves to a file.
// usage: node fetch-url.js <url> [outfile]
const https = require('https');
const fs = require('fs');

const url = process.argv[2];
const out = process.argv[3];

https.get(url, { rejectUnauthorized: false, headers: { 'User-Agent': 'Mozilla/5.0 (research)' } }, (res) => {
  if (res.statusCode >= 400) {
    console.error('HTTP', res.statusCode, 'for', url);
    process.exit(1);
  }
  const chunks = [];
  res.on('data', (c) => chunks.push(c));
  res.on('end', () => {
    const buf = Buffer.concat(chunks);
    if (out) {
      fs.writeFileSync(out, buf);
      console.log('saved', buf.length, 'bytes to', out);
    } else {
      process.stdout.write(buf.toString('utf8'));
    }
  });
}).on('error', (e) => { console.error('ERR', e.message); process.exit(1); });

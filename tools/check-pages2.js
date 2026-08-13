// 深入检查 Pages 部署/构建状态
const https = require('https');

function get(url) {
  return new Promise((resolve) => {
    https
      .get(url, { rejectUnauthorized: false, headers: { 'User-Agent': 'Mozilla/5.0 (research)', Accept: 'application/vnd.github+json' } }, (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => resolve({ status: res.statusCode, body: d }));
      })
      .on('error', (e) => resolve({ status: 0, body: 'ERR: ' + e.message }));
  });
}

(async () => {
  const base = 'https://api.github.com/repos/shuimo07/watermark-killer';

  const builds = await get(base + '/pages/builds?per_page=5');
  console.log('=== Pages 构建记录 ===');
  if (builds.status === 200) {
    const arr = JSON.parse(builds.body);
    if (arr.length) {
      arr.forEach((b) => console.log(`  ${b.created_at} | status=${b.status} | error=${b.error && b.error.message || '无'} | commit=${(b.commit || '').slice(0, 8)}`));
    } else console.log('  无构建记录');
  } else console.log('API', builds.status, builds.body.slice(0, 150));

  const deploys = await get(base + '/deployments?per_page=5');
  console.log('\n=== 部署记录 ===');
  if (deploys.status === 200) {
    const arr = JSON.parse(deploys.body);
    arr.forEach((d) => console.log(`  ${d.created_at} | ref=${d.ref} | env=${d.environment || ''} | ${d.description || ''}`));
  } else console.log('API', deploys.status, deploys.body.slice(0, 150));

  const st = await get(base + '/pages');
  console.log('\n=== /pages (重试) ===');
  console.log('API', st.status, st.status === 200 ? JSON.stringify(JSON.parse(st.body)).slice(0, 300) : st.body.slice(0, 150));

  // 再试一次站点
  const site = await get('https://shuimo07.github.io/watermark-killer/');
  console.log('\n=== 站点重试 ===');
  console.log('status:', site.status, site.status === 200 ? site.body.slice(0, 100) : '');
})();

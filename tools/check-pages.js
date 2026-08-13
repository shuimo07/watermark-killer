// 检查 GitHub Pages 部署状态
const https = require('https');

function get(url) {
  return new Promise((resolve) => {
    https
      .get(url, { rejectUnauthorized: false, headers: { 'User-Agent': 'Mozilla/5.0 (research)', Accept: 'application/vnd.github+json' } }, (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => resolve({ status: res.statusCode, body: d, finalUrl: res.url }));
      })
      .on('error', (e) => resolve({ status: 0, body: 'ERR: ' + e.message }));
  });
}

(async () => {
  // 1. 仓库信息
  const repo = await get('https://api.github.com/repos/shuimo07/watermark-killer');
  console.log('=== 仓库 ===');
  if (repo.status === 200) {
    const j = JSON.parse(repo.body);
    console.log('private:', j.private, '| default_branch:', j.default_branch, '| pages_enabled:', j.has_pages);
  } else {
    console.log('API status:', repo.status, repo.body.slice(0, 150));
  }

  // 2. Pages 配置
  const pages = await get('https://api.github.com/repos/shuimo07/watermark-killer/pages');
  console.log('\n=== Pages 配置 ===');
  if (pages.status === 200) {
    const j = JSON.parse(pages.body);
    console.log('status:', j.status, '| cname:', j.cname || '(无)', '| html_url:', j.html_url);
    console.log('source:', JSON.stringify(j.source));
  } else {
    console.log('API status:', pages.status, pages.body.slice(0, 200));
  }

  // 3. 工作流运行记录
  const runs = await get('https://api.github.com/repos/shuimo07/watermark-killer/actions/runs?per_page=5');
  console.log('\n=== 最近 Actions 运行 ===');
  if (runs.status === 200) {
    const j = JSON.parse(runs.body);
    if (j.workflow_runs && j.workflow_runs.length) {
      j.workflow_runs.forEach((r) => console.log(`  ${r.created_at} | ${r.name} | ${r.status} | ${r.conclusion} | ${r.html_url}`));
    } else console.log('  无运行记录（工作流从未触发）');
  } else {
    console.log('API status:', runs.status, runs.body.slice(0, 150));
  }

  // 4. 实际站点响应
  for (const u of ['https://shuimo07.github.io/watermark-killer/', 'https://shuimo07.github.io/']) {
    const r = await get(u);
    console.log(`\n=== GET ${u} ===`);
    console.log('status:', r.status);
    if (r.status === 200) console.log('body head:', r.body.slice(0, 120).replace(/\n/g, ' '));
    else console.log('body:', r.body.slice(0, 200).replace(/\n/g, ' '));
  }
})();

// 检查仓库工作流文件 + Actions 产物
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

  // 1. 工作流文件列表
  const wf = await get(base + '/contents/.github/workflows');
  console.log('=== .github/workflows ===');
  if (wf.status === 200) {
    JSON.parse(wf.body).forEach((f) => console.log('  ' + f.name + ' (' + f.size + 'B)'));
  } else console.log('API', wf.status, wf.body.slice(0, 120));

  // 2. static.yml 内容（如果存在）
  const st = await get(base + '/contents/.github/workflows/static.yml');
  if (st.status === 200) {
    const content = Buffer.from(JSON.parse(st.body).content, 'base64').toString('utf8');
    console.log('\n=== static.yml 内容 ===');
    console.log(content.slice(0, 1200));
  }

  // 3. Actions 产物列表
  const arts = await get(base + '/actions/artifacts?per_page=10');
  console.log('\n=== Actions 产物 ===');
  if (arts.status === 200) {
    const arr = JSON.parse(arts.body).artifacts || [];
    if (!arr.length) console.log('  无产物');
    arr.forEach((a) => console.log(`  ${a.name} | ${a.size_in_bytes}B | ${a.expired ? '已过期' : '有效'} | workflow=${a.workflow_run && a.workflow_run.id}`));
  } else console.log('API', arts.status, arts.body.slice(0, 150));

  // 4. 我的工作流运行详情（最近一次）
  const runs = await get(base + '/actions/runs?per_page=3');
  if (runs.status === 200) {
    const arr = JSON.parse(runs.body).workflow_runs || [];
    for (const r of arr) {
      const jobs = await get(base + '/actions/runs/' + r.id + '/jobs');
      console.log(`\n=== run ${r.id} (${r.name}) ${r.status}/${r.conclusion} ===`);
      if (jobs.status === 200) {
        (JSON.parse(jobs.body).jobs || []).forEach((j) => {
          console.log('  job:', j.name, j.conclusion);
          (j.steps || []).forEach((s) => console.log(`    - ${s.name}: ${s.conclusion}`));
        });
      }
    }
  }
})();

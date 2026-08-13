// 查看指定运行的任务进度
const https = require('https');
https.get('https://api.github.com/repos/shuimo07/watermark-killer/actions/runs/31748532576/jobs', {
  rejectUnauthorized: false,
  headers: { 'User-Agent': 'Mozilla/5.0 (research)', Accept: 'application/vnd.github+json' },
}, (res) => {
  let d = '';
  res.on('data', (c) => (d += c));
  res.on('end', () => {
    try {
      const j = JSON.parse(d);
      (j.jobs || []).forEach((job) => {
        console.log('job:', job.name, job.status, job.conclusion);
        (job.steps || []).forEach((s) => console.log('  -', s.name, s.status, s.conclusion || ''));
      });
    } catch { console.log('API:', res.statusCode, d.slice(0, 200)); }
  });
});

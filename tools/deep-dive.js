// 深挖水印斩：api_root/fixHost/platform 配置 + 平台识别 + 登录流程
const fs = require('fs');
const file = 'E:/AI/decompiled/out/wx09306887f42a77a3/app-service.js';
const s = fs.readFileSync(file, 'utf8');

function show(pattern, label, max = 8, ctx = 70) {
  console.log('\n--- ' + label + ' ---');
  const seen = new Set();
  const re = new RegExp(pattern, 'g');
  let m;
  while ((m = re.exec(s)) && seen.size < max) {
    const start = Math.max(0, m.index - 10);
    const snippet = s.slice(start, m.index + ctx).replace(/\n/g, ' ');
    if (snippet.length > 30 && !seen.has(snippet.slice(0, 60))) {
      seen.add(snippet.slice(0, 60));
      console.log('  ' + snippet);
    }
  }
}

show('api_root\\s*[:=]\\s*[^,;]{0,80}', 'api_root assignments');
show('fixHost\\s*[:=]\\s*[^,;]{0,80}', 'fixHost assignments');
show('platform\\s*[:=]\\s*["\'][^"\']{0,40}', 'platform values');
show('api_root\\s*[:=]\\s*["\']https?[^"\']+', 'api_root url');
show('login\\(function|login:function|user/login', 'login flow', 4, 120);
show('getAccountInfoSync|wx\\.login', 'wx login', 4, 100);
show('userType|isVip|member/useBean', 'member/vip', 6, 90);
show('version:\\s*\\d+', 'version fields', 5, 60);

// decode app-config.json GBK title
console.log('\n--- app name (GBK) ---');
try {
  const cfg = new TextDecoder('gbk').decode(fs.readFileSync('E:/AI/decompiled/out/wx09306887f42a77a3/app-config.json'));
  const m = cfg.match(/navigationBarTitleText\\?"\\?:\\?"([^"]+)/);
  console.log('  global title:', m ? m[1] : '(not found)');
} catch (e) { console.log('  decode err:', e.message); }

// Cloudflare Worker 通用 CORS 中继（免费，100k 请求/天）
// 部署：https://dash.cloudflare.com → Workers & Pages → Create → Worker → 粘贴本代码 → Deploy
// 用法：https://<你的worker>.workers.dev/?url=<目标URL>  （GET/POST 均可）
export default {
  async fetch(request) {
    const url = new URL(request.url);

    // CORS 预检直接放行
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // 目标地址：?url= 参数优先，其次路径
    const target = url.searchParams.get('url') || url.pathname.slice(1);
    if (!target || !/^https?:\/\//.test(target)) {
      return new Response('usage: ?url=<target>', { status: 400 });
    }

    // 转发请求：去掉 Origin/Referer（目标站点通常校验或防盗链）
    const headers = new Headers(request.headers);
    headers.delete('origin');
    headers.delete('referer');

    const init = {
      method: request.method,
      headers,
      redirect: 'follow',
    };
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      init.body = request.body;
    }

    try {
      const res = await fetch(target, init);
      const out = new Headers(res.headers);
      out.set('Access-Control-Allow-Origin', '*');
      out.set('Access-Control-Allow-Methods', 'GET, POST, HEAD, OPTIONS');
      out.set('Access-Control-Allow-Headers', '*');
      out.set('Access-Control-Expose-Headers', '*');
      return new Response(res.body, { status: res.status, headers: out });
    } catch (e) {
      return new Response('relay error: ' + e.message, { status: 502 });
    }
  },
};

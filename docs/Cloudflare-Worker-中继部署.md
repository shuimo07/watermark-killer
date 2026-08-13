# 自建 Cloudflare Worker CORS 中继（推荐，稳定免费）

公共 CORS 代理（如 corsproxy.io）免费额度有限、会按 IP 限流，导致解析时好时坏。
**自建一个 Cloudflare Worker 中继，稳定、免费（10 万请求/天）、专属于你。**

## 部署步骤（约 3 分钟）

1. 打开 **https://dash.cloudflare.com/sign-up** 注册免费账号（如已有直接登录）
2. 进入控制台 → 左侧 **Workers & Pages** → **Create** → **Worker**（选 "Hello World" 模板即可）
3. 把编辑器的代码**全部替换**为 [`tools/cloudflare-worker-cors-relay.js`](../tools/cloudflare-worker-cors-relay.js) 的内容
4. 点 **Deploy** 部署
5. 你会得到一个地址，形如：`https://your-name.your-subdomain.workers.dev`
6. 把这个地址填到本站「问题」页底部的 **自定义解析服务器** 输入框，保存

## 原理

- Worker 接收你的请求，转发到目标（豆包 API / 视频 CDN），并**统一加上 CORS 头**
- 转发时**移除 Origin/Referer**——正好满足豆包 CDN 的防盗链要求
- 你的请求走你自己的 Worker，无公共代理限流

## 验证

浏览器打开 `https://your-name.your-subdomain.workers.dev/?url=https://example.com` 应看到 example.com 的内容。

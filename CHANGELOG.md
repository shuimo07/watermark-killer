# 变更日志

本项目所有重要变更记录于此。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

## [v0.2.0] - 2026-08-14（阶段性胜利：豆包去水印跑通）

### 新增
- 豆包视频去水印下载（裁剪水印区域 → canvas + MediaRecorder 本地重编码导出 webm）
- 水印位置选择（右下角 / 底部居中 / 左下角 / 右上角）
- 自定义 Cloudflare Worker CORS 中继支持（`问题`页设置入口）
- 多代理自动回退（corsproxy.io → cors.eu.org → 直连）
- E 盘重定向工具脚本（`tools/use-e-drive.ps1`，C 盘空间友好）
- CDP 驱动的真实浏览器端到端测试工具（`tools/cdp-test.js`）

### 变更
- 品牌更名：水印斩 → **Watermark_killer**
- UI 主题：蓝色 → 浅蓝 + 黑
- 技术栈定稿：零依赖原生前端（放弃 Vite+Vue，因环境无可用包管理器）

### 修复
- 豆包 CDN Referer 防盗链 → 下载 `referrer:''`、播放自动 Blob 降级
- `Canvas is not origin-clean` → 去水印改为 Blob 优先加载（同源 objectURL）
- MediaRecorder 空输出 → webm 优先 + DOM 挂载 + rAF 绘制 + 静音播放绕过自动播放策略 + 无音频重试
- GitHub 自动生成的 `static.yml` 与 `site/` 部署冲突导致 404 → 删除冲突工作流

### 逆向研究结论（重要）
- 豆包公开接口 `get_play_info` 返回的 `original_media_info` **仍带水印**（水印已烤入成片，URL 参数无法去除）
- 真·无水印源需登录态（`get_video_model` → `fallback_api` 去除 `logo_type`），纯前端无法获取

## [v0.1.0] - 2026-08-13

### 新增
- 项目计划书（`docs/watermark-zhan-plan.md`）
- Git 仓库初始化（SSH 443 通道推送，解决 schannel/SteamTools/端口 22 等环境障碍）
- 微信小程序「水印斩」wxapkg 解密与反编译（自研 Node 脚本，算法源自 unveilr）
- 逆向分析报告（`docs/P1-解构分析报告.md`）、架构设计草案（`docs/P2-架构设计草案.md`）

# Watermark_killer（水印斩 Web 复刻版）

> 解构微信小程序「水印斩」，在 GitHub Pages 上复刻的静态前端工具。主打**豆包 AI 视频去水印下载**。

**在线地址**：https://shuimo07.github.io/watermark-killer/

## 项目状态

- **当前版本**：`v0.2.0`（豆包去水印核心功能可用 ✅）
- **计划书**：[docs/watermark-zhan-plan.md](docs/watermark-zhan-plan.md)
- **变更日志**：[CHANGELOG.md](CHANGELOG.md)

## 路线图

| 阶段 | 内容 | 状态 |
|---|---|---|
| P0 | Git 与仓库初始化 | ✅ |
| P1 | 素材收集与解构（wxapkg 解密 + 反编译） | ✅ |
| P2 | 逆向分析与架构设计 | ✅ |
| P3 | 前端复刻实现 | ✅ |
| P4 | 解析层（多平台适配器） | ✅ |
| P5 | GitHub Pages 部署（Actions 自动发布） | ✅ |
| P6 | 测试与验收 | 🔶 豆包已验证，其他平台待测 |

## 核心能力

- **豆包视频去水印**（主功能，已实测跑通）：
  1. 解析：`POST https://www.doubao.com/samantha/media/get_play_info`（`{"key": video_id}`）→ 取视频直链
  2. 预览：`<video>` 直链（referrerpolicy 防防盗链）+ 失败自动 Blob 降级
  3. 下载：`fetch(url, {referrer:''})` 直连（CDN 自带 CORS）
  4. **去水印**：裁剪水印区域（右下角等）→ canvas + MediaRecorder 本地重编码导出 **mp4**（不支持时回退 webm）
- 其他平台适配器：抖音 / 快手 / 微视 / 微博 / 小红书 / 淘宝（尽力而为，未逐一实测）
- CORS 代理链：corsproxy.io → cors.eu.org → 直连，自动回退；支持自定义 Cloudflare Worker 中继（见 `docs/Cloudflare-Worker-中继部署.md`）
- 历史记录（localStorage）、解析缓存、FAQ/教程

## 技术栈

- 零依赖原生前端（ES Modules），`site/` 为站点根目录
- GitHub Pages + Actions 自动部署（`site/` → `deploy-pages`）
- 逆向工具（Node 脚本）在 `tools/`，分析文档在 `docs/`

## 重要说明

豆包分享链接的**公开接口只能获取带水印成片**（无水印源版本需豆包登录态，属平台限制）。本工具通过**本地裁剪重编码**实现去水印，默认输出 **mp4**（浏览器不支持时回退 webm）。

> **想要逐像素、保留原画面、零 logo 的真·无水印？** 见 [`docs/豆包真无水印下载.md`](docs/豆包真无水印下载.md)——提供油猴脚本（`tools/doubao-nomark.user.js`），在你已登录豆包的浏览器里一键下载。

## 合规声明

本项目仅用于去除用户拥有合法使用权的内容水印；不绕过付费、版权保护或平台鉴权；不存储、分发任何侵权内容。复刻仅限小程序本身的 UI/交互/功能逻辑。

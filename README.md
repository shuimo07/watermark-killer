# Watermark_killer（水印斩 Web 复刻版）

> 解构微信小程序「水印斩」，在 GitHub Pages 上复刻的静态前端工具。主打**豆包 AI 视频去水印**：既可**拖入本地视频自动去水印**（delogo 插值填补 → 输出 mp4），也可粘贴分享链接解析下载。

**在线地址**：https://shuimo07.github.io/watermark-killer/

## 项目状态

- **当前版本**：`v0.3.0`（本地文件自动去水印 → mp4 已可用 ✅）
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
| P7 | 本地文件自动去水印（ffmpeg.wasm delogo → mp4） | ✅ |

## 核心能力

### ① 本地视频自动去水印（v0.3.0 主功能，全程本地处理）
1. **拖入视频**：把豆包/即梦等 AI 生成的视频文件（mp4/mov/webm…）拖进首页虚线框
2. **自动检测**：抽帧做时间维分析（水印是静止叠加、画面在动 → 方差被压缩 + 文字边缘），自动框出水印位置（支持多处）
3. **手动微调**：拖动/缩放蓝色水印框，点击空白处添加新框
4. **delogo 去水印**：用 ffmpeg.wasm 的 `delogo` 滤镜以周围像素插值填补水印区域（非裁剪、非马赛克），保留完整画面
5. **输出 mp4**：H.264 + AAC 标准 mp4，带进度条与预览，可直接下载
6. 全程浏览器本地处理，**视频不上传任何服务器**；ffmpeg 引擎（约 30MB）内置在仓库，国内可直接加载，失败自动回退 CDN

### ② 分享链接解析（v0.2.0，备选流程）
- **豆包视频解析**（主功能，已实测跑通）：
  1. 解析：`POST https://www.doubao.com/samantha/media/get_play_info`（`{"key": video_id}`）→ 取视频直链
  2. 预览：`<video>` 直链（referrerpolicy 防防盗链）+ 失败自动 Blob 降级
  3. 下载：`fetch(url, {referrer:''})` 直连（CDN 自带 CORS）
  4. 去水印：裁剪水印区域（右下角等）→ canvas + MediaRecorder 本地重编码导出 **mp4**（不支持时回退 webm）
- 其他平台适配器：抖音 / 快手 / 微视 / 微博 / 小红书 / 淘宝（尽力而为，未逐一实测）
- CORS 代理链：corsproxy.io → cors.eu.org → 直连，自动回退；支持自定义 Cloudflare Worker 中继（见 `docs/Cloudflare-Worker-中继部署.md`）
- 历史记录（localStorage）、解析缓存、FAQ/教程

## 技术栈

- 零依赖原生前端（ES Modules），`site/` 为站点根目录
- **ffmpeg.wasm**（`@ffmpeg/core@0.12.6` 单线程版）自托管于 `site/vendor/ffmpeg/`：`delogo` 滤镜 + libx264 + aac → mp4
- 水印自动检测：抽帧 → 时间维方差/边缘分析（`site/js/lib/detect.js`，纯函数可在 Node 单测）
- GitHub Pages + Actions 自动部署（`site/` → `deploy-pages`）
- 测试：Node 冒烟测试（`tools/smoke-test.js` 思路见 `wm-vendor/smoke-test.mjs`）、真实浏览器 E2E（`tools/e2e-local-file.js`）

## 本地开发

```bash
# 静态预览（默认 http://127.0.0.1:8123/watermark-killer/site/）
node tools/static-server.js

# 验证 ffmpeg delogo → mp4 管线（Node 直接调 wasm core）
node tools/smoke-test.mjs

# 验证水印自动检测算法（合成帧单测）
node tools/detect-test.mjs

# 真实浏览器全流程 E2E（注入测试视频 → 自动检测 → 去水印 → 校验 mp4）
node tools/e2e-local-file.js 300
```

## 重要说明

- **豆包分享链接的公开接口只能获取带水印成片**（无水印源版本需豆包登录态，属平台限制）。要「逐像素、保留原画面、零 logo」的真·无水印：先把视频下载下来，用本页**本地视频去水印**（delogo 插值填补水印区域）；或见 [`docs/豆包真无水印下载.md`](docs/豆包真无水印下载.md)（油猴脚本 `tools/doubao-nomark.user.js`，在已登录豆包的浏览器里一键下载）。
- 水印检测基于「静止 + 文字边缘」假设，对动态/旋转水印可能需手动框选微调；delogo 对半透明静态水印效果最佳。

## 合规声明

本项目仅用于去除用户拥有合法使用权的内容水印；不绕过付费、版权保护或平台鉴权；不存储、分发任何侵权内容。复刻仅限小程序本身的 UI/交互/功能逻辑。

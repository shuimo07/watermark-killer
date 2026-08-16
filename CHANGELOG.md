# 变更日志

本项目所有重要变更记录于此。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

## [v0.3.0] - 2026-08-16（本地文件自动去水印 → mp4）

### 新增（主功能：豆包 AI 视频一键去水印）
- **本地视频去水印**：拖入/选择视频文件 → 自动检测水印 → delogo 插值去除 → 输出 **mp4**（H.264 + AAC），全程浏览器本地处理、视频不上传
- **水印自动检测**（`site/js/lib/detect.js`）：抽帧 → 时间维方差压缩 + Sobel 边缘分析 → 连通域外接框，自动定位多处水印；纯函数设计，Node 可单测
- **手动微调**：拖动/缩放水印框、点击空白添加新框、重新检测/清空
- **ffmpeg.wasm 引擎**（`site/vendor/ffmpeg/`，@ffmpeg/core@0.12.6 单线程）：自托管仓库内（国内可直接加载），失败自动回退 jsDelivr CDN
- 处理进度条 + 实时日志 + 结果预览 + mp4 下载
- 测试：delogo 管线 Node 冒烟测试（生成→去水印→校验 ftyp）、检测算法单测、真实浏览器 E2E（`tools/e2e-local-file.js`）

### 变更
- 首页重排：本地文件去水印升为主流程（hero 卡片），链接解析保留为备选
- FAQ/教程页补充本地去水印使用说明
- `tools/static-server.js` 补充 wasm MIME

### 说明
- 与 v0.2.0 的「裁剪」方案不同：delogo 用周围像素插值填补水印区域，不牺牲画面构图与分辨率

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

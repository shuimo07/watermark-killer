# 水印斩 Web 复刻版（watermark-killer）

> 解构微信小程序「水印斩」，在 GitHub Pages 上复刻其全部功能的静态前端项目。

## 项目状态

- **阶段**：P0 计划与仓库初始化（进行中）
- **计划书**：[docs/watermark-zhan-plan.md](watermark-zhan-plan.md)（即本仓库首个提交，tag `v0.1.0`）

## 路线图

| 阶段 | 内容 | 状态 |
|---|---|---|
| P0 | Git 与仓库初始化 | ✅ 进行中 |
| P1 | 素材收集与解构（抓包 + 解包） | ⬜ |
| P2 | 逆向分析与功能矩阵 | ⬜ |
| P3 | 前端复刻实现（Vue 3 + Vite） | ⬜ |
| P4 | 解析层（多平台适配器 + CORS 代理） | ⬜ |
| P5 | GitHub Pages 部署（Actions 自动发布） | ⬜ |
| P6 | 测试与验收 | ⬜ |

## 合规声明

本项目仅用于去除用户拥有合法使用权的内容水印；不绕过付费、版权保护或平台鉴权；不存储、分发任何侵权内容。复刻仅限小程序本身的 UI/交互/功能逻辑。

## 技术栈（规划）

Vite + Vue 3 + Tailwind CSS，纯静态前端，无后端，解析走第三方 CORS 代理。

> **实际采用**：零依赖原生前端（ES Modules），`site/` 为站点根目录，GitHub Pages 直出。

## 核心能力

- **豆包视频去水印**（主功能）：`POST https://www.doubao.com/samantha/media/get_play_info`（参数 `aid=497858` 等 + JSON `{"key": video_id}`），返回 `original_media_info.main_url` 无水印直链（CDN 自带 CORS，可直连播放/下载）
- 其他平台适配器：抖音 / 快手 / 微视 / 微博 / 小红书 / 淘宝（尽力而为）
- CORS 代理链：corsproxy.io（放行 github.io 来源）→ 备用代理；豆包视频下载直连 CDN
- 历史记录、解析缓存、FAQ/教程

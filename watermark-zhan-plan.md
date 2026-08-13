# 「水印斩」复刻计划书（计划书 v0.1）

> 目标：解构微信小程序「水印斩」→ 在 GitHub Pages 上复刻其全部功能 → 全程 git 版本管理。
> 当前交付物：本计划书。本计划书只是规划文档，不包含任何已执行的逆向/开发动作。

---

## 0. 项目概述与合规声明

- **项目名**：watermark-zhan（Web 复刻版）
- **形态**：纯静态前端（Vue 3 + Vite），部署于 GitHub Pages，无后端
- **解析方案**：纯前端 + 第三方 CORS 代理（已确认）
- **版本管理**：git 本地仓库 + 推送到新建 GitHub 仓库（已确认）
- **合规声明**：本项目仅用于去除用户拥有合法使用权的内容水印；不绕过付费、版权保护或平台鉴权；不存储、分发任何侵权内容。复刻仅限小程序本身的 UI/交互/功能逻辑。

---

## 1. 总体路线图

| 阶段 | 内容 | 产出物 | 依赖 |
|---|---|---|---|
| P0 | Git 与仓库初始化 | 仓库、README、.gitignore、提交规范 | 无 |
| P1 | 素材收集与解构（抓包 + 解包） | 抓包产物目录、反编译源码目录、功能清单初稿 | 用户提供小程序本体；**下一个 harness 项目检索开源抓包工具** |
| P2 | 逆向分析与功能矩阵 | 接口文档、功能→API 映射表、复刻决策 | P1 + 用户补充截图/功能列表 |
| P3 | 前端复刻实现 | 可运行的 Vite 应用（UI/交互/下载/历史） | P2 |
| P4 | 解析层实现 | 多平台适配器 + CORS 代理回退 | P2 |
| P5 | 部署上线 | GitHub Actions 自动构建发布到 Pages | P3+P4 |
| P6 | 测试与验收 | 多平台实测矩阵、验收报告、v1.0.0 标签 | P5 |

---

## 2. P0：Git 与仓库初始化（可立即执行）

- `git init`，分支模型：`main`（可发布）+ `feature/*`（开发）
- `.gitignore`：`node_modules/`、`dist/`、`.env*`、`*.wxapkg`、`capture/`（抓包产物）、`decompiled/`（反编译产物，避免版权/机密入库）
- 提交规范（Conventional Commits）：`feat:` `fix:` `refactor:` `docs:` `chore:`，里程碑打 tag（`v0.1.0` → `v1.0.0`）
- 新建 GitHub 仓库（如 `watermark-zhan`），关联 remote 并推送
- 版本回溯策略：每次里程碑提交即快照；需要回退用 `git revert <tag>` 或 `git checkout <tag>`

---

## 3. P1：素材收集与解构

### 3.1 子任务（交给下一个 harness 项目）
在 GitHub 检索并验证开源抓包/解包工具，产出「工具选型报告」（可用性、平台支持、SSL 解密能力、维护状态）。已知候选（已核实存在）：

- 抓包（HTTPS 解密）：
  - [mitmproxy](https://github.com/mitmproxy/mitmproxy) — Python 开源，命令行 + Web 界面，支持 Android/iOS 证书安装与流量回放
  - [TomTruyen/mitm-proxy-configuration-scripts](https://github.com/TomTruyen/mitm-proxy-configuration-scripts) — 手机端证书安装与动态代理的自动化脚本
  - [httptoolkit/frida-interception-and-unpinning](https://github.com/httptoolkit/frida-interception-and-unpinning) — 处理证书固定（SSL Pinning）的 Frida 方案（备用）
- 小程序解包/反编译：
  - [broken5/unveilr](https://github.com/broken5/unveilr/) — 支持 wxapkg 解密 + 反编译（含加密包）
  - [CrackerCat/wxapkg-unpacker](https://github.com/CrackerCat/wxapkg-unpacker) — wxapkg 反编译
  - 经典工具 `wxappUnpacker`（qwerty472123，备用）

### 3.2 抓包流程（P1 执行时）
1. 手机/模拟器设置代理指向 mitmproxy → 安装 CA 证书
2. 在「水印斩」内触发一次完整解析（粘贴链接 → 解析 → 预览 → 下载）
3. 记录请求：解析接口 URL、请求/响应体、鉴权头
4. 产物存入 `capture/`（HAR 或原始记录），**不提交 git**

### 3.3 解包流程（P1 执行时）
1. 从手机备份 / PC 微信缓存 / 开发者工具获取 `水印斩.wxapkg`
2. 用 unveilr 反编译 → 产物存入 `decompiled/`（不入 git）
3. 静态分析：页面结构（WXML）、样式（WXSS）、逻辑（JS）、配置（app.json）、广告组件、上报接口

### 3.4 功能清单初稿（模板）
> ⬜ 待用户补充截图/功能列表后逐项确认

| 功能 | 入口 | 依赖 API | 复刻难度 | 网页端可行性 |
|---|---|---|---|---|
| 粘贴链接解析 | 首页输入框 | 解析接口 | — | — |
| 无水印预览 | 结果页 | 视频直链 | — | — |
| 下载保存 | 结果页 | Blob/直链 | — | — |
| 历史记录 | 首页列表 | 本地存储 | — | — |
| 多平台（抖音/快手/小红书/B站…） | 自动识别 | 各平台适配 | — | — |
| 激励视频广告 | 结果页前 | 微信广告 SDK | — | 网页端降级/移除 |
| 微信登录 | 首次进入 | 微信授权 | — | 降级为 localStorage |

---

## 4. P2：逆向分析与决策

- 从抓包结果还原解析链路：`分享文案 → 提取视频ID/短链 → 请求解析服务 → 返回无水印直链`
- 关键决策点（届时向你确认）：
  1. 复刻小程序调用的**第三方解析 API**（原样调用，可能收费/限流）还是**自研解析适配器**（直连各平台公开接口，更可控）
  2. 各平台的 CORS 代理选择：`corsproxy.io` / `allorigins` / 多代理回退 / 自建 Cloudflare Worker（可放同仓库，仍是静态友好）
- 输出：接口文档 + 功能→API 映射表 + 复刻决策记录（存入 `docs/`）

---

## 5. P3：前端复刻实现

- **技术栈**：Vite + Vue 3 + Tailwind CSS，移动端优先（原小程序即手机 UI）；无路由依赖，便于 Pages 部署
- **页面**：
  - 首页：链接输入框（自动识别粘贴的分享文案）、平台识别徽标、历史记录列表
  - 结果页：无水印预览（视频/图集）、下载按钮（视频 Blob 下载、图集打包 zip）、复制链接、Web Share API 分享
  - 帮助/关于页：免责声明、使用说明
- **视觉复刻**：依据你提供的截图还原配色、圆角、图标风格
- **小程序能力降级方案**（网页端不可用项）：
  - 微信激励视频广告 → 移除或替换为「支持开发者」入口
  - 微信登录/授权 → 匿名化，localStorage 持久化
  - 微信分享 → Web Share API + 复制链接

---

## 6. P4：解析层实现

- `src/adapters/`：`douyin.js`、`kuaishou.js`、`xiaohongshu.js`、`bilibili.js`（按 P2 决策增减）
- 统一接口：`parse(shareText) → { platform, title, cover, mediaUrl[], type }`
- `src/lib/proxy.js`：CORS 代理封装，多代理自动回退
- 本地缓存解析结果（localStorage，带过期时间），减少重复请求

---

## 7. P5：部署上线

- GitHub Actions：`pnpm build` → `actions/deploy-pages` 发布到 `gh-pages`
- 每次推送到 `main`（或打 tag）自动构建发布，配合 git 版本回溯
- 可选：自定义域名、`robots.txt`、移动端 meta 优化、资源压缩

---

## 8. P6：测试与验收

- 多平台实测矩阵（抖音/快手/小红书/B站 × 视频/图集 × 各浏览器）
- Lighthouse 性能检查；移动端兼容性
- 验收标准 = 功能矩阵逐项对照，全部达成后打 `v1.0.0` 标签

---

## 9. Git 版本管理策略（汇总）

1. **仓库**：本地 `git init` → GitHub 新建仓库 → `remote add` → 推送
2. **分支**：`main` 始终可发布；功能开发走 `feature/*`，PR 合并
3. **提交规范**：Conventional Commits；每条提交小步、可回溯
4. **里程碑**：每个阶段完成打 tag（`v0.1.0` 计划书定稿 → `v0.2.0` 解构完成 → `v1.0.0` 上线）
5. **敏感信息**：抓包产物、反编译源码、API 密钥一律 `.gitignore`；密钥类走 GitHub Secrets
6. **回溯**：`git log --oneline` 查看历史，`git revert`/`git checkout <tag>` 回滚

---

## 10. 风险与对策

| 风险 | 对策 |
|---|---|
| CORS 代理不可用/限流 | 多代理回退 + 可选自建 Cloudflare Worker |
| 平台接口变动导致解析失效 | 适配器隔离，单一文件内更新，不影响 UI |
| 小程序本体拿不到（无 root 等） | 用「按公开同类功能重建」降级路线 |
| 微信能力（广告/登录）无法复刻 | 网页端降级方案（见 P3） |
| 版权/合规争议 | 免责声明 + 仅个人合法使用；不存储侵权内容 |
| 第三方解析 API 收费/失效 | P2 决策时优先自研适配器 |

---

## 11. 待办输入清单（需要你提供）

1. 「水印斩」小程序本体（可抓包的手机环境，或 wxapkg 文件，或反编译产物）
2. 小程序内各页面**截图 + 功能列表**（P2 功能矩阵的依据）
3. 你希望使用的 GitHub 用户名 / 新仓库名（P0 用）
4. 目标平台范围确认（抖音/快手/小红书/B站/其他）

---

## 12. 下一步行动（按顺序）

1. **[P0] 立即执行**：初始化 git 仓库 + 目录骨架 + README + .gitignore（你确认后即可做）
2. **[P1 子任务] 启动 harness 项目**：在 GitHub 检索/验证开源抓包工具并输出选型报告
3. **[P1 主体] 你提供小程序本体与截图** → 抓包 + 解包 → 产出功能清单
4. **[P2] 逆向分析** → 功能矩阵与解析决策
5. **[P3–P6] 复刻、部署、验收**

> 本计划书即 git 仓库的第一个提交内容（docs/watermark-zhan-plan.md），作为 v0.1.0 里程碑。

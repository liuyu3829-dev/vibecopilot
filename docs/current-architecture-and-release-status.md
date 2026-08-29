# Thought Space 当前架构与发布状态

> 权威状态：2026-08-29，代码版本 0.1.9。本文描述当前运行方式；`docs/superpowers/specs/` 是历史设计和排障证据，不应当被当作现行实现说明。

## 当前产品链路

浏览器中的 Next.js 界面位于 `src/app/page.tsx`。它通过 `src/app/api/` 的 Route Handlers 调用服务端逻辑；服务端使用 `src/server/store.ts` 在生产环境连接 Supabase，在本地开发模式连接 libSQL SQLite。

网页和桌面球都向现有 Thought Space API 保存 Thoughts。语音转写由浏览器或桌面 WebView 获取麦克风后，直连 AssemblyAI 实时 WebSocket；会话令牌只由 `/api/speech/session` 在服务端使用 `ASSEMBLYAI_API_KEY` 创建。DeepSeek 调用也只在服务端，使用 `DEEPSEEK_API_KEY`。

Windows 桌面球使用 Tauri（`src-tauri/`）创建透明、置顶的 WebView 窗口；球体 UI 与 WebView 网络访问位于 `public/orb-shell/`。生产 API 请求由 WebView `fetch` 访问稳定 HTTPS 域名，而不是 Rust 原生 HTTP 客户端。

## 生产发布

稳定生产站点是 `https://vibecopilot-xi.vercel.app`。桌面安装包必须通过 `npm run desktop:pack` 构建；该命令把这个稳定地址写入安装包。构建产物上传到 GitHub Release 后，将具体 `.exe` asset 下载地址写入 Vercel 的 `DESKTOP_RELEASE_URL`，再重新部署 Production。

用户先下载并安装一次。之后网页的 **Show orb** 与 **Hide orb** 使用 `thoughtspace://open-orb` 和 `thoughtspace://hide-orb` 唤起已注册的 Windows 应用；网页本身不能在未安装时创建桌面程序。

## 回归边界

在 Report、UI 或文档迭代中，不修改以下稳定链路：AssemblyAI 会话、AudioWorklet/音频采样、桌面 WebView API 访问、Thought 保存 API、Supabase 数据模型、Tauri 深链 Show/Hide 协议以及 GitHub Release 发布流程。改动这些模块必须独立设计、先写失败测试并完成桌面端生产验证。

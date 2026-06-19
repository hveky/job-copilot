# 求职作战助手 — M1(Web 版)

按 [PRD.md](../PRD.md) 开发。本目录是 **M1:求职内容生成 + 回复助手 lite**,先做成可运行的 Web 应用,后续包入 Tauri 原生壳(见下「路线」)。

## 跑起来

```bash
cd app
npm install
npm run dev      # http://localhost:5180
```

首次打开点右上「设置」填 **DeepSeek API Key**(默认主力档),可选填 Anthropic Key(精修档),粘贴简历。

## 已实现(对应 PRD)

- **§7 模型网关**:单一 Anthropic Messages 格式打两家,按档位路由——`light`/`deep` → DeepSeek(`/anthropic` 兼容端点),`premium` → Claude Opus。代码在 [`src/gateway/`](src/gateway/)。
- **§5.1 B 线内容生成**:选赛道 → 粘 JD → 一键生成【JD拆解 / 知识包 / 实操 / 面试准备 / 反问 / 简历针对性优化】,流式输出,可复制/导出 .md。
- **§5.4 回复助手 lite**:右侧边栏 AI 对话,粘 HR 消息 → 出回复草稿,可复制。默认走 DeepSeek Flash(省)。
- **§6 信息架构**:主区(内容工作台)+ 右侧边栏(回复助手),顶栏设置。
- **四赛道**:投流 / Meta 跨境 / AI·Agent / 医药 CDM([`src/prompts/tracks.ts`](src/prompts/tracks.ts))。

## 架构要点

- **dev 代理绕 CORS**([`vite.config.ts`](vite.config.ts)):浏览器→vite→上游。`/api/ds/anthropic/*` → `api.deepseek.com/anthropic`;`/api/anthropic/*` → `api.anthropic.com`。
- key 暂存 localStorage(M1)。**包入 Tauri 后:网关整体下沉 Rust 核心,key 进系统安全存储,不再过渲染层、无 CORS。**

## 路线(后续)

- **M2(需装 Rust)**:`npm create tauri-app` 把本前端包进 Tauri 壳;接 WebView2 做 BOSS 登录 + 半自动投递;回复助手自动读 WebView 聊天。网关下沉 Rust。
- **本地存储**:M1 用 localStorage;Tauri 后换 SQLite(台账/历史/配额)。
- **会员/配额/计费**:M4。

## 目录

```
src/
  gateway/    模型网关(types + client,Anthropic SSE 流式)
  prompts/    赛道定义 + Prompt 模板
  state/      设置 + 网关配置组装
  components/ ContentPanel(B线) / Copilot(回复助手) / Settings
  App.tsx     主壳:主区 + 右侧边栏
```

# job-copilot · 求职作战助手

面向求职者的 **Tauri 桌面应用**:用 AI 把「搜岗 → 抓 JD → 定制招呼语 → 半自动投递 → 备战 → 复盘」做成一条流水线,门槛拉到最低。

> ⚠️ 半自动、保留人工审核。BOSS 自动化属灰色地带,内置了人速节流 / 人工确认 / 异常即停等风控纪律,请合规使用、勿规模化滥发。

## 功能

- **AI 内容生成**:粘 JD → 一键产出【JD 拆解 / 应试知识包 / 实操建议 / 面试准备 / 反问 / 简历针对性优化(改前改后)】,流式输出、可预览/编辑/导出。
- **回复助手**:把 HR 消息贴进来 → 出可直接发的回复草稿。
- **Instruction 主控**:一段常驻指令(CLAUDE.md 式)注入每次 AI 调用,统一调教口径。
- **BOSS 半自动投递**(桌面端):
  - 内置 WebView 登录 BOSS(登录态持久化);
  - 按目标岗位 + 城市自动搜岗、抓列表与详情 JD;
  - 生成 JD 定制招呼语 → 人工审核 → 打招呼 + 追发;
  - 批量投递:审核表 + 随机节流(40–100s)+ 异常即停 + 去重台账 + 单日上限;
  - 回复监控:抓聊天列表统计 已投 / 已沟通 / 有新回复。
- **文件 agent**:选本地求职工作区文件夹 → 目录树浏览/编辑;AI 用 列/读/写 工具帮改简历话术(写入前人工确认)。
- **飞书同步**:把投递记录写入多维表格 Base。支持**账号 OAuth**(以本人身份写表,无需机器人/分享表)或应用凭证。

## 技术栈

- **Tauri v2**(Rust 内核 + 系统 WebView2)
- **React 19 + TypeScript + Vite**
- **模型网关**:统一用 Anthropic Messages 格式打两家 —— DeepSeek(`/anthropic` 兼容端点,默认)、Claude(可选);BOSS 自动化与文件读写、飞书写入均由 Rust 命令完成。

## 运行(开发)

前置:**Node 18+**、**Rust**(`rustup`,Windows 需 MSVC build tools)、**WebView2**(Win10/11 通常自带)。

```bash
npm install
npx tauri dev        # 启动桌面应用(首次编译较久)
```

打开后:右上「设置」填 **DeepSeek API Key**(默认主力,`/anthropic` 端点)、粘贴简历;可选填飞书与投递安全参数。

打包:

```bash
npx tauri build
```

## 配置要点

- **DeepSeek**:`base_url` 默认 `/api/ds/anthropic`(dev 经 Vite 代理 → `api.deepseek.com/anthropic`);深度档 `deepseek-v4-pro` 为推理模型,会先思考再下笔。
- **飞书内置应用**:产品方在 `src/config/feishu.ts` 填入一个自建应用的 `clientId/clientSecret` 并登记重定向 URL,终端用户即可零配置「账号授权」。
- **风控**:投递间隔、单日上限可在「设置 → 投递安全」调整。

## 目录

```
src/
  gateway/      模型网关(Anthropic 格式 + SSE 流式 + 非流式 tool-use)
  prompts/      Prompt 模板 + 目标岗位预设
  state/        设置(localStorage)
  lib/          tauri 命令封装 / 台账 / markdown / 飞书内置配置
  components/    内容生成 / 回复助手 / Instruction / BOSS 投递 / 文件 agent / 设置
src-tauri/      Rust:BOSS 自动化(eval+IPC)、本地文件读写、飞书 OAuth/写入
```

## 免责声明

仅供个人求职效率工具用途。BOSS 直聘自动化操作可能违反其服务条款并有账号风险,使用者自负其责;本项目内置人工审核与节流以降低风险,但不构成任何合规承诺。

# 求职作战助手 UI Redesign Spec

请根据参考图实现页面，但不要逐像素复刻图片。目标是工程可维护的高保真近似实现，优先保证组件结构清晰、响应式正常、状态表达完整。

## 参考范围

- 图 1：产品总览工作台
- 图 3：回复助手工作区
- 图 4：设置与集成配置页

## 技术栈

- React + TypeScript
- Tailwind CSS
- lucide-react 作为唯一图标库
- 不允许手写复杂 inline SVG
- 不允许自行发明图标
- 所有装饰性图片从 `/assets/images` 调用
- 所有自定义图标从 `/assets/icons` 调用
- 当前项目若尚未安装 Tailwind CSS 与 lucide-react，实现阶段需先补齐依赖与配置

## 设计目标

- 从当前“表单堆叠页面”升级为“桌面效率工作台”
- 保留现有核心能力：目标岗位、城市薪资筛选、BOSS 自动投递、候选岗位、JD 粘贴、内容包生成、回复助手、Instruction、文件、设置
- 信息密度保持偏高，但视觉层级更清楚
- 避免营销页、超大 hero、装饰性渐变背景
- 整体风格：浅色、专业、克制、可靠、有 AI 工具感

## Design Tokens

### Colors

- 页面背景：`#F7F8FB`
- 主内容底色：`#FFFFFF`
- 次级面板底色：`#F3F6FA`
- 悬浮/输入底色：`#FAFBFC`
- 主文字：`#111827`
- 次级文字：`#64748B`
- 弱提示文字：`#94A3B8`
- 边框：`#E2E8F0`
- 强边框：`#CBD5E1`
- 主色 Teal：`#0F9F7A`
- 主色 Hover：`#0B7F62`
- AI 蓝：`#2563EB`
- AI 浅蓝背景：`#EFF6FF`
- 成功：`#10B981`
- 警告：`#F59E0B`
- 危险：`#EF4444`

### Radius

- 小控件：`6px`
- 按钮 / 输入框 / 标签：`8px`
- 卡片：`8px`
- 弹窗 / Drawer：`16px`

### Shadow

- 卡片阴影：`0 8px 24px rgba(15, 23, 42, 0.06)`
- 浮层阴影：`0 18px 48px rgba(15, 23, 42, 0.14)`
- 顶栏阴影：`0 1px 0 rgba(15, 23, 42, 0.08)`

### Typography

- 字体：系统字体，优先 `Inter`, `SF Pro`, `Segoe UI`, `PingFang SC`, `Microsoft YaHei`
- 页面标题：`24px / 32px`, `font-weight: 700`
- 模块标题：`16px / 24px`, `font-weight: 700`
- 卡片标题：`14px / 20px`, `font-weight: 600`
- 正文：`14px / 20px`
- 辅助文字：`12px / 18px`
- 数字指标：`28px / 36px`, `font-weight: 700`

### Spacing

- 页面最大宽度：`1440px`
- 页面外边距：`24px`
- 栅格间距：`20px`
- 卡片内边距：`20px`
- 小组件间距：`8px`
- 表单行间距：`16px`

## 图标规则

使用 `lucide-react`，统一参数：

- `size={20}`
- `strokeWidth={1.75}`

指定映射：

- 搜索：`Search`
- 通知：`Bell`
- 设置：`Settings`
- 用户：`User`
- 趋势：`TrendingUp`
- 更多：`MoreHorizontal`
- 发送：`Send`
- 生成：`Sparkles`
- 文件：`FileText`
- 岗位：`BriefcaseBusiness`
- 城市：`MapPin`
- 薪资：`BadgeDollarSign`
- 自动化：`Bot`
- 安全：`ShieldCheck`
- 同步：`RefreshCw`
- 授权：`KeyRound`
- 关闭：`X`
- 展开/收起：`PanelRightOpen`, `PanelRightClose`

## 基础组件

### DesignTokens

建立统一 token 文件：

- `src/design/tokens.ts`
- 输出颜色、圆角、阴影、字号、间距常量
- Tailwind 配置中同步关键 token

### Button

支持变体：

- `primary`：主操作，例如“一键生成内容包”“发送”
- `secondary`：次操作，例如“刷新回复”“同步飞书”
- `ghost`：顶部栏、侧栏轻量按钮
- `danger`：清除授权、删除类操作
- `icon`：纯图标按钮

状态：

- `default`
- `hover`
- `active`
- `disabled`
- `loading`

### Card

统一用于模块容器：

- 白底
- `1px` 边框
- `8px` 圆角
- 轻阴影
- 支持 `title`, `description`, `action`, `children`

### Header

顶部栏结构：

- 左侧：品牌点 + `求职作战助手`
- 中间：状态 pill，例如 `M1 · 内容生成 + 回复助手`
- 右侧：主题切换、设置、边栏开关
- 高度：`64px`
- 背景：白色
- 底部边框：`#E2E8F0`

### Sidebar

右侧助手区域：

- 默认宽度：`420px`
- 可拖拽调整，范围 `320px - 640px`
- Tabs：`回复助手` / `Instruction` / `文件`
- 当前 tab 使用 teal 下划线和浅色背景
- 底部固定 Composer

### Field

表单组件统一：

- `Input`
- `Textarea`
- `Select`
- `SecretInput`
- `Toggle`
- `Slider`
- `SegmentedControl`
- `StatusPill`

## 页面布局

### App Shell

整体采用三栏逻辑：

```txt
┌──────────────── Header ────────────────┐
│ SidebarNav │ Main Workspace │ AI Panel │
└────────────────────────────────────────┘
```

当前项目可先不新增左侧全局导航，保留主区 + 右侧助手结构，但视觉上需体现清晰的工作台布局。

推荐布局：

- `Header` 固定顶部
- `MainWorkspace` 左侧占 `minmax(0, 1fr)`
- `AssistantPanel` 右侧固定或可拖拽
- 主体背景：`#F7F8FB`
- 主区域滚动，右侧助手独立滚动

## 图 1：产品总览工作台

主区从上到下：

1. `HeroSummaryCard`
   - 标题：`从岗位筛选到沟通回复，一站式求职作战台`
   - 副文案：简短说明当前目标岗位、城市、投递状态
   - 右侧展示本日关键指标：`今日已投`、`累计投递`、`候选岗位`
2. `WorkflowRail`
   - 横向步骤：
     - `筛选岗位`
     - `抓取岗位`
     - `生成内容`
     - `沟通回复`
   - 当前步骤高亮
   - 使用 `CheckCircle`, `Circle`, `ArrowRight`
3. `TargetJobPanel`
   - 岗位 chips
   - 城市 chips
   - 薪资 Select
   - 自定义岗位输入
   - AI 推荐岗位按钮
4. `AutoApplyPanel`
   - 今日已投 / 每日上限
   - 累计已投
   - 操作按钮：
     - `打开 / 登录 BOSS`
     - `抓取岗位`
     - `刷新回复`
     - `同步飞书`
   - 安全状态 pill：`step 3b · 半自动投递`
5. `ContentGenerationPanel`
   - JD Textarea
   - 档位 Select
   - 主按钮：`一键生成内容包`

右侧助手保留：

- Tabs
- 模型 pill
- 简短引导消息
- 底部输入框和发送按钮

## 图 3：回复助手工作区

该页面/状态重点强化 HR 消息处理能力。

主区推荐三列：

1. `HrMessageColumn`
   - HR 消息输入区
   - 历史消息列表
   - 快捷标签：
     - `面试时间`
     - `薪资沟通`
     - `岗位细节`
     - `婉拒 / 延期`
2. `ReplyAnalysisColumn`
   - `HR 消息解析`
   - `意图判断`
   - `风险提醒`
   - `回复策略`
   - 使用浅蓝 AI 信息卡展示分析结果
3. `ReplyDraftColumn`
   - 回复草稿编辑器
   - 语气选择：
     - `专业`
     - `积极`
     - `克制`
     - `争取权益`
   - 操作按钮：
     - `生成回复草稿`
     - `复制`
     - `保存为话术`

右侧上下文面板：

- 当前目标岗位
- JD 摘要
- 简历亮点
- 模型选择
- 常用话术 snippets

## 图 4：设置与集成配置页

设置页使用大尺寸 modal 或右侧 drawer，避免当前长表单压迫感。

推荐结构：

```txt
SettingsModal
├── SettingsHeader
├── HealthSummary
├── SettingsTabs / SectionNav
├── SettingsContent
└── StickyActions
```

### SettingsHeader

- 标题：`设置`
- 描述：`配置模型、同步、扩展接入与投递安全策略`
- 右侧关闭按钮

### HealthSummary

顶部三到四个状态 pill：

- `DeepSeek 已配置`
- `飞书已授权`
- `BOSS 扩展待连接`
- `本地存储正常`

### SectionNav

左侧或顶部 tabs：

- `模型配置`
- `飞书同步`
- `BOSS 扩展`
- `投递安全`
- `本地存储`

### 模型配置

字段：

- `DeepSeek API Key`
- `DeepSeek base_url`
- `轻活模型`
- `深度模型`

要求：

- Key 默认掩码显示
- 提供显示/隐藏按钮，图标用 `Eye` / `EyeOff`
- 提供测试连接按钮，图标用 `PlugZap`

### 飞书同步

字段：

- `client_id`
- `client_secret`
- `重定向 URL`
- `base_token`
- `table_id`

操作：

- `用飞书账号授权`
- `清除授权`
- 授权状态用 status pill 展示

### BOSS 扩展接入

字段：

- `接收端口`
- `对接令牌`

说明区：

- 使用 `Info` 图标
- 文案保持短句，不占用大段空间

### 投递安全

字段：

- `单日上限`
- `最小间隔`
- `最大间隔`

控件：

- 数字输入 + slider
- 警告提示：
  - 当间隔过短时显示 amber 提示
  - 不使用弹窗打断

### StickyActions

底部固定操作区：

- 左侧：保存状态，例如 `上次保存于 22:18`
- 右侧：
  - `取消`
  - `保存设置`

## 响应式规则

### Desktop >= 1280px

- 主区 + 右侧助手并排
- 设置页使用居中 modal，宽度 `960px - 1080px`
- 工作台卡片采用 12 栅格

### Tablet 768px - 1279px

- 右侧助手变为可折叠 drawer
- 主区单列或两列混排
- 指标卡允许横向滚动

### Mobile < 768px

- 不优先优化为完整移动端，但不得布局破裂
- Header 按钮收纳到 `MoreHorizontal`
- 右侧助手默认折叠
- 设置页全屏 drawer

## 实现顺序

1. 建立 `DesignTokens`
2. 接入 Tailwind CSS
3. 安装并统一使用 `lucide-react`
4. 建立基础组件：
   - `Button`
   - `Card`
   - `Input`
   - `Textarea`
   - `Select`
   - `StatusPill`
   - `Tabs`
   - `Header`
   - `Sidebar`
   - `Modal`
5. 重构 App Shell
6. 重构产品总览工作台
7. 重构回复助手工作区
8. 重构设置与集成页面
9. 最后统一处理响应式、空状态、loading、disabled、error 状态

## 验收标准

- 页面视觉接近参考图 1、3、4 的高保真方向
- 不逐像素复刻生成图
- 主流程信息比当前页面更清晰
- 所有主操作一眼可见
- 设置页分组明确，不再是单一长表单
- 右侧回复助手具备独立工作区质感
- 所有图标来自 `lucide-react`
- 卡片无嵌套卡片堆叠感
- 文本无重叠，窄屏不破版
- `npm run typecheck` 通过
- `npm run build` 通过

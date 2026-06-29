// 统一设计 token（DESIGN_SPEC.md）。颜色等关键值同步到 tailwind.config.js 与 styles.css :root。
// 浅色、专业、克制的桌面效率工作台。

export const colors = {
  bg: "#F7F8FB",
  workbench: "#EEF3F8",
  surface: "#FFFFFF",
  surface2: "#F3F6FA",
  surface3: "#FAFBFC",
  text: "#111827",
  text2: "#64748B",
  muted: "#94A3B8",
  border: "#E2E8F0",
  borderStrong: "#CBD5E1",
  accent: "#0F9F7A",
  accentStrong: "#0B7F62",
  accentSoft: "#E7F5F0",
  onAccent: "#FFFFFF",
  ai: "#2563EB",
  aiSoft: "#EFF6FF",
  ok: "#10B981",
  warn: "#F59E0B",
  danger: "#EF4444",
  dangerSoft: "#FEF2F2",
} as const;

export const radius = {
  control: "6px",
  base: "8px",
  card: "8px",
  modal: "16px",
} as const;

export const shadow = {
  card: "0 6px 18px rgba(15, 23, 42, 0.045)",
  pop: "0 18px 48px rgba(15, 23, 42, 0.14)",
  topbar: "0 1px 0 rgba(15, 23, 42, 0.08)",
} as const;

export const typography = {
  fontFamily:
    "'Inter', 'SF Pro', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif",
  pageTitle: { size: 24, line: 32, weight: 700 },
  moduleTitle: { size: 16, line: 24, weight: 700 },
  cardTitle: { size: 14, line: 20, weight: 600 },
  body: { size: 14, line: 20 },
  aux: { size: 12, line: 18 },
  metric: { size: 28, line: 36, weight: 700 },
} as const;

export const spacing = {
  maxWidth: 1440,
  pageMargin: 24,
  gridGap: 20,
  cardPadding: 20,
  controlGap: 8,
  fieldRowGap: 16,
} as const;

// lucide-react 统一参数（图标规则）
export const iconProps = { size: 20, strokeWidth: 1.75 } as const;

export const sidebar = {
  defaultWidth: 420,
  minWidth: 320,
  maxWidth: 640,
} as const;

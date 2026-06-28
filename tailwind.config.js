/** @type {import('tailwindcss').Config} */
// 关键 token 同步自 DESIGN_SPEC.md / src/design/tokens.ts。
// 颜色走 CSS 变量(见 styles.css :root),使旧组件的内联 var(--x) 与新的工具类一致。
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        "surface-3": "var(--surface-3)",
        border: "var(--border)",
        "border-strong": "var(--border-strong)",
        text: "var(--text)",
        "text-2": "var(--text-2)",
        muted: "var(--muted)",
        accent: "var(--accent)",
        "accent-strong": "var(--accent-strong)",
        "accent-soft": "var(--accent-soft)",
        "on-accent": "var(--on-accent)",
        ai: "var(--ai)",
        "ai-soft": "var(--ai-soft)",
        ok: "var(--ok)",
        warn: "var(--warn)",
        danger: "var(--danger)",
        "danger-soft": "var(--danger-soft)",
      },
      borderRadius: {
        sm: "6px",
        DEFAULT: "8px",
        md: "8px",
        lg: "16px",
      },
      boxShadow: {
        card: "0 8px 24px rgba(15, 23, 42, 0.06)",
        pop: "0 18px 48px rgba(15, 23, 42, 0.14)",
        topbar: "0 1px 0 rgba(15, 23, 42, 0.08)",
      },
      fontFamily: {
        sans: [
          "Inter",
          "SF Pro",
          "Segoe UI",
          "PingFang SC",
          "Microsoft YaHei",
          "system-ui",
          "sans-serif",
        ],
      },
      fontSize: {
        // 与 spec Typography 对齐
        page: ["24px", { lineHeight: "32px", fontWeight: "700" }],
        module: ["16px", { lineHeight: "24px", fontWeight: "700" }],
        "card-title": ["14px", { lineHeight: "20px", fontWeight: "600" }],
        body: ["14px", "20px"],
        aux: ["12px", "18px"],
        metric: ["28px", { lineHeight: "36px", fontWeight: "700" }],
      },
      maxWidth: {
        shell: "1440px",
      },
    },
  },
  plugins: [],
};

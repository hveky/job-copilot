import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev proxy: 浏览器 → vite(同源)→ 上游,绕开 CORS。
// 上线到 Tauri 后,这些请求改由 Rust 核心发出(无 CORS、key 不进渲染层)。
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    proxy: {
      // DeepSeek 的 Anthropic 兼容端点:/api/ds/anthropic/v1/messages → api.deepseek.com/anthropic/v1/messages
      "/api/ds": {
        target: "https://api.deepseek.com",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/ds/, ""),
      },
      // Anthropic 官方:/api/anthropic/v1/messages → api.anthropic.com/v1/messages
      "/api/anthropic": {
        target: "https://api.anthropic.com",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/anthropic/, ""),
      },
    },
  },
});

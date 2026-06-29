// 产品内置的公益 DeepSeek Key。
//
// 作者愿意把自己的 DeepSeek API 作为默认 Key 嵌入桌面端供大家公益使用,
// 用户也可在「设置 → 模型配置」里填自己的 Key 覆盖(优先用用户填的)。
//
// Key 通过构建时环境变量注入(.env.local 的 VITE_DS_KEY),不写进公开仓库源码;
// 注意:打进 exe 后逆向可提取,与内置 Feishu secret 同属桌面端可接受折中。
export const BUILTIN_DS = {
  key: import.meta.env.VITE_DS_KEY ?? "",
  baseUrl:
    import.meta.env.VITE_DS_BASE_URL ?? "https://api.deepseek.com/anthropic",
};

export const hasBuiltinDs = (): boolean => !!BUILTIN_DS.key;

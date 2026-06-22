// 产品内置飞书 OAuth 客户端。
//
// 产品方(你)只需做一次:
//   1. 在飞书开放平台 https://open.feishu.cn 建一个「自建应用」;
//   2. 开通权限 bitable:app(多维表格读写)、offline_access(刷新);
//   3. 在应用「安全设置 → 重定向 URL」登记下面的 redirectUri;
//   4. 把应用的 App ID / App Secret 填到下面 clientId / clientSecret。
//
// 填好后,终端用户无需任何配置,点「用飞书账号授权」即可以自己账号身份写表。
// 用户也可在「设置」里覆盖成自己的应用(优先用用户填的)。
//
// 注意:client_secret 内置进桌面端会被逆向提取,属可接受的桌面 OAuth 折中;
// 如需更严,后续可改 PKCE 或加一个换 token 的轻后端代理。
export const BUILTIN_FEISHU = {
  clientId: "",
  clientSecret: "",
  redirectUri: "http://localhost:14520/feishu/callback",
};

export const hasBuiltinFeishu = (): boolean => !!BUILTIN_FEISHU.clientId;

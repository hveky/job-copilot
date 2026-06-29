/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DS_KEY?: string;
  readonly VITE_DS_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

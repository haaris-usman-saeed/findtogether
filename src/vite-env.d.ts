/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_MODE?: 'mock' | 'http';
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Font packages ship CSS only. TypeScript 6 checks side-effect imports, so declare it.
declare module '@fontsource-variable/public-sans';

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  // add more env variables here if needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// We don't need to duplicate Window extensions here as they're defined in app.ts
// with the correct types using declare global

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENABLE_AGENTATION?: string
  readonly VITE_OBSERVABILITY_DEBUG?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

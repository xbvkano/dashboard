export const isDevToolsEnabled =
  import.meta.env.VITE_DEVTOOLS === 'true' ||
  import.meta.env.VITE_ENABLE_DEVTOOLS === 'true'

export const isDevToolsEnabled =
  import.meta.env.VITE_DEVTOOLS === 'true' ||
  import.meta.env.VITE_DEVTOOLS === '1' ||
  import.meta.env.VITE_ENABLE_DEVTOOLS === 'true' ||
  import.meta.env.VITE_ENABLE_DEVTOOLS === '1'

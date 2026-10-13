import { defineConfig } from "vite"
import { devtools } from "@tanstack/devtools-vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [devtools(), tailwindcss(), tanstackStart(), viteReact()],
  // `pnpm demo` sets DEMO=1: the client then draws avatars instead of loading them.
  define:
    process.env.DEMO === "1" ? { "import.meta.env.VITE_DEMO": '"1"' } : {},
})

export default config

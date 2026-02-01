import adapter from "@sveltejs/adapter-auto"
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte"

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
    }),
    paths: {
      base: process.argv.includes("GITHUB_ACTIONS") ? process.env.BASE_PATH : "",
    },
  },
  compilerOptions: {
    runes: true,
  },
}

export default config

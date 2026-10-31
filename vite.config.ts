// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import type { Plugin } from "vite";

function vite7RolldownCompat(): Plugin {
  return {
    name: "vite7-rolldown-compat",
    enforce: "post",
    config(config: any) {
      if (config.environments) {
        for (const [name, env] of Object.entries(config.environments) as any[]) {
          if (env?.build?.rolldownOptions && (!env.build?.rollupOptions || !env.build?.rollupOptions?.input)) {
            env.build.rollupOptions = { ...env.build.rollupOptions, ...env.build.rolldownOptions };
          }
        }
      }
    },
    configEnvironment(name: string, envConfig: any) {
      if (envConfig?.build?.rolldownOptions && (!envConfig.build?.rollupOptions || !envConfig.build?.rollupOptions?.input)) {
        envConfig.build.rollupOptions = { ...envConfig.build.rollupOptions, ...envConfig.build.rolldownOptions };
      }
    },
    transform(code, id) {
      if (id.includes("@tanstack") && id.includes("history") && id.includes("index.js") && !code.includes("createServerHistory")) {
        return {
          code: code + "\nexport function createServerHistory(initialPath = '/') { return createMemoryHistory({ initialEntries: [initialPath] }); }\n",
          map: null,
        };
      }
    },
  };
}

export default defineConfig({
  plugins: [vite7RolldownCompat()],
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});


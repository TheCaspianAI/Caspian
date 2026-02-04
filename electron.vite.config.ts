import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import reactPlugin from "@vitejs/plugin-react";
import { codeInspectorPlugin } from "code-inspector-plugin";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import injectProcessEnvPlugin from "rollup-plugin-inject-process-env";
import tsconfigPathsPlugin from "vite-tsconfig-paths";

import { resources, version } from "./package.json";
import {
	copyResourcesPlugin,
	DEV_SERVER_PORT,
	defineEnv,
	devPath,
	htmlEnvTransformPlugin,
} from "./vite/helpers";

const tsconfigPaths = tsconfigPathsPlugin({
	projects: [resolve("tsconfig.json")],
});

// Sentry plugin for uploading sourcemaps - currently disabled
// To enable:
// 1. Import: import { sentryVitePlugin } from "@sentry/vite-plugin";
// 2. Uncomment and configure:
// const sentryPlugin = process.env.SENTRY_AUTH_TOKEN
// 	? sentryVitePlugin({
// 			org: "your-org",
// 			project: "desktop",
// 			authToken: process.env.SENTRY_AUTH_TOKEN,
// 			release: { name: version },
// 		})
// 	: null;
// 3. Add sentryPlugin to rollupOptions.plugins arrays

export default defineConfig({
	main: {
		plugins: [tsconfigPaths, copyResourcesPlugin()],

		define: {
			"process.env.NODE_ENV": defineEnv(process.env.NODE_ENV, "production"),
			// PostHog/Sentry env vars - currently disabled
			// "process.env.NEXT_PUBLIC_POSTHOG_KEY": defineEnv(process.env.NEXT_PUBLIC_POSTHOG_KEY),
			// "process.env.NEXT_PUBLIC_POSTHOG_HOST": defineEnv(process.env.NEXT_PUBLIC_POSTHOG_HOST),
			// "process.env.SENTRY_DSN_DESKTOP": defineEnv(process.env.SENTRY_DSN_DESKTOP),
		},

		build: {
			sourcemap: true,
			rollupOptions: {
				input: {
					index: resolve("src/main/index.ts"),
					// Terminal host daemon process - runs separately for terminal persistence
					"terminal-host": resolve("src/main/terminal-host/index.ts"),
					// PTY subprocess - spawned by terminal-host for each terminal
					"pty-subprocess": resolve("src/main/terminal-host/pty-subprocess.ts"),
				},
				output: {
					dir: resolve(devPath, "main"),
				},
				external: ["electron", "better-sqlite3", "node-pty"],
			},
		},
		resolve: {
			alias: {
				// @xterm/headless 6.0.0 has a packaging bug: `module` field points to
				// non-existent `lib/xterm.mjs`. Force Vite to use the CJS entry instead.
				"@xterm/headless": "@xterm/headless/lib-headless/xterm-headless.js",
			},
		},
	},

	preload: {
		plugins: [
			tsconfigPaths,
			externalizeDepsPlugin({
				exclude: ["trpc-electron"],
			}),
		],

		define: {
			"process.env.NODE_ENV": defineEnv(process.env.NODE_ENV, "production"),
			__APP_VERSION__: defineEnv(version),
		},

		build: {
			outDir: resolve(devPath, "preload"),
			rollupOptions: {
				input: {
					index: resolve("src/preload/index.ts"),
				},
			},
		},
	},

	renderer: {
		define: {
			"process.env.NODE_ENV": defineEnv(process.env.NODE_ENV),
			"process.platform": defineEnv(process.platform),
			"import.meta.env.DEV_SERVER_PORT": defineEnv(String(DEV_SERVER_PORT)),
			// PostHog/Sentry env vars - currently disabled
			// "import.meta.env.NEXT_PUBLIC_POSTHOG_KEY": defineEnv(process.env.NEXT_PUBLIC_POSTHOG_KEY),
			// "import.meta.env.NEXT_PUBLIC_POSTHOG_HOST": defineEnv(process.env.NEXT_PUBLIC_POSTHOG_HOST),
			// "import.meta.env.SENTRY_DSN_DESKTOP": defineEnv(process.env.SENTRY_DSN_DESKTOP),
		},

		server: {
			port: DEV_SERVER_PORT,
			strictPort: false,
		},

		plugins: [
			tanstackRouter({
				target: "react",
				routesDirectory: resolve("src/renderer/routes"),
				generatedRouteTree: resolve("src/renderer/routeTree.gen.ts"),
				indexToken: "page",
				routeToken: "layout",
				autoCodeSplitting: true,
			}),
			tsconfigPaths,
			tailwindcss(),
			reactPlugin(),
			codeInspectorPlugin({
				bundler: "vite",
				hotKeys: ["altKey"],
				hideConsole: true,
			}),
			htmlEnvTransformPlugin(),
		],

		worker: {
			format: "es",
		},

		optimizeDeps: {
			include: ["monaco-editor"],
		},

		publicDir: resolve(resources, "public"),

		build: {
			sourcemap: true,
			outDir: resolve(devPath, "renderer"),

			rollupOptions: {
				plugins: [
					injectProcessEnvPlugin({
						NODE_ENV: "production",
						platform: process.platform,
					}),
				],

				input: {
					index: resolve("src/renderer/index.html"),
				},
			},
		},
	},
});

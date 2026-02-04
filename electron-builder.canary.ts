/**
 * Electron Builder Configuration - Canary Build
 *
 * Extends the base config with canary-specific overrides for internal testing.
 * Can be installed side-by-side with the stable release.
 *
 * @see https://www.electron.build/configuration/configuration
 */

import { join } from "node:path";
import type { Configuration } from "electron-builder";
import baseConfig from "./electron-builder";
import pkg from "./package.json";

const productName = "Caspian Canary";

const config: Configuration = {
	...baseConfig,
	appId: "com.caspian.app.canary",
	productName,

	publish: {
		provider: "github",
		owner: "TheCaspianAI",
		repo: "Caspian",
		releaseType: "prerelease",
	},

	mac: {
		...baseConfig.mac,
		icon: join(pkg.resources, "build/icons/icon-canary.icns"),
		artifactName: `Caspian-Canary-\${version}-\${arch}.\${ext}`,
		extendInfo: {
			CFBundleName: productName,
			CFBundleDisplayName: productName,
		},
	},

	linux: {
		...baseConfig.linux,
		icon: join(pkg.resources, "build/icons/icon-canary.png"),
		synopsis: `${pkg.description} (Canary)`,
		artifactName: `caspian-canary-\${version}-\${arch}.\${ext}`,
	},

	win: {
		...baseConfig.win,
		icon: join(pkg.resources, "build/icons/icon-canary.ico"),
		artifactName: `Caspian-Canary-\${version}-\${arch}.\${ext}`,
	},
};

export default config;

/**
 * Playwright fixture for launching the compiled Caspian Electron app.
 *
 * Usage in test files:
 *   import { test, expect } from "./fixtures/electron";
 *
 * Provides two fixtures:
 *   - electronApp: The Electron application handle (for main-process evaluation)
 *   - window: The first BrowserWindow (a Playwright Page for UI interaction)
 *
 * The app is launched with CASPIAN_EXPOSE_TEST_DB=1 so that
 * `globalThis.__caspianTestDb` is available in main-process evaluate() calls
 * for seeding test data directly into the real SQLite database.
 */

import path from "node:path";
import { _electron, test as base, type ElectronApplication, type Page } from "@playwright/test";

type ElectronFixtures = {
	electronApp: ElectronApplication;
	window: Page;
};

export const test = base.extend<ElectronFixtures>({
	// biome-ignore lint/correctness/noEmptyPattern: Playwright fixture signature requires destructuring
	electronApp: async ({}, use) => {
		const appRoot = path.resolve(__dirname, "../../..");

		const electronApp = await _electron.launch({
			args: [path.join(appRoot, "dist/main/index.js")],
			cwd: appRoot,
			env: {
				...process.env,
				CASPIAN_EXPOSE_TEST_DB: "1",
				CASPIAN_E2E_TEST: "1",
			},
		});

		await use(electronApp);
		await electronApp.close();
	},

	window: async ({ electronApp }, use) => {
		const window = await electronApp.firstWindow();
		await window.waitForLoadState("domcontentloaded");
		await use(window);
	},
});

export { expect } from "@playwright/test";

import { defineConfig } from "@playwright/test";

export default defineConfig({
	testDir: "./tests/e2e",
	testMatch: "*.e2e.ts",
	timeout: 60_000,
	retries: 0,
	workers: 1,
	reporter: [["html", { open: "never" }]],
});

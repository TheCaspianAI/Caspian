import { describe, expect, it } from "bun:test";
import {
	resolveBranchPrefix,
	sanitizeAuthorPrefix,
	sanitizeBranchName,
	sanitizeSegment,
} from "./branch";

describe("sanitizeSegment", () => {
	it("converts to lowercase", () => {
		expect(sanitizeSegment("ABC")).toBe("abc");
		expect(sanitizeSegment("Hello World")).toBe("hello-world");
	});

	it("trims whitespace", () => {
		expect(sanitizeSegment("  hello  ")).toBe("hello");
		expect(sanitizeSegment("  hello world  ")).toBe("hello-world");
	});

	it("removes special characters", () => {
		expect(sanitizeSegment("hello!@#$%^&*()world")).toBe("helloworld");
		expect(sanitizeSegment("hello/world")).toBe("helloworld");
		expect(sanitizeSegment("hello_world")).toBe("helloworld");
		expect(sanitizeSegment("hello.world")).toBe("helloworld");
	});

	it("preserves hyphens and alphanumeric characters", () => {
		expect(sanitizeSegment("hello-world")).toBe("hello-world");
		expect(sanitizeSegment("feature123")).toBe("feature123");
		expect(sanitizeSegment("v1-0-0")).toBe("v1-0-0");
	});

	it("replaces spaces with hyphens", () => {
		expect(sanitizeSegment("hello world")).toBe("hello-world");
		expect(sanitizeSegment("hello   world")).toBe("hello-world");
	});

	it("collapses multiple hyphens", () => {
		expect(sanitizeSegment("hello---world")).toBe("hello-world");
		expect(sanitizeSegment("hello - - - world")).toBe("hello-world");
	});

	it("removes leading and trailing hyphens", () => {
		expect(sanitizeSegment("-hello-")).toBe("hello");
		expect(sanitizeSegment("---hello---")).toBe("hello");
		expect(sanitizeSegment("- hello -")).toBe("hello");
	});

	it("truncates to max length", () => {
		const longString = "a".repeat(100);
		expect(sanitizeSegment(longString)).toBe("a".repeat(50));
		expect(sanitizeSegment(longString, 10)).toBe("a".repeat(10));
		expect(sanitizeSegment(longString, 5)).toBe("a".repeat(5));
	});

	it("handles empty string", () => {
		expect(sanitizeSegment("")).toBe("");
	});

	it("handles strings that become empty after sanitization", () => {
		expect(sanitizeSegment("!!!")).toBe("");
		expect(sanitizeSegment("@#$%")).toBe("");
	});

	it("handles unicode characters", () => {
		expect(sanitizeSegment("héllo wörld")).toBe("hllo-wrld");
		expect(sanitizeSegment("日本語")).toBe("");
	});
});

describe("sanitizeAuthorPrefix", () => {
	it("delegates to sanitizeSegment", () => {
		expect(sanitizeAuthorPrefix("John Doe")).toBe("john-doe");
		expect(sanitizeAuthorPrefix("john.doe")).toBe("johndoe");
	});

	it("handles github-style usernames", () => {
		expect(sanitizeAuthorPrefix("johndoe")).toBe("johndoe");
		expect(sanitizeAuthorPrefix("john-doe")).toBe("john-doe");
		expect(sanitizeAuthorPrefix("john_doe")).toBe("johndoe");
	});
});

describe("sanitizeBranchName", () => {
	it("sanitizes each segment of a path", () => {
		expect(sanitizeBranchName("feature/new-feature")).toBe("feature/new-feature");
		expect(sanitizeBranchName("feature/New Feature")).toBe("feature/new-feature");
	});

	it("preserves forward slashes", () => {
		expect(sanitizeBranchName("user/feature/task")).toBe("user/feature/task");
	});

	it("removes empty segments", () => {
		expect(sanitizeBranchName("feature//new")).toBe("feature/new");
		expect(sanitizeBranchName("/feature/")).toBe("feature");
		expect(sanitizeBranchName("///feature///")).toBe("feature");
	});

	it("handles branch names without slashes", () => {
		expect(sanitizeBranchName("main")).toBe("main");
		expect(sanitizeBranchName("develop")).toBe("develop");
	});

	it("sanitizes special characters in each segment", () => {
		expect(sanitizeBranchName("john.doe/feature!name")).toBe("johndoe/featurename");
	});
});

describe("resolveBranchPrefix", () => {
	describe("mode: none", () => {
		it("returns null regardless of other options", () => {
			expect(
				resolveBranchPrefix({
					mode: "none",
					customPrefix: "custom",
					authorPrefix: "author",
					githubUsername: "github",
				}),
			).toBeNull();
		});
	});

	describe("mode: custom", () => {
		it("returns sanitized custom prefix", () => {
			expect(
				resolveBranchPrefix({
					mode: "custom",
					customPrefix: "my-prefix",
				}),
			).toBe("my-prefix");
		});

		it("sanitizes the custom prefix", () => {
			expect(
				resolveBranchPrefix({
					mode: "custom",
					customPrefix: "My Prefix",
				}),
			).toBe("my-prefix");
		});

		it("returns null if customPrefix is empty", () => {
			expect(
				resolveBranchPrefix({
					mode: "custom",
					customPrefix: "",
				}),
			).toBeNull();
		});

		it("returns null if customPrefix is null/undefined", () => {
			expect(
				resolveBranchPrefix({
					mode: "custom",
					customPrefix: null,
				}),
			).toBeNull();
			expect(
				resolveBranchPrefix({
					mode: "custom",
				}),
			).toBeNull();
		});
	});

	describe("mode: author", () => {
		it("returns sanitized author prefix", () => {
			expect(
				resolveBranchPrefix({
					mode: "author",
					authorPrefix: "john-doe",
				}),
			).toBe("john-doe");
		});

		it("sanitizes the author prefix", () => {
			expect(
				resolveBranchPrefix({
					mode: "author",
					authorPrefix: "John Doe",
				}),
			).toBe("john-doe");
		});

		it("returns null if authorPrefix is empty", () => {
			expect(
				resolveBranchPrefix({
					mode: "author",
					authorPrefix: "",
				}),
			).toBeNull();
		});

		it("returns null if authorPrefix is null/undefined", () => {
			expect(
				resolveBranchPrefix({
					mode: "author",
					authorPrefix: null,
				}),
			).toBeNull();
		});
	});

	describe("mode: github", () => {
		it("prefers github username over author prefix", () => {
			expect(
				resolveBranchPrefix({
					mode: "github",
					githubUsername: "github-user",
					authorPrefix: "author-name",
				}),
			).toBe("github-user");
		});

		it("falls back to author prefix if github username is not available", () => {
			expect(
				resolveBranchPrefix({
					mode: "github",
					authorPrefix: "author-name",
				}),
			).toBe("author-name");
			expect(
				resolveBranchPrefix({
					mode: "github",
					githubUsername: null,
					authorPrefix: "author-name",
				}),
			).toBe("author-name");
			expect(
				resolveBranchPrefix({
					mode: "github",
					githubUsername: "",
					authorPrefix: "author-name",
				}),
			).toBe("author-name");
		});

		it("returns null if both are empty", () => {
			expect(
				resolveBranchPrefix({
					mode: "github",
				}),
			).toBeNull();
			expect(
				resolveBranchPrefix({
					mode: "github",
					githubUsername: "",
					authorPrefix: "",
				}),
			).toBeNull();
		});

		it("sanitizes the github username", () => {
			expect(
				resolveBranchPrefix({
					mode: "github",
					githubUsername: "GitHub User",
				}),
			).toBe("github-user");
		});
	});

	describe("mode: null/undefined", () => {
		it("returns null", () => {
			expect(
				resolveBranchPrefix({
					mode: null,
					customPrefix: "custom",
				}),
			).toBeNull();
			expect(
				resolveBranchPrefix({
					mode: undefined,
					customPrefix: "custom",
				}),
			).toBeNull();
		});
	});

	describe("unknown mode", () => {
		it("returns null for unknown modes", () => {
			expect(
				resolveBranchPrefix({
					mode: "unknown" as Parameters<typeof resolveBranchPrefix>[0]["mode"],
					customPrefix: "custom",
				}),
			).toBeNull();
		});
	});
});

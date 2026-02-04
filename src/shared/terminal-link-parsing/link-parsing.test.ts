import { describe, expect, it } from "bun:test";
import {
	decodeUrlEncodedPath,
	detectLinkSuffixes,
	detectLinks,
	getLinkSuffix,
	OperatingSystem,
	removeLinkQueryString,
	removeLinkSuffix,
} from "./link-parsing";

describe("removeLinkSuffix", () => {
	it("removes line number suffix", () => {
		expect(removeLinkSuffix("file.ts:10")).toBe("file.ts");
		expect(removeLinkSuffix("file.ts:10:5")).toBe("file.ts");
		expect(removeLinkSuffix("path/to/file.ts:123")).toBe("path/to/file.ts");
	});

	it("removes line suffix with space separator", () => {
		expect(removeLinkSuffix("file.ts 10")).toBe("file.ts");
		expect(removeLinkSuffix("file.ts 10:5")).toBe("file.ts");
	});

	it("removes parentheses-style line suffix", () => {
		expect(removeLinkSuffix("file.ts(10)")).toBe("file.ts");
		expect(removeLinkSuffix("file.ts(10,5)")).toBe("file.ts");
		expect(removeLinkSuffix("file.ts (10)")).toBe("file.ts");
	});

	it("removes line suffix with 'line' keyword", () => {
		expect(removeLinkSuffix("file.ts, line 10")).toBe("file.ts");
		expect(removeLinkSuffix("file.ts: line 10")).toBe("file.ts");
		expect(removeLinkSuffix("file.ts on line 10")).toBe("file.ts");
	});

	it("returns original if no suffix found", () => {
		expect(removeLinkSuffix("file.ts")).toBe("file.ts");
		expect(removeLinkSuffix("path/to/file")).toBe("path/to/file");
	});

	it("handles quoted paths", () => {
		expect(removeLinkSuffix('"file.ts":10')).toBe('"file.ts"');
		// The suffix pattern ", line 10" includes the leading quote
		expect(removeLinkSuffix('"file.ts", line 10')).toBe('"file.ts');
	});
});

describe("removeLinkQueryString", () => {
	it("removes query string from path", () => {
		expect(removeLinkQueryString("file.ts?foo=bar")).toBe("file.ts");
		expect(removeLinkQueryString("path/to/file.ts?query")).toBe("path/to/file.ts");
	});

	it("returns original if no query string", () => {
		expect(removeLinkQueryString("file.ts")).toBe("file.ts");
		expect(removeLinkQueryString("path/to/file.ts")).toBe("path/to/file.ts");
	});

	it("handles UNC paths with ? prefix", () => {
		expect(removeLinkQueryString("\\\\?\\C:\\path\\file.ts")).toBe(
			"\\\\?\\C:\\path\\file.ts",
		);
		expect(removeLinkQueryString("\\\\?\\C:\\path\\file.ts?query")).toBe(
			"\\\\?\\C:\\path\\file.ts",
		);
	});
});

describe("getLinkSuffix", () => {
	it("extracts colon-separated line number", () => {
		const suffix = getLinkSuffix("file.ts:10");
		expect(suffix?.row).toBe(10);
		expect(suffix?.col).toBeUndefined();
	});

	it("extracts colon-separated line and column", () => {
		const suffix = getLinkSuffix("file.ts:10:5");
		expect(suffix?.row).toBe(10);
		expect(suffix?.col).toBe(5);
	});

	it("extracts space-separated line number", () => {
		const suffix = getLinkSuffix("file.ts 10");
		expect(suffix?.row).toBe(10);
	});

	it("extracts parentheses-style line number", () => {
		const suffix = getLinkSuffix("file.ts(10)");
		expect(suffix?.row).toBe(10);
	});

	it("extracts parentheses-style line and column", () => {
		const suffix = getLinkSuffix("file.ts(10,5)");
		expect(suffix?.row).toBe(10);
		expect(suffix?.col).toBe(5);
	});

	it("extracts line keyword style", () => {
		const suffix = getLinkSuffix("file.ts, line 10");
		expect(suffix?.row).toBe(10);
	});

	it("extracts line and column keyword style", () => {
		const suffix = getLinkSuffix("file.ts, line 10, col 5");
		expect(suffix?.row).toBe(10);
		expect(suffix?.col).toBe(5);
	});

	it("extracts range suffix", () => {
		const suffix = getLinkSuffix("file.ts:10:5-20");
		expect(suffix?.row).toBe(10);
		expect(suffix?.col).toBe(5);
		expect(suffix?.colEnd).toBe(20);
	});

	it("returns null for no suffix", () => {
		expect(getLinkSuffix("file.ts")).toBeNull();
		expect(getLinkSuffix("path/to/file")).toBeNull();
	});
});

describe("detectLinkSuffixes", () => {
	it("detects multiple suffixes on a line", () => {
		const suffixes = detectLinkSuffixes("error at file.ts:10 and other.ts:20");
		expect(suffixes.length).toBe(2);
		expect(suffixes[0]?.row).toBe(10);
		expect(suffixes[1]?.row).toBe(20);
	});

	it("returns empty array for line with no suffixes", () => {
		expect(detectLinkSuffixes("no links here")).toEqual([]);
	});
});

describe("decodeUrlEncodedPath", () => {
	it("decodes URL-encoded characters", () => {
		expect(decodeUrlEncodedPath("path%20with%20spaces")).toBe("path with spaces");
		expect(decodeUrlEncodedPath("file%3Aname")).toBe("file:name");
		expect(decodeUrlEncodedPath("path%2Fto%2Ffile")).toBe("path/to/file");
	});

	it("returns original if no encoding", () => {
		expect(decodeUrlEncodedPath("simple/path")).toBe("simple/path");
	});

	it("handles malformed encoding gracefully", () => {
		expect(decodeUrlEncodedPath("bad%encoding")).toBe("bad%encoding");
		expect(decodeUrlEncodedPath("path%")).toBe("path%");
	});
});

describe("detectLinks", () => {
	describe("Unix paths (macOS/Linux)", () => {
		const os = OperatingSystem.Macintosh;

		it("detects absolute paths", () => {
			const links = detectLinks("See /path/to/file.ts for details", os);
			expect(links.length).toBe(1);
			expect(links[0]?.path.text).toBe("/path/to/file.ts");
		});

		it("detects relative paths with ./ prefix", () => {
			const links = detectLinks("Edit ./src/file.ts", os);
			expect(links.length).toBe(1);
			expect(links[0]?.path.text).toBe("./src/file.ts");
		});

		it("detects relative paths with ../ prefix", () => {
			const links = detectLinks("See ../other/file.ts", os);
			expect(links.length).toBe(1);
			expect(links[0]?.path.text).toBe("../other/file.ts");
		});

		it("detects paths with ~ home directory", () => {
			const links = detectLinks("Edit ~/Documents/file.ts", os);
			expect(links.length).toBe(1);
			expect(links[0]?.path.text).toBe("~/Documents/file.ts");
		});

		it("detects file:// URLs", () => {
			const links = detectLinks("Open file:///path/to/file.ts", os);
			expect(links.length).toBe(1);
			expect(links[0]?.path.text).toBe("file:///path/to/file.ts");
		});

		it("detects paths with line numbers", () => {
			const links = detectLinks("Error in /path/file.ts:10:5", os);
			expect(links.length).toBe(1);
			expect(links[0]?.path.text).toBe("/path/file.ts");
			expect(links[0]?.suffix?.row).toBe(10);
			expect(links[0]?.suffix?.col).toBe(5);
		});

		it("handles git diff output", () => {
			const links = detectLinks("--- a/src/file.ts", os);
			expect(links.length).toBe(1);
			expect(links[0]?.path.text).toBe("src/file.ts");
		});

		it("detects multiple paths on same line", () => {
			const links = detectLinks("Compare /path/a.ts and /path/b.ts", os);
			expect(links.length).toBe(2);
		});
	});

	describe("Windows paths", () => {
		const os = OperatingSystem.Windows;

		it("detects drive letter paths", () => {
			const links = detectLinks("Edit C:\\Users\\file.ts", os);
			expect(links.length).toBe(1);
			expect(links[0]?.path.text).toBe("C:\\Users\\file.ts");
		});

		it("detects UNC paths", () => {
			const links = detectLinks("See \\\\?\\C:\\path\\file.ts", os);
			expect(links.length).toBe(1);
			expect(links[0]?.path.text).toBe("\\\\?\\C:\\path\\file.ts");
		});

		it("detects file:// URLs with drive letter", () => {
			const links = detectLinks("Open file:///c:/path/file.ts", os);
			expect(links.length).toBe(1);
			expect(links[0]?.path.text).toBe("file:///c:/path/file.ts");
		});

		it("detects relative paths with .\\ prefix", () => {
			const links = detectLinks("Edit .\\src\\file.ts", os);
			expect(links.length).toBe(1);
			expect(links[0]?.path.text).toBe(".\\src\\file.ts");
		});
	});

	describe("paths with suffixes", () => {
		const os = OperatingSystem.Macintosh;

		it("detects path with parentheses suffix", () => {
			const links = detectLinks("error in file.ts(10,5)", os);
			expect(links.length).toBeGreaterThanOrEqual(1);
			const link = links.find((l) => l.suffix?.row === 10);
			expect(link?.suffix?.row).toBe(10);
			expect(link?.suffix?.col).toBe(5);
		});

		it("detects path with 'line' suffix", () => {
			const links = detectLinks('"file.ts", line 10', os);
			expect(links.length).toBeGreaterThanOrEqual(1);
			const link = links.find((l) => l.suffix?.row === 10);
			expect(link?.suffix?.row).toBe(10);
		});

		it("detects path with 'on line' suffix", () => {
			const links = detectLinks('"file.ts" on line 10', os);
			expect(links.length).toBeGreaterThanOrEqual(1);
			const link = links.find((l) => l.suffix?.row === 10);
			expect(link?.suffix?.row).toBe(10);
		});

		it("detects path with range suffix", () => {
			const links = detectLinks("/path/file.ts:10:5-20", os);
			expect(links.length).toBe(1);
			expect(links[0]?.suffix?.row).toBe(10);
			expect(links[0]?.suffix?.col).toBe(5);
			expect(links[0]?.suffix?.colEnd).toBe(20);
		});

		it("detects path with lines range", () => {
			const links = detectLinks('"file.ts", lines 10-20', os);
			expect(links.length).toBeGreaterThanOrEqual(1);
			const link = links.find((l) => l.suffix?.row === 10);
			expect(link?.suffix?.row).toBe(10);
			expect(link?.suffix?.rowEnd).toBe(20);
		});
	});

	describe("edge cases", () => {
		const os = OperatingSystem.Macintosh;

		it("returns empty array for no paths", () => {
			expect(detectLinks("no paths here", os)).toEqual([]);
		});

		it("handles empty string", () => {
			expect(detectLinks("", os)).toEqual([]);
		});

		it("handles paths with special characters", () => {
			const links = detectLinks("/path/to/file-name_v2.ts", os);
			expect(links.length).toBe(1);
		});

		it("handles deeply nested paths", () => {
			const links = detectLinks("/a/b/c/d/e/f/g/h/i/j/file.ts", os);
			expect(links.length).toBe(1);
		});
	});
});

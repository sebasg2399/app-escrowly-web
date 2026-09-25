import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Regression guard for the `max-w-md` layout bug.
 *
 * A previous version of `src/styles/index.css` defined custom spacing tokens
 * (`--spacing-sm`, `--spacing-md`, ...) inside the `@theme` block. Tailwind v4
 * treats those as overrides of the base `--spacing` token, which made
 * `max-w-md` resolve to `24px` instead of `28rem` and broke the auth page
 * layout. The fix removed every custom `--spacing-*` key from the file.
 *
 * This static guard fails CI if anyone re-introduces one.
 */
describe("styles/index.css @theme token contract", () => {
  it("does not declare custom --spacing-* keys (which would clobber Tailwind max-w-md)", () => {
    const cssPath = resolve(__dirname, "./index.css");
    const css = readFileSync(cssPath, "utf-8");

    const themeMatch = css.match(/@theme\s*\{([\s\S]*?)\}/);
    expect(themeMatch, "expected to find an @theme { ... } block in index.css").not.toBeNull();
    const themeBlock = themeMatch?.[1] ?? "";

    // Match every declaration starting with `--spacing-` (e.g. `--spacing-md: ...`).
    const spacingKeys = themeBlock.match(/--spacing-[a-zA-Z0-9-]+\s*:/g) ?? [];

    expect(spacingKeys).toEqual([]);
  });
});

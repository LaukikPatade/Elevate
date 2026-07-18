import type { Locator as PwLocator, Page } from "playwright";
import type { Locator, RobustTarget } from "../types.js";

const CANDIDATE_TIMEOUT_MS = 2500;

export function resolveOne(page: Page, locator: Locator): PwLocator {
  let resolved: PwLocator;
  switch (locator.strategy) {
    case "role":
      resolved = page.getByRole(locator.role as any, { name: locator.value, exact: false });
      break;
    case "text":
      resolved = page.getByText(locator.value, { exact: false });
      break;
    case "placeholder":
      resolved = page.getByPlaceholder(locator.value, { exact: false });
      break;
    case "testid":
      resolved = page.locator(
        `[data-test="${locator.value}"], [data-testid="${locator.value}"]`,
      );
      break;
    default:
      resolved = page.locator(locator.value);
  }
  return locator.nth != null ? resolved.nth(locator.nth) : resolved.first();
}

export async function resolveRobust(
  page: Page,
  target: RobustTarget,
): Promise<{ locator: PwLocator; usedFallback: boolean } | null> {
  const candidates = [target.primary, ...target.fallbacks];
  for (const [index, candidate] of candidates.entries()) {
    const locator = resolveOne(page, candidate);
    try {
      await locator.waitFor({ state: "visible", timeout: CANDIDATE_TIMEOUT_MS });
      return { locator, usedFallback: index > 0 };
    } catch {
      continue;
    }
  }
  return null;
}

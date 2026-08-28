import { createHash } from "node:crypto";
import type { Page } from "playwright";
import type { PageSnapshot, SemanticNode } from "../types.js";

const MAX_NODES = 200;
const NAME_PREFIX_LENGTH = 12;

async function harvestInteractiveNodes(page: Page): Promise<SemanticNode[]> {
  return page.evaluate((maxNodes) => {
    const SELECTOR =
      "a, button, input, select, textarea, [role], [data-test], [data-testid], h1, h2";
    const seen = new Set<Element>();
    const nodes: Array<Record<string, string>> = [];

    const accessibleName = (el: Element): string => {
      const aria = el.getAttribute("aria-label");
      if (aria) return aria.trim();
      const placeholder = el.getAttribute("placeholder");
      if (placeholder) return placeholder.trim();
      const text = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (text && text.length <= 80) return text;
      const value = (el as HTMLInputElement).value;
      if (value) return String(value).trim();
      return (el.getAttribute("name") || el.getAttribute("title") || "").trim();
    };

    const roleOf = (el: Element): string => {
      const explicit = el.getAttribute("role");
      if (explicit) return explicit;
      const tag = el.tagName.toLowerCase();
      if (tag === "a") return "link";
      if (tag === "button") return "button";
      if (tag === "select") return "combobox";
      if (tag === "textarea") return "textbox";
      if (tag === "h1" || tag === "h2") return "heading";
      if (tag === "input") {
        const type = (el as HTMLInputElement).type;
        if (type === "submit" || type === "button") return "button";
        if (type === "checkbox") return "checkbox";
        if (type === "radio") return "radio";
        return "textbox";
      }
      return tag;
    };

    const isVisible = (el: Element): boolean => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== "hidden" &&
        style.display !== "none"
      );
    };

    for (const el of Array.from(document.querySelectorAll(SELECTOR))) {
      if (seen.has(el) || !isVisible(el)) continue;
      seen.add(el);
      const node: Record<string, string> = {
        role: roleOf(el),
        name: accessibleName(el),
        tag: el.tagName.toLowerCase(),
      };
      const testid = el.getAttribute("data-test") || el.getAttribute("data-testid");
      if (testid) node.testid = testid;
      const placeholder = el.getAttribute("placeholder");
      if (placeholder) node.placeholder = placeholder;
      if (node.name || node.testid) nodes.push(node);
      if (nodes.length >= maxNodes) break;
    }
    return nodes;
  }, MAX_NODES) as unknown as Promise<SemanticNode[]>;
}

export function fingerprintOf(nodes: SemanticNode[]): string {
  const shapes = nodes.map(
    (n) =>
      `${n.role}:${n.testid ?? ""}:${(n.name || "")
        .slice(0, NAME_PREFIX_LENGTH)
        .toLowerCase()}`,
  );
  const shape = [...new Set(shapes)].sort().join("|");
  return createHash("sha256").update(shape).digest("hex").slice(0, 16);
}

export async function perceive(page: Page): Promise<PageSnapshot> {
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  const nodes = await harvestInteractiveNodes(page);
  return {
    url: page.url(),
    title: await page.title().catch(() => ""),
    nodes,
    fingerprint: fingerprintOf(nodes),
    approxTokens: Math.ceil(JSON.stringify(nodes).length / 4),
  };
}

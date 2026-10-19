import assert from "node:assert/strict";
import { it } from "node:test";
import { runInNewContext } from "node:vm";
import { sidebarClient, sidebarInit } from "../../src/docs/sidebar.js";

it("persists desktop visibility and keeps the mobile drawer independent across resizes", () => {
  const element = () => {
    const classes = new Set<string>();
    return {
      attributes: {} as Record<string, string>, events: {} as Record<string, (event?: unknown) => void>, hidden: true,
      textContent: JSON.stringify({ words: { showSidebar: "Show", hideSidebar: "Hide" } }),
      classList: { contains: (key: string) => classes.has(key), toggle: (key: string, value: boolean) => { if (value) classes.add(key); else classes.delete(key); } },
      setAttribute(key: string, value: string) { this.attributes[key] = value; },
      removeAttribute(key: string) { delete this.attributes[key]; },
      addEventListener(key: string, callback: (event?: unknown) => void) { this.events[key] = callback; },
      focus() {},
    };
  };
  const ids = ["docs-config", "menu-toggle", "sidebar", "drawer-backdrop", "resource-search", "menu-close"];
  const elements = Object.fromEntries(ids.map((id) => [id, element()]));
  const dataset: Record<string, string> = {};
  const style = { overflow: "" };
  const documentEvents: Record<string, (event: unknown) => void> = {};
  const media = { matches: false, changed: () => {}, addEventListener(_key: string, callback: () => void) { this.changed = callback; } };
  let saved: string | null = "collapsed";
  const context = {
    document: { documentElement: { dataset }, body: { style }, getElementById: (id: string) => elements[id],
      addEventListener: (key: string, callback: (event: unknown) => void) => { documentEvents[key] = callback; } },
    matchMedia: () => media,
    localStorage: { getItem: () => saved, setItem: (_key: string, value: string) => { saved = value; } },
  };
  runInNewContext(sidebarInit, context);
  runInNewContext(sidebarClient, context);
  const menu = elements["menu-toggle"]!;
  const sidebar = elements.sidebar!;
  assert.equal(menu.attributes["aria-expanded"], "false");
  menu.events.click!();
  assert.equal(dataset.sidebar, "expanded");
  assert.equal(saved, "expanded");
  assert.equal(menu.attributes["aria-expanded"], "true");
  assert.equal(style.overflow, "");
  menu.events.click!();
  assert.equal(saved, "collapsed");

  media.matches = true;
  media.changed();
  menu.events.click!();
  assert.equal(sidebar.attributes.role, "dialog");
  assert.equal(style.overflow, "hidden");
  assert.equal(saved, "collapsed", "Opening a mobile drawer must not change the desktop preference");
  documentEvents.keydown!({ key: "Escape", preventDefault() {} });
  assert.equal(style.overflow, "");
  assert.equal(menu.attributes["aria-expanded"], "false");
  menu.events.click!();
  media.matches = false;
  media.changed();
  assert.equal(sidebar.attributes.role, undefined);
  assert.equal(style.overflow, "");
  assert.equal(menu.attributes["aria-expanded"], "false");

  context.localStorage.getItem = () => { throw new Error("Storage blocked"); };
  context.localStorage.setItem = () => { throw new Error("Storage blocked"); };
  assert.doesNotThrow(() => { runInNewContext(sidebarInit, context); runInNewContext(sidebarClient, context); menu.events.click!(); });
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const groupLanguages = read("../assets/group-languages.js");
const siteEnhancements = read("../assets/site-enhancements.js");

test("group and shared language systems synchronize in both directions", () => {
  assert.ok(groupLanguages.includes('document.addEventListener("royal:site-language"'));
  assert.ok(groupLanguages.includes('new CustomEvent("royal:group-language"'));
  assert.ok(siteEnhancements.includes('document.addEventListener("royal:group-language"'));
});

test("group pages keep one language picker while translating shared content", () => {
  assert.ok(siteEnhancements.includes('document.getElementById("groupLangBtn")'));
  for (const page of ["../index.html", "../developers.html", "../coffee.html", "../transportation.html"]) {
    const html = read(page);
    assert.ok(html.includes('id="groupLangBtn"'), page + " must expose the group language control");
    assert.ok(html.includes("/assets/group-languages.js"), page + " must load group translations");
    assert.ok(html.includes("/assets/site-enhancements.js"), page + " must load shared translations");
  }
});

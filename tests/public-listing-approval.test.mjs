import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const propertiesPage = read("../properties.html");
const listingApi = read("../functions/api/listings.js");
const translations = read("../assets/royal.js");

test("public property catalogue contains no hard-coded inventory", () => {
  assert.match(propertiesPage, /const listings=\[\];/);
  assert.doesNotMatch(propertiesPage, /id:"(hurghada-land|sokhna-villa|suez-admin)"/);
});

test("public catalogue is populated only through the approved-listings API", () => {
  assert.ok(propertiesPage.includes('fetch("/api/listings")'));
  assert.match(listingApi, /status\s*=\s*'approved'/);
});

test("empty approved catalogue has an Arabic, English and Russian message", () => {
  assert.ok(translations.includes('noApprovedListings:"لا توجد عقارات معتمدة منشورة حاليًا.'));
  assert.ok(translations.includes('noApprovedListings:"No approved properties are currently published.'));
  assert.ok(translations.includes('noApprovedListings:"Сейчас нет опубликованных одобренных объектов.'));
});

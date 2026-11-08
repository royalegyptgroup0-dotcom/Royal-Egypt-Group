import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Coffee and Transportation pages collect expressions of interest without implying bookings", async () => {
  for (const page of ["coffee.html", "transportation.html"]) {
    const html = await readFile(new URL("../" + page, import.meta.url), "utf8");
    assert.match(html, /id="groupContactForm"/);
    assert.match(html, /name="request_type" value="customer"/);
    assert.match(html, /name="consent" value="yes" required/);
    assert.match(html, /name="website"/);
    assert.match(html, /assets\/contact-intake\.js/);
    assert.match(html, /data-contact-i18n="interestTitle"/);
    assert.match(html, /data-contact-i18n="interestPrivacy"/);
    assert.match(html, /لا يمثل حجزًا|not a booking|не бронирование/i);
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildImport } from "./import-ceo-facebook-archive.mjs";

test("imports Facebook posts in chronological order and skips existing content", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ceo-facebook-"));
  try {
    const postsDir = path.join(root, "posts");
    await mkdir(postsDir);
    const duplicateText = "لما الرقم يتحسن… والشغل يسوء";
    const newText = "منشور قديم من أرشيف فيسبوك";
    await writeFile(path.join(postsDir, "your_posts_1.json"), JSON.stringify([
      { timestamp: 1794000000, id: "fb-export-id-not-in-feed", data: [{ post: duplicateText }] },
      { timestamp: 1793000000, data: [{ post: newText }], id: "fb-archive-1" }
    ]));
    const current = {
      version: 1,
      posts: [{
        day: 25,
        title: duplicateText,
        article: duplicateText,
        publishedAt: new Date(1794000000 * 1000).toISOString(),
        status: "Published"
      }]
    };
    const result = await buildImport({ input: root, current });
    assert.equal(result.importReport.imported, 1);
    assert.equal(result.importReport.skippedDuplicates, 1);
    assert.equal(result.posts.length, 2);
    assert.equal(result.posts[0].day, 1);
    assert.equal(result.posts[0].facebookPostId, "fb-archive-1");
    assert.equal(result.posts[1].day, 25);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects an archive folder with no post JSON files", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ceo-facebook-empty-"));
  try {
    await assert.rejects(
      () => buildImport({ input: root, current: { version: 1, posts: [] } }),
      /No Facebook post JSON files found/
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

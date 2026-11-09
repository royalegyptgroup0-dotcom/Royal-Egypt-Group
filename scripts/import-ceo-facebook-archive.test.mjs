import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm, access } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildImport } from "./import-ceo-facebook-archive.mjs";

test("imports Facebook posts chronologically and skips existing content", async () => {
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

test("copies attached images and adds local image URLs to imported posts", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ceo-facebook-media-"));
  try {
    const postsDir = path.join(root, "posts");
    const mediaDir = path.join(postsDir, "media");
    const outputDir = path.join(root, "site", "images", "facebook-archive");
    await mkdir(mediaDir, { recursive: true });
    await writeFile(path.join(mediaDir, "original-photo.jpg"), Buffer.from("test-image-bytes"));
    await writeFile(path.join(postsDir, "your_posts_1.json"), JSON.stringify([{
      timestamp: 1793000000,
      id: "fb-with-image",
      data: [{ post: "منشور مصحوب بصورة" }],
      attachments: [{ data: [{ media: { uri: "posts/media/original-photo.jpg", mime_type: "image/jpeg" } }] }]
    }]));
    const result = await buildImport({
      input: root,
      current: { version: 1, posts: [] },
      mediaOutput: outputDir,
      mediaUrlPrefix: "/images/facebook-archive"
    });
    const post = result.posts[0];
    assert.equal(result.importReport.recordsWithMedia, 1);
    assert.equal(result.importReport.mediaCopied, 1);
    assert.equal(post.images.length, 1);
    assert.match(post.imageUrl, /^\/images\/facebook-archive\/fb-[a-f0-9]{24}\.jpg$/);
    await access(path.join(outputDir, path.basename(post.imageUrl)));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("enriches a matching existing feed post with archive images without replacing its current image", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ceo-facebook-enrich-"));
  try {
    const postsDir = path.join(root, "posts");
    const mediaDir = path.join(postsDir, "media");
    const outputDir = path.join(root, "site", "images", "facebook-archive");
    await mkdir(mediaDir, { recursive: true });
    await writeFile(path.join(mediaDir, "photo.png"), Buffer.from("another-test-image"));
    const timestamp = 1793000000;
    const article = "منشور موجود بالفعل";
    await writeFile(path.join(postsDir, "your_posts_1.json"), JSON.stringify([{
      timestamp,
      id: "fb-duplicate-with-photo",
      data: [{ post: article }],
      attachments: [{ data: [{ media: { uri: "posts/media/photo.png" } }] }]
    }]));
    const current = {
      version: 1,
      posts: [{
        day: 12,
        title: article,
        article,
        publishedAt: new Date(timestamp * 1000).toISOString(),
        imageUrl: "https://example.invalid/existing-image.jpg"
      }]
    };
    const result = await buildImport({
      input: root,
      current,
      mediaOutput: outputDir,
      mediaUrlPrefix: "/images/facebook-archive"
    });
    assert.equal(result.importReport.imported, 0);
    assert.equal(result.importReport.skippedDuplicates, 1);
    assert.equal(result.importReport.existingPostsEnriched, 1);
    assert.equal(result.posts[0].imageUrl, "https://example.invalid/existing-image.jpg");
    assert.equal(result.posts[0].images.length, 1);
    assert.match(result.posts[0].images[0], /^\/images\/facebook-archive\//);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("ignores unsafe and missing media paths without failing the text import", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ceo-facebook-unsafe-"));
  try {
    await mkdir(path.join(root, "posts"));
    await writeFile(path.join(root, "posts", "your_posts_1.json"), JSON.stringify([{
      timestamp: 1793000000,
      data: [{ post: "منشور بدون ملف صورة متاح" }],
      attachments: [{ data: [
        { media: { uri: "../../outside.jpg" } },
        { media: { uri: "posts/media/missing.jpg" } }
      ] }]
    }]));
    const result = await buildImport({
      input: root,
      current: { version: 1, posts: [] },
      mediaOutput: path.join(root, "output")
    });
    assert.equal(result.importReport.imported, 1);
    assert.equal(result.posts[0].images.length, 0);
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

# CEO Notes — Global Editorial Redesign Brief

**Role:** AI Web Design Lead / UX & Accessibility Designer
**Project:** CEO Notes
**Target:** https://ceo-notes.pages.dev/
**Working branch:** design/ceo-notes-global-editorial-2026-11-09
**Cost ceiling:** USD 0. No paid tools, subscriptions, templates, stock assets, fonts, APIs, or new hosting.

## Product direction
Turn CEO Notes into a distinctive, international editorial publication about leadership, management, decision-making, and practical business thinking. It should feel like a serious independent journal—not a generic blog, corporate landing page, or dashboard.

## Design principles
1. Editorial-first: the latest insight and the archive are the primary experience. Market data, clocks, and radio must not compete with the publication.
2. Arabic-first and RTL-correct, with a clear path to a complete English experience. Language switching must preserve the current article and navigation context.
3. Mobile-first, fast, readable, accessible, and usable on low-end devices and slower connections.
4. Distinctive visual identity: restrained editorial typography, clear hierarchy, generous whitespace, deliberate color, and consistent components.
5. Content-led layouts: a featured lead story, curated recent notes, topic discovery, and a searchable/filterable archive.
6. Every article gets a stable canonical URL, useful metadata, social preview, structured data, and share controls.
7. Progressive enhancement: core articles remain readable if JavaScript, third-party services, or optional widgets fail.
8. Preserve the existing publishing feed, archive days 1–27, /feed, /post/:day, RSS, Worker routes, and all current content. Do not rewrite historical articles.

## Current-state observations
- The current homepage is a dark, gold-accented, single-page layout.
- It places currency/gold indicators, world clocks, and a radio directory before the article archive, diluting the publication's editorial identity.
- The archive uses a two-column card grid and exposes long article text in each card, making scanning and browsing harder.
- The navigation and interface copy are Arabic-only, despite the international positioning.
- Social image metadata is blank at the homepage level; article images are optional.
- There is no strong featured-story hierarchy or clear editorial topic navigation.

## Proposed information architecture
- Header: wordmark, latest, topics, archive, about, language switch.
- Hero: one strong editorial statement, concise positioning, latest issue number, primary action to read.
- Featured issue: prominent title, short dek/excerpt, category, date, reading-time estimate, read link.
- Latest notes: compact editorial list/cards with varied hierarchy, not full article bodies.
- Explore by topic: curated topic chips/sections.
- Archive: search, category filters, pagination or progressive loading, and clear empty states.
- About / editorial promise: concise and credible.
- Footer: language, RSS, Facebook, contact/editorial information where verified.
- Optional utilities: market data, clocks, and radio moved below the main editorial experience or into a separate tools page/section. Keep only if they demonstrably support the publication.

## Visual direction
- Keep the recognizable charcoal/ivory/gold heritage, but use gold as an accent rather than a dominant decoration.
- Introduce a warmer paper/ink editorial surface option and strong contrast for reading.
- Use system font stacks and locally available fonts; no paid font dependency.
- Establish consistent spacing, border, radius, type scale, focus, hover, and motion tokens.
- Use CSS-generated decorative details and simple original SVG marks where needed; no stock imagery or remote asset dependency.

## Engineering and release constraints
- Keep the site on Cloudflare Pages and the existing free hosting setup.
- Keep changes isolated on this branch until reviewed.
- Do not alter production KV feed, publishing automation, Facebook posts, account settings, billing, or DNS as part of the visual redesign.
- Preserve Workers/Pages routes and content APIs. Avoid adding dependencies unless absolutely necessary.
- Validate HTML, JavaScript, accessibility basics, RTL/LTR, responsive layouts, metadata, article deep links, feed loading, RSS, and fallback behavior.
- Test at 360px, 390px, 768px, 1024px, and 1440px widths.
- Provide a preview and change summary before merging or switching production.

## Acceptance criteria
- A first-time visitor understands the publication and its value within five seconds.
- A visitor can reach the latest article or archive without scrolling past utility widgets.
- Arabic RTL is polished; English LTR is structurally supported without mirroring mistakes.
- Article text has comfortable line length, line height, contrast, and a focused reading mode.
- The design works on small screens without hidden primary navigation or horizontal overflow.
- All 27 existing posts remain present and unchanged in content.
- Existing feed, RSS, article routes, and publishing workflow continue to work.
- No new recurring cost is introduced.

## Execution order
1. Capture baseline and preserve current production behavior.
2. Implement the editorial shell and responsive design tokens.
3. Redesign homepage hierarchy and article/archive cards.
4. Add language-ready structure without machine-translating published content.
5. Improve article reading pages and social metadata.
6. Accessibility, performance, SEO, and regression checks.
7. Preview review; only then consider production release.
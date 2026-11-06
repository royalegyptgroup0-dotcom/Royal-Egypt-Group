# CEO Notes — isolated blog route

This folder contains the standalone CEO Notes editorial section at `/notes/`.

## Separation
- This route has its own HTML, CSS, and published-post feed.
- It does not use Royal Egypt business listings, forms, lead data, or databases.
- It does not modify the group homepage, navigation, shared styles, Workers, or D1 databases.
- Only approved/published posts belong in `posts.json`. Drafts must never be exposed publicly.

## Published-post feed
`posts.json` contains:

```json
{
  "version": 1,
  "posts": [
    {
      "day": 25,
      "title": "Post title",
      "article": "Full article text",
      "ideaOfTheDay": "One-line takeaway",
      "ceoChallenge": "Practical action",
      "discussionQuestion": "Question for readers",
      "hashtags": ["#CEO_Notes", "#CEO_Challenge"],
      "publishedAt": "2026-11-07"
    }
  ]
}
```

The page reads this file at runtime and displays only published records. The publisher must append/update a post only after the Facebook publication succeeds, then mark the corresponding Google Sheets row as Published. The automation must not publish a Draft twice; use the row reservation step and sequential scenario execution.

## Deployment
Cloudflare Pages serves this directory as a static route. Preview deployments are enabled for branches. Merge to the production branch only after the preview route and the daily publishing workflow are verified.

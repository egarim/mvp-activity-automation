# MVP Activity Portal Automation

Playwright scripts to bulk-fill activities in the [Microsoft MVP Portal](https://mvp.microsoft.com/).

## Setup

```bash
npm install
npx playwright install
```

## Data Sources

### Blog Articles (`articles.json`)

- **Source**: [jocheojeda.com](https://www.jocheojeda.com/) (scraped from WordPress sitemap)
- **Date range**: March 1, 2025 - March 26, 2026
- **Total**: 51 articles
- **Tech Area logic**: AI-related articles (RAG, Copilot, Vibe Coding, MCP Server, etc.) are tagged as **"Microsoft Foundry"**, all others as **".NET"**

### Community Standups (`standups.json`)

- **Source**: [XAFers Community Standup YouTube Playlist](https://www.youtube.com/playlist?list=PLpXYoGWvPdNs9s5jbA7A1hqAq9jYVnxTB) (scraped from YouTube RSS feed)
- **Date range**: March 2025 - March 2026
- **Total**: 9 videos

## Scripts

### `fill-mvp-activities.js` — Blog Articles

Fills blog activities with:

| Field | Value |
|-------|-------|
| Activity Type | Blog |
| Primary Technology Area | Per-article: ".NET" or "Microsoft Foundry" |
| Title | Article title |
| Description | Article title |
| Target Audience | Developer |
| Published Date | Article publish date |
| Role | Author |
| Number of views | 0 |
| Activity URL | Blog post URL |

```bash
node fill-mvp-activities.js
```

### `fill-mvp-standups.js` — Community Standups

Fills webinar activities with:

| Field | Value |
|-------|-------|
| Activity Type | Webinar/Online Training |
| Primary Technology Area | .NET |
| Title | Video title |
| Description | Video title |
| Target Audience | Developer |
| Published Date | Video publish date |
| Role | Host |
| Livestream views | 0 |
| Number of sessions | 1 |
| On-demand views | 0 |
| Activity URL | YouTube video URL |

```bash
node fill-mvp-standups.js
```

## How to Run

1. Run the script (`node fill-mvp-activities.js` or `node fill-mvp-standups.js`)
2. A browser opens to the MVP portal
3. **Log in manually** and navigate to **My Account > Activities**
4. Press **ENTER** in the terminal
5. The script fills each activity automatically

## Resuming After Errors

If the script stops on an error, it shows the index to resume from. Edit the `startFromIndex` value in the CONFIG section at the top of the script:

```js
const CONFIG = {
  // ...
  startFromIndex: 19, // 0-based, so this starts from article 20
};
```

## Known Issues and Fixes Applied

- **Strict mode on "Activities" button**: Uses `{ exact: true }` to avoid matching "My Activities"
- **"Developer" text collision**: When an article title contains "Developer", the Target Audience selector scopes within the label to avoid ambiguity
- **Role dropdown detaching**: Retries up to 3 times if the dropdown element detaches from the DOM
- **Date picker month navigation**: Uses `^Go to previous month` regex to avoid matching "Go to previous year"

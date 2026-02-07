# AI & Programming Course — Telegram Mini App

Bilingual (EN/UK) educational course on AI & Programming, delivered as a Telegram Mini App and static HTML pages.

**Live Mini App:** https://antikriza.github.io/BBD-evolution-code-clone/telegram-archive/course/twa/index.html

## Project Overview

A structured AI course with 42 topics across 5 progressive levels, generated from a single Node.js script (`build-all.js`). The course covers everything from "What is Generative AI" to AGI, alignment, and the future of intelligence.

### Course Structure

| Level | Name (EN) | Name (UK) | Topics | Content Depth |
|-------|-----------|-----------|--------|---------------|
| 1 | Beginner | Novachok | 9 | Rich detail cards with cross-links |
| 2 | User | Korystuvach | 5 | Rich detail cards with cross-links |
| 3 | Professional | Profesional | 5 | Overview + bullet points |
| 4 | Master | Maister | 10 | Overview + bullet points |
| 5 | Horizons | Horyzonty | 13 | Overview + bullet points |

Each topic page includes:
- Multi-paragraph overview
- Key topics with descriptions and cross-links (Level 1-2) or bullet point lists (Level 3-5)
- Named content sections (e.g., "How Generative AI Works", "Impact by Industry")
- Key terms glossary
- Practical tips
- Related community discussion tags
- Previous/Next navigation

## Architecture

```
build-all.js          # Single generator script (~1700 lines)
  |                   #   - All 42 topics with bilingual content
  |                   #   - All UI translations (EN/UK)
  |                   #   - Page generators for each output type
  |
  +---> en/           # 49 English HTML pages (1 course index + 48 topic pages)
  +---> uk/           # 49 Ukrainian HTML pages (same structure)
  +---> index.html    # Language selector (EN/UK entry point)
  +---> twa/
        index.html    # Telegram Mini App (~212KB, single self-contained SPA)
```

### Content Data Format

All content lives in `build-all.js` as JavaScript objects. Every string is bilingual:

```javascript
title: { en: 'Generative AI', uk: 'Генеративний ШІ' }
```

Topic details use two formats:
- **Rich cards** (Level 1-2): `{ text, desc, links: [{ title, href }] }` — rendered as cards with descriptions and clickable cross-link pills
- **Plain strings** (Level 3-5): Simple text strings — rendered as arrow-prefixed list items

## Telegram Mini App (TWA)

The Mini App is a **single self-contained HTML file** with no external dependencies (except the Telegram WebApp SDK from CDN). All course data is embedded as a JSON object.

### Key Features

- **Hash-based SPA routing**: `#/course`, `#/level/:num`, `#/level/:num/:slug`
- **4 views**: Language selector, Course overview, Level detail, Topic detail
- **Instant language switching**: EN/UK toggle, preference saved in `localStorage`
- **Telegram SDK integration**: BackButton, HapticFeedback, theme colors, `disableVerticalSwipes()`
- **Graceful degradation**: Works in regular browser with fallback back-arrow button
- **Cross-links**: Detail card links navigate between topics within the SPA
- **CSS custom properties**: Dark theme defaults, overridden by Telegram theme variables

### Telegram SDK Integration

```
body.tg class         — Applied when running inside Telegram
BackButton            — Show/hide based on navigation depth, onClick -> history.back()
HapticFeedback        — Light impact on card taps
setHeaderColor()      — Matches Telegram's secondary_bg_color
disableVerticalSwipes — Prevents accidental swipe-to-close
Theme CSS vars        — --tg-theme-bg-color, --tg-theme-text-color, etc.
```

All SDK calls are wrapped in try-catch for graceful degradation outside Telegram.

### Link Transformation

At generation time, relative HTML paths are converted to hash routes:
```
../level-2/token.html  -->  #/level/2/token
hallucination.html     -->  #/level/2/hallucination  (same-level)
../level-4/agents.html -->  #/level/4/agents
```

## Development

### Prerequisites

- Node.js (any recent version, no dependencies needed)

### Generate All Pages

```bash
cd telegram-archive/course
node build-all.js
```

Output:
```
Generating English version...
Generating Ukrainian version...
Generating language selector...
Generating Telegram Mini App...

Done! Generated 99 HTML pages total
  en/ - English (48 basic-theory + 1 course index)
  uk/ - Ukrainian (48 basic-theory + 1 course index)
  index.html - Language selector
```

Plus `twa/index.html` (the Mini App).

### Local Testing

```bash
cd telegram-archive/course/twa
python3 -m http.server 8765
# Open http://localhost:8765 in browser
```

### Editing Content

All content is in `build-all.js`:
- **UI translations**: `ui` object (top of file)
- **Course levels**: `levels` array — each level has `num`, `emoji`, `title`, `desc`, and `topics` array
- **Topic structure**: `slug`, `title`, `desc`, `overview`, `details`, `sections`, `keyTerms`, `tips`, `related`

After editing, re-run `node build-all.js` to regenerate all pages.

## Deployment

### GitHub Pages (Current Setup)

The app is deployed via GitHub Pages from the `main` branch:

1. Repo: `antikriza/BBD-evolution-code-clone` (public)
2. GitHub Pages: enabled, source: `main` / `/ (root)`
3. Mini App URL: `https://antikriza.github.io/BBD-evolution-code-clone/telegram-archive/course/twa/index.html`

### Telegram Bot Configuration

In @BotFather:
1. `/mybots` -> select bot
2. **Bot Settings** -> **Menu Button**
3. URL: the GitHub Pages Mini App URL above
4. Button text: e.g., "AI Course"

### Updating the Live App

```bash
# Edit content in build-all.js
node build-all.js          # Regenerate pages
git add -A && git commit -m "Update course content"
git push origin main       # GitHub Pages auto-deploys
```

GitHub Pages rebuilds automatically on push (~1-2 minutes).

## Build Journey

### Phase 1: Course Structure
- Parsed Telegram group archive to extract course topics and structure
- Built initial `index.html` with 15 modules and 68 lessons linked to external KB

### Phase 2: Local Pages Generator
- Created `build-basic-theory.js` to generate 48 local HTML pages
- Replaced all external KB URLs with local page paths

### Phase 3: Bilingual Generator
- Rewrote as `build-all.js` — single script generating EN + UK versions
- All branding removed, all content translated to Ukrainian
- Added language selector entry page

### Phase 4: Content Enrichment
- Expanded all Level 1-3 topics from sparse bullet points to rich educational pages
- Added multi-paragraph overviews, named sections, key terms glossary, practical tips
- Converted Level 1-2 topics to rich detail card format with cross-links between topics

### Phase 5: Telegram Mini App
- Added `generateMiniApp()` function to `build-all.js`
- Transforms all relative links to hash-based SPA routes
- Embeds complete course data as JSON (~200KB)
- Integrates Telegram WebApp SDK with graceful browser fallback
- Deployed to GitHub Pages, configured in BotFather

## File Inventory

| Path | Count | Description |
|------|-------|-------------|
| `build-all.js` | 1 | Generator script with all course data |
| `build-basic-theory.js` | 1 | Legacy single-language generator |
| `index.html` | 1 | Language selector entry point |
| `en/` | 49 | English pages (1 index + 48 topics) |
| `uk/` | 49 | Ukrainian pages (1 index + 48 topics) |
| `basic-theory/` | 48 | Legacy single-language pages |
| `twa/index.html` | 1 | Telegram Mini App (212KB) |
| **Total** | **150** | **HTML + JS files** |

## Technical Notes

- **No build tools needed**: Pure Node.js `fs` module, zero npm dependencies
- **Security**: HTML content is escaped via `esc()` utility; Mini App uses `textContent` + `insertAdjacentHTML` to avoid raw innerHTML
- **Unicode flags**: Emoji flags in JS use escape sequences (e.g., `\ud83c\uddec\ud83c\udde7` for GB)
- **Large file push**: Git may need `http.postBuffer` increased for initial push (`git config http.postBuffer 524288000`)

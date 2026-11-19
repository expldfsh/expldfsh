# How the profile graphics are made

The images in the [profile README](../README.md) are generated from real GitHub data by the
TypeScript scripts in [`scripts/`](../scripts) and refreshed daily by
[`.github/workflows/update-profile.yml`](../.github/workflows/update-profile.yml).
Nothing in them is hand-drawn or made up: every window and every bar maps to a number in
[`data/snapshot.json`](../data/snapshot.json).

```
GitHub GraphQL API ──fetch──▶ data/snapshot.json ──generate──▶ assets/generated/*.svg ──validate──▶ commit
```

Fetching and rendering are separate steps. Rendering is a pure function of the snapshot, so the
same snapshot always produces byte-identical SVGs.

## The night city

| Element | Meaning |
|---|---|
| Building | One calendar week (Sunday–Saturday, like GitHub's contribution graph). Oldest on the left. |
| Window | One day. Rows run Sunday (top) to Saturday (bottom). |
| Window colour | That day's activity level (table below). |
| Building height above the windows | `log(1 + weekly total) / log(1 + busiest week)`, so quiet weeks are low-rise and busy weeks are towers. |
| Crane on the last building | The current week isn't finished; its future days have no windows yet. |

Activity levels use fixed thresholds, so a colour means the same thing every day:

| Level | Contributions that day | Window |
|---|---|---|
| 0 | 0 | unlit |
| 1 | 1 | deep blue |
| 2 | 2–3 | blue |
| 3 | 4–8 | bright blue |
| 4 | 9–29 | moonlight white |
| 5 | 30+ | warm gold, with a glow |

Stars, the moon, the distant skyline, the lattice tower, street lamps, the river and its
reflections are decoration and encode nothing. They are placed with a seeded hash, so the scene
never reshuffles between builds; roofs are keyed by the week's date, so a building keeps its roof as
the year scrolls left.

### Numbers under the skyline

All four come from the contribution calendar for the dates shown on the image.

- **Contributions**: `totalContributions` reported by GitHub for that range. The profile has
  *Include private contributions* turned on, so private work is counted (as anonymous counts, the same
  way the public profile graph shows it).
- **Active days**: days with at least one contribution.
- **Day streak**: consecutive active days ending today. If today has no contributions *yet*, the
  streak is counted up to yesterday instead of being reset.
- **Best day**: the highest single-day count in the range.

## Commit hours

The second image is a 24-column histogram of *when* commits are written.

- **Which commits**: commits authored by me on the default branch of every non-fork repository I own,
  public and private, since the first day of the calendar range. Each commit's `authoredDate` is
  converted to `America/Toronto` and bucketed by hour.
- **Excluded repositories**: listed in `profile.config.json` as SHA-256 hashes of `owner/name`, so
  private repository names never appear in this public repo. One repository whose commits all carry
  the same scripted timestamp is excluded because it would show a false spike. Use
  `npm run hash-repo -- owner/name` to add another.
- **Busiest 4-hour window**: the contiguous 4-hour span (wrapping midnight) with the most commits; ties
  go to the earliest span counted from 06:00.
- **Night share**: the percentage of commits made between 22:00 and 04:59.
- On the chart, the busiest 4-hour window is the soft blue box, and the night hours (22:00–04:59)
  are underlined in magenta with a crescent. The axis starts at 06:00 so the night is one contiguous span.

Only aggregated hour counts are written to the snapshot. No repository names, messages or hashes.

## Setup (one time)

The workflow needs a read-only token that can see private repositories' commit history.

1. GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens →
   Generate new token**.
   - Resource owner: your account
   - Expiration: your choice (the workflow fails loudly when it expires; just regenerate it)
   - Repository access: **All repositories**
   - Permissions → Repository permissions → **Contents: Read-only** (Metadata: Read-only is added automatically)
2. In this repository: **Settings → Secrets and variables → Actions → New repository secret**,
   name `PROFILE_TOKEN`, paste the token.
3. **Actions → Update profile graphics → Run workflow** once to check that it works.

The workflow's job has `contents: write` only to commit the regenerated files. It commits only
when the output actually changed and never touches anything outside `assets/generated/` and
`data/snapshot.json`. If the API fails, the job fails and the previous images stay up; it never
publishes partial or placeholder numbers.

## Local development

Requires Node.js 24 (TypeScript runs directly, no build step).

```bash
npm ci
npm run sample-data && npm run generate:sample   # synthetic data → preview/sample/ (no token needed)
GITHUB_TOKEN=$(gh auth token) npm run fetch      # real data → data/snapshot.json
npm run generate                                 # → assets/generated/
npm run preview                                  # → open preview/index.html
npm run check                                    # type-check, tests, output validation
```

Sample data is labelled `SAMPLE DATA` in red on the image, and `generate` refuses to write it into
`assets/generated/`.

## Known limitations

- **Phones**: each image has a mobile version picked with `<picture><source media="(max-width: 600px)">`.
  This works in browsers; GitHub's mobile *app* may still show the desktop version, which simply scales down.
- **Fonts**: text uses the viewer's monospace system font (SF Mono, Menlo, Consolas, …), so letter
  widths vary slightly between systems.
- **Animation**: twinkling stars, flickering windows and lamps, blinking aircraft lights and drifting
  water are plain CSS inside the SVG. Where SVG animation doesn't run, the image is the same scene,
  just still. `prefers-reduced-motion` turns it off.
- **Commit hours** count only default branches of repositories I own, in one fixed time zone.
- The calendar's date range is whatever GitHub returns for "the last year" (it starts on a Sunday,
  so it covers a little more than 365 days).

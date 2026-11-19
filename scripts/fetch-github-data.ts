/**
 * Fetches real data from the GitHub GraphQL API and writes data/snapshot.json.
 *
 *   PROFILE_TOKEN=... npm run fetch            (CI: fine-grained PAT, read-only)
 *   GITHUB_TOKEN=$(gh auth token) npm run fetch   (local)
 *
 * The snapshot contains only the public contribution calendar (per-day counts, as shown on the
 * profile) and an aggregated 24-bucket commit-hour histogram. No repository names are written.
 */
import { createHash } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { assertSnapshot, fromRoot, loadConfig, serializeSnapshot } from './lib/config.ts';
import { graphql } from './lib/github.ts';
import type { DayCount, Snapshot } from './lib/types.ts';

const out = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1]! : fromRoot('data/snapshot.json');
const token = process.env.PROFILE_TOKEN || process.env.GITHUB_TOKEN;
if (!token) {
  console.error('No token. Set PROFILE_TOKEN (see docs/GENERATOR.md) or, locally, GITHUB_TOKEN=$(gh auth token).');
  process.exit(1);
}

const config = loadConfig();
const excluded = new Set(config.hours.excludeRepoSha256);

interface CalendarResponse {
  user: {
    id: string;
    contributionsCollection: {
      contributionCalendar: { totalContributions: number; weeks: { contributionDays: { date: string; contributionCount: number }[] }[] };
    };
  } | null;
}

const calendarData = await graphql<CalendarResponse>(
  `query($login: String!) {
    user(login: $login) {
      id
      contributionsCollection {
        contributionCalendar { totalContributions weeks { contributionDays { date contributionCount } } }
      }
    }
  }`,
  { login: config.login },
  token,
);
if (!calendarData.user) throw new Error(`User "${config.login}" not found`);
const userId = calendarData.user.id;
const calendar = calendarData.user.contributionsCollection.contributionCalendar;
const days: DayCount[] = calendar.weeks.flatMap((w) => w.contributionDays.map((d) => ({ date: d.date, count: d.contributionCount })));
const startDate = days[0]!.date;
const since = `${startDate}T00:00:00Z`;
const sinceMs = Date.parse(since);

interface RepoPage {
  user: {
    repositories: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      nodes: { nameWithOwner: string; defaultBranchRef: { name: string } | null }[];
    };
  };
}

const repos: string[] = [];
let excludedCount = 0;
for (let after: string | null = null; ; ) {
  const page: RepoPage = await graphql<RepoPage>(
    `query($login: String!, $after: String) {
      user(login: $login) {
        repositories(ownerAffiliations: OWNER, isFork: false, first: 100, after: $after) {
          pageInfo { hasNextPage endCursor }
          nodes { nameWithOwner defaultBranchRef { name } }
        }
      }
    }`,
    { login: config.login, after },
    token,
  );
  for (const r of page.user.repositories.nodes) {
    if (!r.defaultBranchRef) continue; // empty repository
    if (excluded.has(createHash('sha256').update(r.nameWithOwner.toLowerCase()).digest('hex'))) excludedCount++;
    else repos.push(r.nameWithOwner);
  }
  if (!page.user.repositories.pageInfo.hasNextPage) break;
  after = page.user.repositories.pageInfo.endCursor;
}

interface HistoryPage {
  repository: {
    defaultBranchRef: {
      target: { history?: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: { authoredDate: string }[] } };
    } | null;
  } | null;
}

const hourOf = new Intl.DateTimeFormat('en-US', { timeZone: config.timezone, hour: 'numeric', hourCycle: 'h23' });
const histogram = Array<number>(24).fill(0);
let commits = 0;
let contributingRepos = 0;

async function scanRepo(nameWithOwner: string): Promise<void> {
  const [owner, name] = nameWithOwner.split('/');
  let found = 0;
  for (let after: string | null = null; ; ) {
    const page: HistoryPage = await graphql<HistoryPage>(
      `query($owner: String!, $name: String!, $since: GitTimestamp!, $author: ID!, $after: String) {
        repository(owner: $owner, name: $name) {
          defaultBranchRef { target { ... on Commit {
            history(first: 100, since: $since, author: { id: $author }, after: $after) {
              pageInfo { hasNextPage endCursor }
              nodes { authoredDate }
            }
          } } }
        }
      }`,
      { owner, name, since, author: userId, after },
      token!,
    );
    const history = page.repository?.defaultBranchRef?.target.history;
    if (!history) break;
    for (const c of history.nodes) {
      // GitTimestamp keeps the author's original offset, so compare as instants, not strings.
      const at = new Date(c.authoredDate);
      if (at.getTime() < sinceMs) continue;
      const hour = Number(hourOf.formatToParts(at).find((p) => p.type === 'hour')!.value);
      histogram[hour]!++;
      found++;
    }
    if (!history.pageInfo.hasNextPage) break;
    after = history.pageInfo.endCursor;
  }
  commits += found;
  if (found) contributingRepos++;
}

// Small worker pool: polite to the API, still fast.
const queue = [...repos];
await Promise.all(
  Array.from({ length: 4 }, async () => {
    for (let repo = queue.shift(); repo; repo = queue.shift()) await scanRepo(repo);
  }),
);

const snapshot: Snapshot = {
  schemaVersion: 1,
  source: 'github',
  login: config.login,
  calendar: { startDate, endDate: days.at(-1)!.date, totalContributions: calendar.totalContributions, days },
  hours: { timezone: config.timezone, since: startDate, commits, repositories: contributingRepos, excludedRepositories: excludedCount, histogram },
};
assertSnapshot(snapshot);
if (commits === 0) throw new Error('No commits found for the commit-hours chart; refusing to write an empty histogram.');

mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, serializeSnapshot(snapshot));
console.log(
  `Wrote ${path.relative(process.cwd(), out)}: ${days.length} days (${startDate} → ${snapshot.calendar.endDate}), ` +
    `${calendar.totalContributions} contributions; ${commits} commits from ${contributingRepos} repos (${excludedCount} excluded).`,
);

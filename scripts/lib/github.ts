const ENDPOINT = 'https://api.github.com/graphql';
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

export class GitHubError extends Error {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Minimal GraphQL client with retries for network errors, 5xx and rate limiting.
 * The token is only ever placed in the Authorization header and never logged.
 */
export async function graphql<T>(query: string, variables: Record<string, unknown>, token: string, attempts = 4): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    let res: Response;
    try {
      res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'profile-graphics-generator',
        },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(30_000),
      });
    } catch (err) {
      lastError = err;
      await sleep(1000 * 2 ** attempt);
      continue;
    }
    const rateLimited = res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0';
    if (RETRYABLE.has(res.status) || rateLimited) {
      lastError = new GitHubError(`GitHub API responded ${res.status}`);
      const retryAfter = Number(res.headers.get('retry-after'));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** attempt);
      continue;
    }
    if (res.status === 401) throw new GitHubError('GitHub API rejected the token (401). Check that PROFILE_TOKEN is set and not expired.');
    if (!res.ok) throw new GitHubError(`GitHub API responded ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
    if (json.errors?.length) throw new GitHubError(`GraphQL error: ${json.errors.map((e) => e.message).join('; ')}`);
    if (!json.data) throw new GitHubError('GraphQL response had no data');
    return json.data;
  }
  throw new GitHubError(`GitHub API request failed after ${attempts} attempts: ${String(lastError)}`);
}

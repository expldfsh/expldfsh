/** Prints the hash to put in profile.config.json → hours.excludeRepoSha256 (keeps private repo names out of the repo). */
import { createHash } from 'node:crypto';

const repo = process.argv[2];
if (!repo || !repo.includes('/')) {
  console.error('Usage: npm run hash-repo -- owner/name');
  process.exit(1);
}
console.log(createHash('sha256').update(repo.toLowerCase()).digest('hex'));

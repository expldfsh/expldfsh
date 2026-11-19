export interface DayCount {
  /** Calendar date, YYYY-MM-DD, exactly as GitHub's contribution calendar reports it. */
  date: string;
  count: number;
}

export interface HoursData {
  /** IANA time zone the hour buckets are expressed in. */
  timezone: string;
  /** Commits authored on or after this date are counted (same start as the calendar). */
  since: string;
  /** Number of commits in the histogram. */
  commits: number;
  /** Repositories that contributed at least one counted commit. */
  repositories: number;
  /** Repositories skipped because they are listed in profile.config.json. */
  excludedRepositories: number;
  /** 24 buckets, index = hour of day (0-23) in `timezone`. */
  histogram: number[];
}

export interface Snapshot {
  schemaVersion: 1;
  /** "sample" snapshots are synthetic and must never be published. */
  source: 'github' | 'sample';
  login: string;
  calendar: {
    startDate: string;
    endDate: string;
    totalContributions: number;
    days: DayCount[];
  };
  hours: HoursData;
}

export interface ProfileConfig {
  login: string;
  timezone: string;
  website: string;
  hours: {
    /** sha256("owner/name") of repositories to leave out of the commit-hours chart. */
    excludeRepoSha256: string[];
  };
}

"use client";

import { apiLeaderboard, LeaderboardEntry } from "../../lib/api";
import LeaderboardTable from "../../components/LeaderboardTable";
import { useCachedFetch } from "../../lib/cache";

export default function LeaderboardPage() {
  const currentYear = new Date().getFullYear();
  const { data: entries, loading, isStale } = useCachedFetch<LeaderboardEntry[]>(
    "leaderboard",
    apiLeaderboard
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Leaderboard — {currentYear}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Only locked teams are shown. Click a team to expand its roster.
          </p>
        </div>
        {isStale && entries && (
          <span className="mt-1 shrink-0 text-xs text-gray-400 dark:text-gray-500">
            Syncing…
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />
          ))}
        </div>
      ) : !entries ? (
        <p className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-500 dark:border-gray-700">
          Could not load leaderboard. The server may be starting up — please refresh in a moment.
        </p>
      ) : entries.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-500 dark:border-gray-700">
          No locked teams yet. Be the first to{" "}
          <a href="/draft" className="text-blue-600 hover:underline dark:text-blue-400">
            submit your draft
          </a>
          !
        </p>
      ) : (
        <LeaderboardTable entries={entries} />
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiLeagueLeaderboard, apiMyLeagues, League, LeaderboardEntry } from "../lib/api";
import { useAuth } from "../lib/auth";

interface LeagueWithStandings {
  league: League;
  entries: LeaderboardEntry[];
}

export default function LeagueStandingsWidget() {
  const { token, isAuthenticated } = useAuth();
  const [data, setData] = useState<LeagueWithStandings[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      setLoading(false);
      return;
    }
    async function load() {
      try {
        const leagues = await apiMyLeagues(token!);
        if (leagues.length === 0) {
          setData([]);
          return;
        }
        const results = await Promise.all(
          leagues.map(async (league) => {
            const entries = await apiLeagueLeaderboard(league.id).catch(() => []);
            return { league, entries };
          })
        );
        setData(results.filter((r) => r.entries.length > 0));
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [isAuthenticated, token]);

  if (!isAuthenticated || loading || data.length === 0) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">🏅 My leagues</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.map(({ league, entries }) => (
          <LeagueCard key={league.id} league={league} entries={entries} />
        ))}
      </div>
    </section>
  );
}

function LeagueCard({ league, entries }: { league: League; entries: LeaderboardEntry[] }) {
  const preview = entries.slice(0, 5);

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <div>
          <div className="font-semibold text-gray-900 dark:text-white">{league.name}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {league.member_count} member{league.member_count !== 1 ? "s" : ""}
          </div>
        </div>
        <Link
          href={`/leagues/${league.id}`}
          className="text-xs text-blue-600 hover:underline dark:text-blue-400 shrink-0"
        >
          Full standings →
        </Link>
      </div>
      <table className="w-full text-sm">
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {preview.map((entry, i) => (
            <tr key={entry.id} className={i === 0 ? "bg-yellow-50 dark:bg-yellow-950/20" : "bg-white dark:bg-gray-900"}>
              <td className="w-8 px-3 py-2 font-bold text-gray-400 text-center">{i + 1}</td>
              <td className="px-3 py-2">
                <div className="font-medium text-gray-900 dark:text-white truncate">{entry.name}</div>
                <div className="text-xs text-gray-500 truncate">{entry.username}</div>
              </td>
              <td className="px-3 py-2 text-right font-bold text-yellow-600 dark:text-yellow-400 tabular-nums">
                {entry.total_score.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

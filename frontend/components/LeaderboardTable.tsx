"use client";

import { useState } from "react";
import { apiPublicTeam, FantasyTeam, LeaderboardEntry, Rider } from "../lib/api";
import RiderTooltip from "./RiderTooltip";

interface Props {
  entries: LeaderboardEntry[];
}

function RankBadge({ i }: { i: number }) {
  if (i === 0) return <span className="text-lg">🥇</span>;
  if (i === 1) return <span className="text-lg">🥈</span>;
  if (i === 2) return <span className="text-lg">🥉</span>;
  return <span className="font-bold text-gray-400">{i + 1}</span>;
}

function TeamExpansion({ team }: { team: FantasyTeam }) {
  const sorted = [...team.riders].sort(
    (a, b) => b.current_year_points - a.current_year_points
  );
  const budgetPct = Math.min(100, (team.total_cost / 20_000) * 100);

  return (
    <tr>
      <td colSpan={5} className="bg-gray-50 px-4 pb-4 pt-0 dark:bg-gray-800/50">
        {/* Stats row */}
        <div className="mb-3 grid grid-cols-3 gap-3 pt-3">
          <div className="rounded-lg border border-gray-200 bg-white p-3 text-center dark:border-gray-700 dark:bg-gray-900">
            <div className="text-xl font-bold text-yellow-600 dark:text-yellow-400">
              {team.total_score.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Total score</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3 text-center dark:border-gray-700 dark:bg-gray-900">
            <div className="text-xl font-bold text-gray-900 dark:text-white">
              {team.rider_count} / 20
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Riders</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3 text-center dark:border-gray-700 dark:bg-gray-900">
            <div className="text-xl font-bold text-gray-900 dark:text-white">
              {team.total_cost.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Budget / 20,000</div>
          </div>
        </div>

        {/* Budget bar */}
        <div className="mb-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className="h-1.5 rounded-full bg-yellow-400"
              style={{ width: `${budgetPct}%` }}
            />
          </div>
        </div>

        {/* Rider table */}
        <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 dark:bg-gray-800">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-gray-500 dark:text-gray-400">#</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-500 dark:text-gray-400">Rider</th>
                <th className="hidden px-3 py-2 text-left font-semibold text-gray-500 dark:text-gray-400 sm:table-cell">
                  Team
                </th>
                <th className="hidden px-3 py-2 text-right font-semibold text-gray-500 dark:text-gray-400 sm:table-cell">
                  Cost
                </th>
                <th className="px-3 py-2 text-right font-semibold text-gray-500 dark:text-gray-400">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {sorted.map((rider: Rider, idx: number) => (
                <tr key={rider.id} className="bg-white dark:bg-gray-900">
                  <td className="px-3 py-2 text-gray-400">{idx + 1}</td>
                  <td className="px-3 py-2">
                    <RiderTooltip rider={rider}>
                      <div className="font-medium text-gray-900 dark:text-white">{rider.name}</div>
                      <div className="text-xs text-gray-500 sm:hidden">{rider.team}</div>
                    </RiderTooltip>
                  </td>
                  <td className="hidden px-3 py-2 text-gray-600 dark:text-gray-400 sm:table-cell">
                    {rider.team}
                  </td>
                  <td className="hidden px-3 py-2 text-right text-gray-600 dark:text-gray-400 sm:table-cell">
                    {rider.prev_year_points.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-yellow-600 dark:text-yellow-400">
                    {rider.current_year_points.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </td>
    </tr>
  );
}

export default function LeaderboardTable({ entries }: Props) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [teamCache, setTeamCache] = useState<Record<number, FantasyTeam>>({});
  const [loading, setLoading] = useState<number | null>(null);

  async function handleRowClick(entry: LeaderboardEntry) {
    if (expandedId === entry.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(entry.id);
    if (teamCache[entry.id]) return;
    setLoading(entry.id);
    try {
      const team = await apiPublicTeam(entry.id);
      setTeamCache((prev) => ({ ...prev, [entry.id]: team }));
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
      <table className="w-full text-sm">
        <thead className="bg-gray-100 dark:bg-gray-800">
          <tr>
            <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400">#</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400">Team</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400">Manager</th>
            <th className="hidden px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-400 sm:table-cell">
              Riders
            </th>
            <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-400">Score</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {entries.map((entry: LeaderboardEntry, i: number) => {
            const isExpanded = expandedId === entry.id;
            const isLoading = loading === entry.id;
            const team = teamCache[entry.id];

            return (
              <>
                <tr
                  key={entry.id}
                  onClick={() => handleRowClick(entry)}
                  className={`cursor-pointer transition-colors ${
                    i === 0 ? "bg-yellow-50 dark:bg-yellow-950/20" : "bg-white dark:bg-gray-900"
                  } hover:bg-gray-50 dark:hover:bg-gray-800`}
                >
                  <td className="px-4 py-3">
                    <RankBadge i={i} />
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                    <span className="flex items-center gap-2">
                      {entry.name}
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {isExpanded ? "▲" : "▼"}
                      </span>
                      {isLoading && (
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-yellow-400" />
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{entry.username}</td>
                  <td className="hidden px-4 py-3 text-right text-gray-600 dark:text-gray-400 sm:table-cell">
                    {entry.rider_count} / 20
                  </td>
                  <td className="px-4 py-3 text-right text-lg font-bold text-yellow-600 dark:text-yellow-400">
                    {entry.total_score.toLocaleString()}
                  </td>
                </tr>
                {isExpanded && team && <TeamExpansion key={`${entry.id}-detail`} team={team} />}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

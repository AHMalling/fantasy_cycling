"use client";

import { useEffect, useState } from "react";
import { apiLeaderboard, apiPublicTeam, FantasyTeam, LeaderboardEntry, Rider } from "../../lib/api";
import RiderAvatar from "../../components/RiderAvatar";
import RiderTooltip from "../../components/RiderTooltip";

function ScoreDelta({ a, b }: { a: number; b: number }) {
  const delta = a - b;
  if (delta === 0) return <span className="text-gray-500">Tied</span>;
  const sign = delta > 0 ? "+" : "";
  const color = delta > 0 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400";
  return <span className={`font-bold ${color}`}>{sign}{delta.toLocaleString()} pts</span>;
}

function RiderRow({
  rider,
  inA,
  inB,
}: {
  rider: Rider;
  inA: boolean;
  inB: boolean;
}) {
  const isShared = inA && inB;
  return (
    <tr className={`border-b border-gray-100 dark:border-gray-800 ${isShared ? "bg-blue-50 dark:bg-blue-950/20" : "bg-white dark:bg-gray-900"}`}>
      <td className="px-3 py-2.5">
        <RiderTooltip rider={rider}>
          <div className="flex items-center gap-2">
            <RiderAvatar name={rider.name} photoUrl={rider.photo_url} size={24} />
            <div>
              <div className="font-medium text-gray-900 dark:text-white">{rider.name}</div>
              <div className="text-xs text-gray-500">{rider.team}</div>
            </div>
          </div>
        </RiderTooltip>
      </td>
      <td className="px-3 py-2.5 text-center">
        {inA ? (
          <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300">
            ✓
          </span>
        ) : (
          <span className="text-gray-300 dark:text-gray-700">—</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-center">
        {inB ? (
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
            ✓
          </span>
        ) : (
          <span className="text-gray-300 dark:text-gray-700">—</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-right font-semibold text-yellow-600 dark:text-yellow-400">
        {rider.current_year_points.toLocaleString()}
      </td>
      <td className="hidden px-3 py-2.5 text-right text-gray-500 dark:text-gray-400 sm:table-cell">
        {rider.prev_year_points.toLocaleString()}
      </td>
    </tr>
  );
}

export default function ComparePage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);

  const [teamAId, setTeamAId] = useState<string>("");
  const [teamBId, setTeamBId] = useState<string>("");
  const [teamA, setTeamA] = useState<FantasyTeam | null>(null);
  const [teamB, setTeamB] = useState<FantasyTeam | null>(null);
  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);
  const [errorA, setErrorA] = useState("");
  const [errorB, setErrorB] = useState("");

  useEffect(() => {
    apiLeaderboard()
      .then(setEntries)
      .catch(() => {})
      .finally(() => setLoadingEntries(false));
  }, []);

  async function selectTeamA(id: string) {
    setTeamAId(id);
    setTeamA(null);
    setErrorA("");
    if (!id) return;
    setLoadingA(true);
    try {
      setTeamA(await apiPublicTeam(Number(id)));
    } catch {
      setErrorA("Could not load team.");
    } finally {
      setLoadingA(false);
    }
  }

  async function selectTeamB(id: string) {
    setTeamBId(id);
    setTeamB(null);
    setErrorB("");
    if (!id) return;
    setLoadingB(true);
    try {
      setTeamB(await apiPublicTeam(Number(id)));
    } catch {
      setErrorB("Could not load team.");
    } finally {
      setLoadingB(false);
    }
  }

  // Compute sets once both teams are loaded
  const riderSetA = new Set(teamA?.riders.map((r) => r.id) ?? []);
  const riderSetB = new Set(teamB?.riders.map((r) => r.id) ?? []);

  // Union of all riders, deduplicated
  const allRiders: Rider[] = [];
  const seen = new Set<number>();
  for (const r of [...(teamA?.riders ?? []), ...(teamB?.riders ?? [])]) {
    if (!seen.has(r.id)) {
      seen.add(r.id);
      allRiders.push(r);
    }
  }

  const sharedRiders = allRiders.filter((r) => riderSetA.has(r.id) && riderSetB.has(r.id));
  const onlyA = allRiders.filter((r) => riderSetA.has(r.id) && !riderSetB.has(r.id));
  const onlyB = allRiders.filter((r) => !riderSetA.has(r.id) && riderSetB.has(r.id));

  // Sort each group by score desc
  const byScore = (a: Rider, b: Rider) => b.current_year_points - a.current_year_points;
  sharedRiders.sort(byScore);
  onlyA.sort(byScore);
  onlyB.sort(byScore);

  const hasComparison = teamA && teamB;

  const selectClass =
    "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 dark:border-gray-700 dark:bg-gray-800 dark:text-white";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Head-to-Head Comparison</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Compare any two locked teams side by side.
        </p>
      </div>

      {/* Team selectors */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Team A</label>
          {loadingEntries ? (
            <div className="h-10 w-48 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
          ) : (
            <select
              value={teamAId}
              onChange={(e) => selectTeamA(e.target.value)}
              className={`${selectClass} w-52`}
            >
              <option value="">Select a team…</option>
              {entries.map((e) => (
                <option key={e.id} value={String(e.id)} disabled={String(e.id) === teamBId}>
                  {e.name} ({e.username})
                </option>
              ))}
            </select>
          )}
          {errorA && <p className="text-xs text-red-500">{errorA}</p>}
        </div>

        <span className="mt-5 text-lg font-bold text-gray-400">vs</span>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Team B</label>
          {loadingEntries ? (
            <div className="h-10 w-48 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
          ) : (
            <select
              value={teamBId}
              onChange={(e) => selectTeamB(e.target.value)}
              className={`${selectClass} w-52`}
            >
              <option value="">Select a team…</option>
              {entries.map((e) => (
                <option key={e.id} value={String(e.id)} disabled={String(e.id) === teamAId}>
                  {e.name} ({e.username})
                </option>
              ))}
            </select>
          )}
          {errorB && <p className="text-xs text-red-500">{errorB}</p>}
        </div>

        {(loadingA || loadingB) && (
          <span className="mt-5 h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-yellow-400" />
        )}
      </div>

      {entries.length === 0 && !loadingEntries && (
        <p className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 dark:border-gray-700">
          No locked teams yet — nothing to compare.
        </p>
      )}

      {/* Score summary */}
      {hasComparison && (
        <>
          <div className="grid grid-cols-3 gap-4">
            {/* Team A score */}
            <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-center dark:border-yellow-900/40 dark:bg-yellow-950/20">
              <div className="truncate text-sm font-semibold text-gray-700 dark:text-gray-300">{teamA.name}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{teamA.username}</div>
              <div className="mt-2 text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                {teamA.total_score.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500">pts</div>
            </div>

            {/* Delta */}
            <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">Difference</div>
              <ScoreDelta a={teamA.total_score} b={teamB.total_score} />
              <div className="mt-3 text-xs text-gray-400 dark:text-gray-500">
                {sharedRiders.length} shared rider{sharedRiders.length !== 1 ? "s" : ""}
              </div>
            </div>

            {/* Team B score */}
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-center dark:border-blue-900/40 dark:bg-blue-950/20">
              <div className="truncate text-sm font-semibold text-gray-700 dark:text-gray-300">{teamB.name}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{teamB.username}</div>
              <div className="mt-2 text-3xl font-bold text-blue-600 dark:text-blue-400">
                {teamB.total_score.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500">pts</div>
            </div>
          </div>

          {/* Roster comparison table */}
          <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 dark:bg-gray-800">
                <tr>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-600 dark:text-gray-400">Rider</th>
                  <th className="px-3 py-2.5 text-center font-semibold text-yellow-700 dark:text-yellow-400">
                    {teamA.name.length > 12 ? "Team A" : teamA.name}
                  </th>
                  <th className="px-3 py-2.5 text-center font-semibold text-blue-700 dark:text-blue-400">
                    {teamB.name.length > 12 ? "Team B" : teamB.name}
                  </th>
                  <th className="px-3 py-2.5 text-right font-semibold text-gray-600 dark:text-gray-400">Score</th>
                  <th className="hidden px-3 py-2.5 text-right font-semibold text-gray-600 dark:text-gray-400 sm:table-cell">Cost</th>
                </tr>
              </thead>
              <tbody>
                {sharedRiders.length > 0 && (
                  <>
                    <tr className="bg-blue-100/60 dark:bg-blue-900/20">
                      <td colSpan={5} className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-400">
                        Shared ({sharedRiders.length})
                      </td>
                    </tr>
                    {sharedRiders.map((r) => (
                      <RiderRow key={r.id} rider={r} inA={true} inB={true} />
                    ))}
                  </>
                )}

                {onlyA.length > 0 && (
                  <>
                    <tr className="bg-yellow-100/60 dark:bg-yellow-900/20">
                      <td colSpan={5} className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-yellow-700 dark:text-yellow-400">
                        Only in {teamA.name.length > 16 ? "Team A" : teamA.name} ({onlyA.length})
                      </td>
                    </tr>
                    {onlyA.map((r) => (
                      <RiderRow key={r.id} rider={r} inA={true} inB={false} />
                    ))}
                  </>
                )}

                {onlyB.length > 0 && (
                  <>
                    <tr className="bg-blue-50 dark:bg-blue-950/10">
                      <td colSpan={5} className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
                        Only in {teamB.name.length > 16 ? "Team B" : teamB.name} ({onlyB.length})
                      </td>
                    </tr>
                    {onlyB.map((r) => (
                      <RiderRow key={r.id} rider={r} inA={false} inB={true} />
                    ))}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

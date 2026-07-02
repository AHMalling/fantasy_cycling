export const revalidate = 1800; // Vercel CDN: re-fetch from backend at most every 30 min

import Link from "next/link";
import { notFound } from "next/navigation";
import { apiPublicTeam, apiTeamRaceBreakdown, apiTeamSnapshots, RaceBreakdown, Rider } from "../../../lib/api";
import RiderAvatar from "../../../components/RiderAvatar";
import RiderTooltip from "../../../components/RiderTooltip";
import ScoreChart from "../../../components/ScoreChart";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getTeamData(id: string) {
  const numId = Number(id);
  try {
    const [team, snapshots, raceBreakdown] = await Promise.all([
      apiPublicTeam(numId),
      apiTeamSnapshots(numId).catch(() => []),
      apiTeamRaceBreakdown(numId).catch(() => []),
    ]);
    return { team, snapshots, raceBreakdown };
  } catch {
    return null;
  }
}

export default async function TeamDetailPage({ params }: PageProps) {
  const { id } = await params;
  const data = await getTeamData(id);

  if (!data) notFound();

  const { team, snapshots, raceBreakdown } = data;

  const sortedRiders = [...team.riders].sort(
    (a, b) => b.current_year_points - a.current_year_points
  );

  const budgetPct = Math.min(100, (team.total_cost / 20_000) * 100);

  // Weekly score delta: diff current score against the most recent snapshot
  // at least 7 days old, falling back to the oldest snapshot before today.
  const today = new Date().toISOString().slice(0, 10);
  const cutoff = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
  const reference =
    [...snapshots].reverse().find((s) => s.date <= cutoff) ??
    snapshots.find((s) => s.date < today);
  const weekDelta = reference ? team.total_score - reference.total_score : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{team.name}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manager:{" "}
            <span className="font-medium text-gray-700 dark:text-gray-300">{team.username}</span>
            {" · "}
            {team.year} season
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800 dark:bg-green-950 dark:text-green-300">
          🔒 Locked
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center dark:border-gray-800 dark:bg-gray-900">
          <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
            {team.total_score.toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">Total score</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center dark:border-gray-800 dark:bg-gray-900">
          <div
            className={`text-2xl font-bold ${
              weekDelta != null && weekDelta > 0
                ? "text-green-600 dark:text-green-400"
                : "text-gray-900 dark:text-white"
            }`}
          >
            {weekDelta == null
              ? "—"
              : weekDelta >= 0
                ? `+${weekDelta.toLocaleString()}`
                : weekDelta.toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {reference ? `Since ${reference.date}` : "This week"}
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center dark:border-gray-800 dark:bg-gray-900">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {team.rider_count} / 20
          </div>
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">Riders</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center dark:border-gray-800 dark:bg-gray-900">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {team.total_cost.toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">Budget used / 20,000</div>
        </div>
      </div>

      {/* Budget bar */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>Budget usage</span>
          <span>{budgetPct.toFixed(1)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className="h-2 rounded-full bg-yellow-400"
            style={{ width: `${budgetPct}%` }}
          />
        </div>
      </div>

      {/* Score history chart */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
          Score history
        </h2>
        <ScoreChart snapshots={snapshots} />
        {snapshots.length >= 2 && (
          <p className="mt-1 text-center text-xs text-gray-400 dark:text-gray-500">
            Hover data points for details · Updated daily
          </p>
        )}
      </div>

      {/* Roster */}
      <div>
        <h2 className="mb-3 text-lg font-bold text-gray-900 dark:text-white">Roster</h2>
        <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400">#</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400">Rider</th>
                <th className="hidden px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400 sm:table-cell">
                  Team
                </th>
                <th className="hidden px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-400 sm:table-cell">
                  Cost
                </th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-400">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {sortedRiders.map((rider: Rider, i: number) => (
                <tr key={rider.id} className="bg-white dark:bg-gray-900">
                  <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                  <td className="px-4 py-3">
                    <RiderTooltip rider={rider}>
                      <div className="flex items-center gap-2">
                        <RiderAvatar name={rider.name} photoUrl={rider.photo_url} size={28} />
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">{rider.name}</div>
                          <div className="text-xs text-gray-500 sm:hidden">{rider.team}</div>
                        </div>
                      </div>
                    </RiderTooltip>
                  </td>
                  <td className="hidden px-4 py-3 text-gray-600 dark:text-gray-400 sm:table-cell">
                    {rider.team}
                  </td>
                  <td className="hidden px-4 py-3 text-right text-gray-600 dark:text-gray-400 sm:table-cell">
                    {rider.prev_year_points.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-yellow-600 dark:text-yellow-400">
                    {rider.current_year_points.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Race breakdown */}
      <div>
        <h2 className="mb-3 text-lg font-bold text-gray-900 dark:text-white">Race breakdown</h2>
        {raceBreakdown.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700">
            No race result data yet.{" "}
            <code className="rounded bg-gray-100 px-1 text-xs dark:bg-gray-800">
              python manage.py sync_results
            </code>{" "}
            to populate it.
          </p>
        ) : (
          <div className="space-y-2">
            {raceBreakdown.map((race: RaceBreakdown, i: number) => (
              <RaceRow key={i} race={race} />
            ))}
          </div>
        )}
      </div>

      {/* Back links */}
      <div className="flex gap-4 text-sm">
        <Link href="/leaderboard" className="text-blue-600 hover:underline dark:text-blue-400">
          ← Leaderboard
        </Link>
      </div>
    </div>
  );
}

function RaceRow({ race }: { race: RaceBreakdown }) {
  const raceLink = race.race_url
    ? `https://www.procyclingstats.com/${race.race_url}`
    : null;

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      {/* Race header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          {raceLink ? (
            <a
              href={raceLink}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-gray-900 hover:underline dark:text-white"
            >
              {race.race_name}
            </a>
          ) : (
            <span className="font-semibold text-gray-900 dark:text-white">{race.race_name}</span>
          )}
          <span className="ml-2 text-xs text-gray-400">{race.date}</span>
        </div>
        <span className="shrink-0 text-lg font-bold text-yellow-600 dark:text-yellow-400">
          +{race.team_points.toLocaleString()} pts
        </span>
      </div>

      {/* Riders in this race */}
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {race.riders
          .slice()
          .sort((a, b) => b.uci_points - a.uci_points)
          .map((r, i) => (
            <div
              key={i}
              className="flex items-center justify-between px-4 py-2 text-sm"
            >
              <span className="text-gray-700 dark:text-gray-300">
                {r.rank != null && (
                  <span className="mr-2 text-xs text-gray-400">#{r.rank}</span>
                )}
                {r.name}
              </span>
              <span className="font-semibold text-yellow-600 dark:text-yellow-400">
                +{r.uci_points.toLocaleString()}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}

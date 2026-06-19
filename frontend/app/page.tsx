import Link from "next/link";
import { apiLeaderboard, apiTopPerformers, LeaderboardEntry, Rider } from "../lib/api";
import { performancePct, performanceCellStyle } from "../lib/performance";
import LeagueStandingsWidget from "../components/LeagueStandingsWidget";

async function getData(): Promise<{ topPerformers: Rider[]; leaderboard: LeaderboardEntry[] }> {
  const [topPerformers, leaderboard] = await Promise.all([
    apiTopPerformers(8).catch(() => []),
    apiLeaderboard().catch(() => []),
  ]);
  return {
    topPerformers,
    leaderboard: leaderboard.slice(0, 5),
  };
}


export default async function Home() {
  const { topPerformers, leaderboard } = await getData();
  const currentYear = new Date().getFullYear();

  return (
    <div className="space-y-16">
      {/* Hero */}
      <section className="py-12 text-center">
        <h1 className="text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white">
          Fantasy Cycling <span className="text-yellow-400">{currentYear}</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-xl text-gray-500 dark:text-gray-400">
          Pick a team of 20 real pro riders within a 20,000 UCI point budget. The team that racks
          up the most UCI points across the season wins.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Link
            href="/draft"
            className="rounded-xl bg-yellow-400 px-6 py-3 font-bold text-gray-900 shadow hover:bg-yellow-300"
          >
            Draft your team
          </Link>
          <Link
            href="/riders"
            className="rounded-xl border border-gray-300 px-6 py-3 font-semibold text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Browse riders
          </Link>
        </div>
      </section>

      <LeagueStandingsWidget />

      <div className="grid gap-8 md:grid-cols-2">
        {/* Leaderboard preview */}
        <section>
          <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">
            🏆 Leaderboard
          </h2>
          {leaderboard.length === 0 ? (
            <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-gray-500 dark:border-gray-700">
              No locked teams yet. Be the first to submit your draft!
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-2 text-left text-gray-600 dark:text-gray-400">#</th>
                    <th className="px-4 py-2 text-left text-gray-600 dark:text-gray-400">Team</th>
                    <th className="px-4 py-2 text-right text-gray-600 dark:text-gray-400">Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {leaderboard.map((entry, i) => (
                    <tr key={entry.id} className="bg-white dark:bg-gray-900">
                      <td className="px-4 py-2 font-bold text-gray-400">{i + 1}</td>
                      <td className="px-4 py-2">
                        <div className="font-medium text-gray-900 dark:text-white">{entry.name}</div>
                        <div className="text-xs text-gray-500">{entry.username}</div>
                      </td>
                      <td className="px-4 py-2 text-right font-bold text-yellow-600 dark:text-yellow-400">
                        {entry.total_score.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Link href="/leaderboard" className="mt-2 block text-sm text-blue-600 hover:underline dark:text-blue-400">
            Full leaderboard →
          </Link>
        </section>

        {/* Top performers */}
        <section>
          <h2 className="mb-1 text-xl font-bold text-gray-900 dark:text-white">
            🔥 Top Performers
          </h2>
          <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
            Ranked by this season&apos;s score as % of last season&apos;s cost
          </p>
          {topPerformers.length === 0 ? (
            <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-gray-500 dark:border-gray-700">
              No rider data yet. Run{" "}
              <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">
                python manage.py sync_riders
              </code>{" "}
              to import riders.
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-2 text-left text-gray-600 dark:text-gray-400">Rider</th>
                    <th className="px-4 py-2 text-right text-gray-600 dark:text-gray-400">Cost</th>
                    <th className="px-4 py-2 text-right text-gray-600 dark:text-gray-400">Score</th>
                    <th className="px-4 py-2 text-right text-gray-600 dark:text-gray-400">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {topPerformers.map((rider) => {
                    const pct = performancePct(rider.current_year_points, rider.prev_year_points) ?? 0;
                    return (
                      <tr key={rider.id} className="bg-white dark:bg-gray-900">
                        <td className="px-4 py-2">
                          <div className="font-medium text-gray-900 dark:text-white">{rider.name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{rider.team}</div>
                        </td>
                        <td className="px-4 py-2 text-right text-gray-600 dark:text-gray-400">
                          {rider.prev_year_points.toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-700 dark:text-gray-300">
                          {rider.current_year_points.toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-right font-bold" style={performanceCellStyle(pct)}>
                          {pct}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <Link href="/riders" className="mt-2 block text-sm text-blue-600 hover:underline dark:text-blue-400">
            All riders →
          </Link>
        </section>
      </div>

      {/* Rules */}
      <section className="rounded-2xl border border-yellow-200 bg-yellow-50 p-6 dark:border-yellow-900 dark:bg-yellow-950/30">
        <h2 className="mb-3 text-lg font-bold text-gray-900 dark:text-white">How it works</h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-300">
          <li>Pick up to 20 professional riders for your team.</li>
          <li>Each rider costs their previous season UCI points — stay within the 20,000 point budget.</li>
          <li>Lock your team to submit it. Teams cannot be changed once locked.</li>
          <li>Throughout the season your riders earn current-season UCI points — that&apos;s your score.</li>
          <li>At the end of the season, the team with the most points wins the yellow jersey.</li>
        </ol>
      </section>
    </div>
  );
}

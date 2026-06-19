export const revalidate = 1800;

import { apiOwnership, apiRiders, Rider } from "../../lib/api";
import RiderAvatar from "../../components/RiderAvatar";
import RiderTooltip from "../../components/RiderTooltip";
import AutoRefresh from "../../components/AutoRefresh";
import { performancePct, performanceCellStyle } from "../../lib/performance";

interface PageProps {
  searchParams: Promise<{ search?: string; team?: string; nationality?: string; ordering?: string; page?: string }>;
}

async function getRiders(params: { search?: string; team?: string; nationality?: string; ordering?: string; page?: number }) {
  try {
    return await apiRiders(params);
  } catch {
    return null;
  }
}

type SortCol = "name" | "cost" | "score";

function SortLink({
  col,
  label,
  currentOrdering,
  buildUrl,
  className,
}: {
  col: SortCol;
  label: string;
  currentOrdering: string;
  buildUrl: (overrides: Record<string, string | number>) => string;
  className?: string;
}) {
  const isDesc = currentOrdering === `-${col}`;
  const isAsc = currentOrdering === col;
  const isActive = isDesc || isAsc;
  const nextOrdering = isActive && isDesc ? col : `-${col}`;
  return (
    <th className={className}>
      <a
        href={buildUrl({ ordering: nextOrdering, page: 1 })}
        className="inline-flex items-center gap-1 hover:text-gray-900 dark:hover:text-white"
      >
        {label}
        {isActive && <span className="text-yellow-500">{isDesc ? "↓" : "↑"}</span>}
      </a>
    </th>
  );
}

export default async function RidersPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const search = sp.search ?? "";
  const team = sp.team ?? "";
  const nationality = sp.nationality ?? "";
  const ordering = sp.ordering ?? "-cost";
  const page = Number(sp.page ?? 1);

  const [data, ownershipData] = await Promise.all([
    getRiders({ search, team, nationality, ordering, page }),
    apiOwnership().catch(() => null),
  ]);

  function buildUrl(overrides: Record<string, string | number>) {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (team) params.set("team", team);
    if (nationality) params.set("nationality", nationality);
    if (ordering) params.set("ordering", ordering);
    params.set("page", String(page));
    Object.entries(overrides).forEach(([k, v]) => params.set(k, String(v)));
    return `/riders?${params}`;
  }

  const totalTeams = ownershipData?.total_teams ?? 0;

  return (
    <div className="space-y-6">
      <AutoRefresh intervalMs={5000} />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Riders</h1>
        <div className="flex items-center gap-3">
          {totalTeams > 0 && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              Ownership across {totalTeams} locked team{totalTeams !== 1 ? "s" : ""}
            </span>
          )}
          {data && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {data.count.toLocaleString()} riders
            </span>
          )}
        </div>
      </div>

      {/* Filters */}
      <form method="get" className="flex flex-wrap gap-2">
        <input
          name="search"
          defaultValue={search}
          placeholder="Search by name…"
          className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
        />
        <input
          name="team"
          defaultValue={team}
          placeholder="Filter by team…"
          className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
        />
        <input
          name="nationality"
          defaultValue={nationality}
          placeholder="Nationality…"
          className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
        />
        {/* Preserve ordering through form submit */}
        {ordering && <input type="hidden" name="ordering" value={ordering} />}
        <button
          type="submit"
          className="rounded-lg bg-yellow-400 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-yellow-300"
        >
          Search
        </button>
        {(search || team || nationality) && (
          <a
            href="/riders"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            Clear
          </a>
        )}
      </form>

      {!data ? (
        <p className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-500 dark:border-gray-700">
          Could not load riders. Make sure the backend is running.
        </p>
      ) : data.results.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-500 dark:border-gray-700">
          No riders found. Run{" "}
          <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">
            python manage.py sync_riders
          </code>{" "}
          to import riders from ProCyclingStats.
        </p>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 text-left font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                <tr>
                  <SortLink col="name" label="Rider" currentOrdering={ordering} buildUrl={buildUrl} className="px-4 py-3" />
                  <th className="hidden px-4 py-3 md:table-cell">Team</th>
                  <th className="hidden px-4 py-3 sm:table-cell">Nat.</th>
                  <SortLink col="cost" label="Cost (prev yr)" currentOrdering={ordering} buildUrl={buildUrl} className="px-4 py-3 text-right" />
                  <SortLink col="score" label="Score (this yr)" currentOrdering={ordering} buildUrl={buildUrl} className="px-4 py-3 text-right" />
                  <th className="px-4 py-3 text-right">%</th>
                  {totalTeams > 0 && <th className="hidden px-4 py-3 text-right md:table-cell">Owned</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {data.results.map((rider: Rider) => {
                  const pct = performancePct(rider.current_year_points, rider.prev_year_points);
                  const ownedCount = ownershipData?.ownership[String(rider.id)] ?? 0;
                  return (
                    <tr key={rider.id} className="bg-white hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800">
                      <td className="px-4 py-3">
                        <RiderTooltip rider={rider}>
                          <div className="flex items-center gap-2">
                            <RiderAvatar name={rider.name} photoUrl={rider.photo_url} size={28} />
                            <div>
                              <div className="font-medium text-gray-900 dark:text-white">{rider.name}</div>
                              <div className="mt-0.5 text-xs text-gray-500 md:hidden">{rider.team}</div>
                            </div>
                          </div>
                        </RiderTooltip>
                      </td>
                      <td className="hidden px-4 py-3 text-gray-600 dark:text-gray-400 md:table-cell">{rider.team}</td>
                      <td className="hidden px-4 py-3 text-gray-600 dark:text-gray-400 sm:table-cell">{rider.nationality}</td>
                      <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                        {rider.prev_year_points.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-yellow-600 dark:text-yellow-400">
                        {rider.current_year_points.toLocaleString()}
                      </td>
                      <td
                        className="px-4 py-3 text-right font-bold"
                        style={pct !== null ? performanceCellStyle(pct) : undefined}
                      >
                        {pct !== null ? `${pct}%` : "—"}
                      </td>
                      {totalTeams > 0 && (
                        <td className="hidden px-4 py-3 text-right text-xs text-gray-500 dark:text-gray-400 md:table-cell">
                          {ownedCount > 0 ? `${ownedCount}/${totalTeams}` : "—"}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">
              Page {page} of {Math.ceil(data.count / 50)}
            </span>
            <div className="flex gap-2">
              {data.previous && (
                <a
                  href={buildUrl({ page: page - 1 })}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  ← Previous
                </a>
              )}
              {data.next && (
                <a
                  href={buildUrl({ page: page + 1 })}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  Next →
                </a>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

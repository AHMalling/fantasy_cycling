"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  apiCreateTeam,
  apiLockTeam,
  apiMyTeams,
  apiOwnership,
  apiRiders,
  apiUpdateTeam,
  FantasyTeam,
  OwnershipData,
  Rider,
} from "../../lib/api";
import { useAuth } from "../../lib/auth";
import RiderAvatar from "../../components/RiderAvatar";
import RiderTooltip from "../../components/RiderTooltip";

const BUDGET_CAP = 20_000;
const MAX_RIDERS = 20;

type SortKey = "name" | "-name" | "cost" | "-cost" | "score" | "-score";

function SortTh({
  col,
  label,
  current,
  onSort,
  className,
}: {
  col: "name" | "cost" | "score";
  label: string;
  current: SortKey;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const isActive = current === col || current === `-${col}`;
  const isDesc = current === `-${col}`;
  function handleClick() {
    if (isActive) {
      onSort(isDesc ? col : (`-${col}` as SortKey));
    } else {
      onSort(`-${col}` as SortKey);
    }
  }
  return (
    <th
      className={`cursor-pointer select-none px-3 py-2 font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white ${className ?? ""}`}
      onClick={handleClick}
    >
      {label}
      {isActive && <span className="ml-1 text-yellow-500">{isDesc ? "↓" : "↑"}</span>}
    </th>
  );
}

export default function DraftPage() {
  const { token, isAuthenticated } = useAuth();
  const router = useRouter();

  const [myTeam, setMyTeam] = useState<FantasyTeam | null>(null);
  const [selected, setSelected] = useState<Rider[]>([]);
  const [teamName, setTeamName] = useState("My Team");
  const [riders, setRiders] = useState<Rider[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);

  // Filter state
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [teamFilterInput, setTeamFilterInput] = useState("");
  const [nationalityFilter, setNationalityFilter] = useState("");
  const [nationalityFilterInput, setNationalityFilterInput] = useState("");

  // Sort state
  const [sortOrdering, setSortOrdering] = useState<SortKey>("-cost");

  // Ownership
  const [ownership, setOwnership] = useState<OwnershipData | null>(null);

  const [loadingRiders, setLoadingRiders] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locking, setLocking] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const totalCost = selected.reduce((s, r) => s + r.prev_year_points, 0);
  const remaining = BUDGET_CAP - totalCost;
  const isLocked = myTeam?.is_locked ?? false;

  function debounce(key: string, fn: () => void, delay = 350) {
    if (debounceRef.current[key]) clearTimeout(debounceRef.current[key]);
    debounceRef.current[key] = setTimeout(fn, delay);
  }

  // Redirect if not logged in
  useEffect(() => {
    if (!isAuthenticated) router.push("/login");
  }, [isAuthenticated, router]);

  // Load existing team
  useEffect(() => {
    if (!token) return;
    apiMyTeams(token).then((res) => {
      const team = res.results[0] ?? null;
      setMyTeam(team);
      if (team) {
        setTeamName(team.name);
        setSelected(team.riders);
      }
    });
  }, [token]);

  // Load ownership stats
  useEffect(() => {
    apiOwnership().then(setOwnership).catch(() => {});
  }, []);

  // Load riders
  const loadRiders = useCallback(
    async (params: {
      search: string;
      teamFilter: string;
      nationalityFilter: string;
      ordering: SortKey;
      page: number;
    }) => {
      setLoadingRiders(true);
      try {
        const res = await apiRiders({
          search: params.search,
          team: params.teamFilter,
          nationality: params.nationalityFilter,
          ordering: params.ordering,
          page: params.page,
        });
        setRiders(res.results);
        setTotalCount(res.count);
      } finally {
        setLoadingRiders(false);
      }
    },
    []
  );

  useEffect(() => {
    loadRiders({ search, teamFilter, nationalityFilter, ordering: sortOrdering, page });
  }, [search, teamFilter, nationalityFilter, sortOrdering, page, loadRiders]);

  function handleSearchInput(val: string) {
    setSearchInput(val);
    debounce("search", () => { setSearch(val); setPage(1); });
  }

  function handleTeamFilterInput(val: string) {
    setTeamFilterInput(val);
    debounce("team", () => { setTeamFilter(val); setPage(1); });
  }

  function handleNationalityFilterInput(val: string) {
    setNationalityFilterInput(val);
    debounce("nat", () => { setNationalityFilter(val); setPage(1); });
  }

  function handleSort(key: SortKey) {
    setSortOrdering(key);
    setPage(1);
  }

  function toggleRider(rider: Rider) {
    if (isLocked) return;
    setSelected((prev) => {
      const isSelected = prev.some((r) => r.id === rider.id);
      if (isSelected) return prev.filter((r) => r.id !== rider.id);
      if (prev.length >= MAX_RIDERS) {
        setError(`Max ${MAX_RIDERS} riders allowed.`);
        return prev;
      }
      const newCost = totalCost + rider.prev_year_points;
      if (newCost > BUDGET_CAP) {
        setError(`Budget exceeded: adding ${rider.name} would cost ${newCost.toLocaleString()} pts.`);
        return prev;
      }
      setError("");
      return [...prev, rider];
    });
  }

  async function handleSave() {
    if (!token) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const ids = selected.map((r) => r.id);
      let updated: FantasyTeam;
      if (myTeam) {
        updated = await apiUpdateTeam(token, myTeam.id, teamName, ids);
      } else {
        updated = await apiCreateTeam(token, teamName, ids);
      }
      setMyTeam(updated);
      setSelected(updated.riders);
      setSuccess("Team saved!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handleLock() {
    if (!token || !myTeam) return;
    if (!confirm("Lock your team? This cannot be undone — your roster will be fixed for the season.")) return;
    setLocking(true);
    setError("");
    try {
      const updated = await apiLockTeam(token, myTeam.id);
      setMyTeam(updated);
      setSuccess("Team locked! Good luck this season 🚴");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lock failed.");
    } finally {
      setLocking(false);
    }
  }

  if (!isAuthenticated) return null;

  const totalPages = Math.ceil(totalCount / 50);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Draft your team</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Pick up to {MAX_RIDERS} riders within a {BUDGET_CAP.toLocaleString()} point budget.
          </p>
        </div>
        {isLocked && (
          <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800 dark:bg-green-950 dark:text-green-300">
            🔒 Team locked
          </span>
        )}
      </div>

      {/* Budget bar */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-gray-700 dark:text-gray-300">
            Budget:{" "}
            <span className={remaining < 0 ? "text-red-600" : "text-gray-900 dark:text-white"}>
              {totalCost.toLocaleString()}
            </span>{" "}
            / {BUDGET_CAP.toLocaleString()} pts
          </span>
          <span className="text-gray-500 dark:text-gray-400">
            {selected.length} / {MAX_RIDERS} riders
          </span>
          <span className={`font-semibold ${remaining < 2000 ? "text-orange-600" : "text-green-600"}`}>
            {remaining.toLocaleString()} pts remaining
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className={`h-2 rounded-full transition-all ${remaining < 0 ? "bg-red-500" : remaining < 2000 ? "bg-orange-400" : "bg-green-500"}`}
            style={{ width: `${Math.min(100, (totalCost / BUDGET_CAP) * 100)}%` }}
          />
        </div>
      </div>

      {(error || success) && (
        <div
          className={`rounded-lg border px-4 py-2 text-sm ${
            error
              ? "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
              : "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300"
          }`}
        >
          {error || success}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Rider picker */}
        <div className="lg:col-span-2 space-y-3">
          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <input
              value={searchInput}
              onChange={(e) => handleSearchInput(e.target.value)}
              placeholder="Search by name…"
              className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
            <input
              value={teamFilterInput}
              onChange={(e) => handleTeamFilterInput(e.target.value)}
              placeholder="Filter by team…"
              className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
            <input
              value={nationalityFilterInput}
              onChange={(e) => handleNationalityFilterInput(e.target.value)}
              placeholder="Nationality…"
              className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
            {(search || teamFilter || nationalityFilter) && (
              <button
                onClick={() => {
                  setSearch(""); setSearchInput("");
                  setTeamFilter(""); setTeamFilterInput("");
                  setNationalityFilter(""); setNationalityFilterInput("");
                  setPage(1);
                }}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                Clear
              </button>
            )}
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 dark:bg-gray-800">
                <tr>
                  <SortTh col="name" label="Rider" current={sortOrdering} onSort={handleSort} className="text-left" />
                  <th className="hidden px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-400 sm:table-cell">
                    Team
                  </th>
                  <SortTh col="cost" label="Cost" current={sortOrdering} onSort={handleSort} className="text-right" />
                  <SortTh col="score" label="Score" current={sortOrdering} onSort={handleSort} className="text-right" />
                  {ownership && ownership.total_teams > 0 && (
                    <th className="hidden px-3 py-2 text-right font-semibold text-gray-600 dark:text-gray-400 md:table-cell">
                      Owned
                    </th>
                  )}
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {loadingRiders
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i} className="bg-white dark:bg-gray-900">
                        <td colSpan={6} className="px-3 py-3">
                          <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                        </td>
                      </tr>
                    ))
                  : riders.map((rider) => {
                      const isSelected = selected.some((r) => r.id === rider.id);
                      const wouldExceed = !isSelected && totalCost + rider.prev_year_points > BUDGET_CAP;
                      const wouldExceedCount = !isSelected && selected.length >= MAX_RIDERS;
                      const cannotAdd = wouldExceed || wouldExceedCount;
                      const ownedCount = ownership?.ownership[String(rider.id)] ?? 0;
                      const totalTeams = ownership?.total_teams ?? 0;

                      return (
                        <tr
                          key={rider.id}
                          className={`transition-colors ${
                            isSelected ? "bg-yellow-50 dark:bg-yellow-950/20" : "bg-white dark:bg-gray-900"
                          } ${isLocked ? "" : "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"}`}
                          onClick={() => !isLocked && toggleRider(rider)}
                        >
                          <td className="px-3 py-2.5">
                            <RiderTooltip rider={rider}>
                              <div className="flex items-center gap-2">
                                <RiderAvatar name={rider.name} photoUrl={rider.photo_url} size={26} />
                                <div>
                                  <div className="font-medium text-gray-900 dark:text-white">{rider.name}</div>
                                  <div className="text-xs text-gray-500 sm:hidden">{rider.team}</div>
                                </div>
                              </div>
                            </RiderTooltip>
                          </td>
                          <td className="hidden px-3 py-2.5 text-gray-600 dark:text-gray-400 sm:table-cell">
                            {rider.team}
                          </td>
                          <td
                            className={`px-3 py-2.5 text-right ${
                              cannotAdd && !isSelected ? "text-gray-400" : "text-gray-700 dark:text-gray-300"
                            }`}
                          >
                            {rider.prev_year_points.toLocaleString()}
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold text-yellow-600 dark:text-yellow-400">
                            {rider.current_year_points.toLocaleString()}
                          </td>
                          {ownership && totalTeams > 0 && (
                            <td className="hidden px-3 py-2.5 text-right text-xs text-gray-500 dark:text-gray-400 md:table-cell">
                              {ownedCount > 0 ? `${ownedCount}/${totalTeams}` : "—"}
                            </td>
                          )}
                          <td className="px-3 py-2.5 text-right">
                            {!isLocked && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleRider(rider);
                                }}
                                disabled={cannotAdd && !isSelected}
                                className={`rounded px-2 py-0.5 text-xs font-semibold ${
                                  isSelected
                                    ? "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-950 dark:text-red-300"
                                    : cannotAdd
                                    ? "cursor-not-allowed bg-gray-100 text-gray-400 dark:bg-gray-800"
                                    : "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900 dark:text-yellow-300"
                                }`}
                              >
                                {isSelected ? "Remove" : "Add"}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                {page > 1 && (
                  <button
                    onClick={() => setPage((p) => p - 1)}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
                  >
                    ← Prev
                  </button>
                )}
                {page < totalPages && (
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
                  >
                    Next →
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* My team panel */}
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-3 font-bold text-gray-900 dark:text-white">Your team</h2>

            {!isLocked && (
              <input
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Team name"
                className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-yellow-400 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            )}

            {selected.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-400">No riders selected yet.</p>
            ) : (
              <ul className="mb-3 max-h-[400px] space-y-1 overflow-y-auto">
                {selected.map((rider) => (
                  <li
                    key={rider.id}
                    className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <RiderTooltip rider={rider}>
                      <div className="flex items-center gap-2">
                        <RiderAvatar name={rider.name} photoUrl={rider.photo_url} size={24} />
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">{rider.name}</div>
                          <div className="text-xs text-gray-500">{rider.prev_year_points.toLocaleString()} pts</div>
                        </div>
                      </div>
                    </RiderTooltip>
                    {!isLocked && (
                      <button
                        onClick={() => toggleRider(rider)}
                        className="ml-2 text-gray-400 hover:text-red-500"
                        aria-label="Remove"
                      >
                        ✕
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {!isLocked && (
              <div className="space-y-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full rounded-lg border border-gray-300 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  {saving ? "Saving…" : "Save draft"}
                </button>
                <button
                  onClick={handleLock}
                  disabled={locking || !myTeam || selected.length === 0}
                  className="w-full rounded-lg bg-yellow-400 py-2 text-sm font-bold text-gray-900 hover:bg-yellow-300 disabled:opacity-50"
                >
                  {locking ? "Locking…" : "🔒 Lock & submit team"}
                </button>
              </div>
            )}

            {isLocked && (
              <div className="mt-2 space-y-1 text-center text-sm text-gray-500 dark:text-gray-400">
                <p>Your team is locked for the {myTeam?.year} season.</p>
                <div className="flex justify-center gap-4">
                  <Link href={`/teams/${myTeam?.id}`} className="text-blue-600 hover:underline dark:text-blue-400">
                    View team overview →
                  </Link>
                  <Link href="/leaderboard" className="text-blue-600 hover:underline dark:text-blue-400">
                    Leaderboard →
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

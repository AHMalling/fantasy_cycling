"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiRiderDetails, Rider, RiderDetails } from "../lib/api";
import RiderAvatar from "./RiderAvatar";

const PCS_BASE = "https://www.procyclingstats.com";
const TOOLTIP_W = 300;
const OFFSET = 14;
const FETCH_DELAY_MS = 400;

// Module-level cache so details survive re-renders and page navigation.
// Bump the key suffix if the response shape changes.
const detailsCache = new Map<number, RiderDetails>();

interface Props {
  rider: Rider;
  children: React.ReactNode;
}

function rankLabel(rank: number | null): string {
  if (rank === null) return "—";
  if (rank === 1) return "1st";
  if (rank === 2) return "2nd";
  if (rank === 3) return "3rd";
  return `${rank}th`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const [, m, d] = iso.split("-");
  return `${d}.${m}`;
}

export default function RiderTooltip({ rider, children }: Props) {
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);
  const [details, setDetails] = useState<RiderDetails | null>(
    detailsCache.get(rider.id) ?? null
  );
  const [loading, setLoading] = useState(false);
  const fetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pcsHref = rider.pcs_url ? `${PCS_BASE}/${rider.pcs_url}` : null;

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setCoords({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMouseEnter = useCallback(() => {
    if (detailsCache.has(rider.id)) return;
    fetchTimer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await apiRiderDetails(rider.id);
        detailsCache.set(rider.id, data);
        setDetails(data);
      } catch {
        // Silently fail — tooltip still shows basic info
      } finally {
        setLoading(false);
      }
    }, FETCH_DELAY_MS);
  }, [rider.id]);

  const handleMouseLeave = useCallback(() => {
    setCoords(null);
    if (fetchTimer.current) {
      clearTimeout(fetchTimer.current);
      fetchTimer.current = null;
    }
  }, []);

  useEffect(() => {
    if (!coords) return;
    const close = () => setCoords(null);
    window.addEventListener("scroll", close, { passive: true });
    return () => window.removeEventListener("scroll", close);
  }, [coords]);

  let left = 0;
  let top = 0;
  if (coords) {
    left = coords.x + OFFSET;
    top = coords.y + OFFSET;
    if (left + TOOLTIP_W > window.innerWidth - 8) left = coords.x - TOOLTIP_W - OFFSET;
    if (top + 340 > window.innerHeight - 8) top = coords.y - 340 - OFFSET;
  }

  return (
    <span
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="cursor-default"
    >
      {children}
      {coords && (
        <div
          style={{ position: "fixed", left, top, width: TOOLTIP_W, zIndex: 9999 }}
          className="rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900"
          onMouseEnter={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 pt-3 pb-2">
            <RiderAvatar name={rider.name} photoUrl={rider.photo_url} size={44} />
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">{rider.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{rider.team}</p>
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 border-y border-gray-100 dark:border-gray-800">
            <div className="px-3 py-2 text-center">
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">Nat.</div>
              <div className="text-sm font-bold text-gray-800 dark:text-gray-200">{rider.nationality || "—"}</div>
            </div>
            <div className="border-x border-gray-100 px-3 py-2 text-center dark:border-gray-800">
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">Cost</div>
              <div className="text-sm font-bold text-gray-800 dark:text-gray-200">{rider.prev_year_points.toLocaleString()}</div>
            </div>
            <div className="px-3 py-2 text-center">
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">Score</div>
              <div className="text-sm font-bold text-yellow-600 dark:text-yellow-400">{rider.current_year_points.toLocaleString()}</div>
            </div>
          </div>

          {/* Details section */}
          <div className="px-3 py-2 space-y-3">
            {loading && (
              <div className="flex items-center justify-center py-3 gap-2 text-xs text-gray-400">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-yellow-400" />
                Loading race data…
              </div>
            )}

            {!loading && details && (
              <>
                {/* Recent results with UCI points */}
                {details.recent_results.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                      Last UCI points
                    </p>
                    <ul className="space-y-0.5">
                      {details.recent_results.map((r, i) => (
                        <li key={i} className="flex items-center justify-between text-xs">
                          <span className="text-gray-400 w-8 shrink-0">{formatDate(r.date)}</span>
                          <span className="flex-1 truncate px-1.5 text-gray-700 dark:text-gray-300">
                            {r.race_name}
                          </span>
                          <span className={`w-8 text-right font-semibold shrink-0 ${r.rank === 1 ? "text-yellow-500" : r.rank !== null && r.rank <= 3 ? "text-gray-500" : "text-gray-400"}`}>
                            {rankLabel(r.rank)}
                          </span>
                          <span className="w-10 text-right font-semibold text-yellow-600 dark:text-yellow-400 shrink-0">+{r.uci_points}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Upcoming races */}
                {details.upcoming_races.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                      Upcoming
                    </p>
                    <ul className="space-y-0.5">
                      {details.upcoming_races.map((r, i) => (
                        <li key={i} className="flex items-center gap-1.5 text-xs">
                          <span className="text-gray-400 w-8 shrink-0">{formatDate(r.date)}</span>
                          <span className="flex-1 truncate text-gray-700 dark:text-gray-300">{r.race_name}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {details.recent_results.length === 0 && details.upcoming_races.length === 0 && (
                  <p className="py-1 text-center text-xs text-gray-400">No race data available</p>
                )}
              </>
            )}
          </div>

          {/* PCS link */}
          {pcsHref && (
            <div className="border-t border-gray-100 px-4 py-2 dark:border-gray-800">
              <a
                href={pcsHref}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                onClick={(e) => e.stopPropagation()}
              >
                View on ProCyclingStats →
              </a>
            </div>
          )}
        </div>
      )}
    </span>
  );
}

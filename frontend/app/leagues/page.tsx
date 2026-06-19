"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiCreateLeague, apiJoinLeague, apiMyLeagues, League } from "../../lib/api";
import { useAuth } from "../../lib/auth";

export default function LeaguesPage() {
  const { token, isAuthenticated } = useAuth();
  const router = useRouter();

  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);

  // Create form
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Join form
  const [inviteCode, setInviteCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [joinSuccess, setJoinSuccess] = useState("");

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    if (!token) return;
    apiMyLeagues(token)
      .then(setLeagues)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isAuthenticated, token, router]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !newName.trim()) return;
    setCreating(true);
    setCreateError("");
    try {
      const league = await apiCreateLeague(token, newName.trim());
      setLeagues((prev) => [league, ...prev]);
      setNewName("");
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create league.");
    } finally {
      setCreating(false);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !inviteCode.trim()) return;
    setJoining(true);
    setJoinError("");
    setJoinSuccess("");
    try {
      const league = await apiJoinLeague(token, inviteCode.trim());
      setLeagues((prev) => {
        if (prev.some((l) => l.id === league.id)) return prev;
        return [league, ...prev];
      });
      setInviteCode("");
      setJoinSuccess(`Joined "${league.name}"!`);
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : "Failed to join league.");
    } finally {
      setJoining(false);
    }
  }

  if (!isAuthenticated) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Mini-leagues</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Compete in private groups with friends. Share your invite code to let others join.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Create */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-3 font-semibold text-gray-900 dark:text-white">Create a league</h2>
          <form onSubmit={handleCreate} className="space-y-3">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="League name…"
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
            {createError && <p className="text-xs text-red-500">{createError}</p>}
            <button
              type="submit"
              disabled={creating || !newName.trim()}
              className="w-full rounded-lg bg-yellow-400 py-2 text-sm font-bold text-gray-900 hover:bg-yellow-300 disabled:opacity-50"
            >
              {creating ? "Creating…" : "Create league"}
            </button>
          </form>
        </div>

        {/* Join */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-3 font-semibold text-gray-900 dark:text-white">Join a league</h2>
          <form onSubmit={handleJoin} className="space-y-3">
            <input
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="Paste invite code…"
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
            {joinError && <p className="text-xs text-red-500">{joinError}</p>}
            {joinSuccess && <p className="text-xs text-green-600 dark:text-green-400">{joinSuccess}</p>}
            <button
              type="submit"
              disabled={joining || !inviteCode.trim()}
              className="w-full rounded-lg border border-gray-300 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              {joining ? "Joining…" : "Join league"}
            </button>
          </form>
        </div>
      </div>

      {/* My leagues */}
      <div>
        <h2 className="mb-3 text-lg font-bold text-gray-900 dark:text-white">My leagues</h2>
        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />
            ))}
          </div>
        ) : leagues.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 dark:border-gray-700">
            You haven&apos;t joined any leagues yet. Create one or ask a friend for an invite code.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400">League</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-400">Created by</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-400">Members</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-400"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {leagues.map((league) => (
                  <tr key={league.id} className="bg-white dark:bg-gray-900">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      {league.name}
                      <div className="font-mono text-xs text-gray-400">{league.year} season</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {league.created_by_username}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                      {league.member_count}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/leagues/${league.id}`}
                        className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export const revalidate = 1800;

import { notFound } from "next/navigation";
import Link from "next/link";
import { apiLeagueDetail, apiLeagueLeaderboard } from "../../../lib/api";
import LeaderboardTable from "../../../components/LeaderboardTable";
import CopyButton from "../../../components/CopyButton";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getLeagueData(id: string) {
  try {
    const [league, entries] = await Promise.all([
      apiLeagueDetail(Number(id)),
      apiLeagueLeaderboard(Number(id)),
    ]);
    return { league, entries };
  } catch {
    return null;
  }
}

export default async function LeagueDetailPage({ params }: PageProps) {
  const { id } = await params;
  const data = await getLeagueData(id);

  if (!data) notFound();

  const { league, entries } = data;

  // Build the invite link (works both on server and client render)
  const inviteCode = league.invite_code;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{league.name}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Created by{" "}
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {league.created_by_username}
            </span>
            {" · "}
            {league.year} season
            {" · "}
            {league.member_count} member{league.member_count !== 1 ? "s" : ""}
          </p>
        </div>
        <Link
          href="/leagues"
          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          ← My leagues
        </Link>
      </div>

      {/* Invite code card */}
      <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900/40 dark:bg-yellow-950/20">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-yellow-700 dark:text-yellow-400">
          Invite code
        </p>
        <div className="flex items-center gap-3">
          <code className="flex-1 rounded-lg border border-yellow-300 bg-white px-3 py-2 font-mono text-sm tracking-widest text-gray-800 dark:border-yellow-800 dark:bg-gray-900 dark:text-white">
            {inviteCode}
          </code>
          <CopyButton text={inviteCode} label="Copy code" />
        </div>
        <p className="mt-2 text-xs text-yellow-700 dark:text-yellow-500">
          Share this code with friends — they can join at{" "}
          <Link href="/leagues" className="underline">
            /leagues
          </Link>
          .
        </p>
      </div>

      {/* Leaderboard */}
      <div>
        <h2 className="mb-3 text-lg font-bold text-gray-900 dark:text-white">
          League standings
        </h2>
        {entries.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 dark:border-gray-700">
            No locked teams from league members yet.
          </p>
        ) : (
          <LeaderboardTable entries={entries} />
        )}
      </div>
    </div>
  );
}

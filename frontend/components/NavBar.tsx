"use client";

import Link from "next/link";
import { useAuth } from "../lib/auth";

export default function NavBar() {
  const { user, isAuthenticated, logout } = useAuth();

  async function handleLogout() {
    await logout();
    window.location.href = "/";
  }

  return (
    <nav className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-bold text-gray-900 dark:text-white">
          <span className="text-2xl">🚴</span>
          <span>Fantasy Cycling</span>
        </Link>

        <div className="flex items-center gap-6 text-sm">
          <Link href="/riders" className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
            Riders
          </Link>
          <Link href="/leaderboard" className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
            Leaderboard
          </Link>
          <Link href="/compare" className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
            Compare
          </Link>
          <Link href="/leagues" className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
            Leagues
          </Link>

          {isAuthenticated ? (
            <>
              <Link href="/draft" className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
                My Team
              </Link>
              <span className="text-gray-400 dark:text-gray-600">|</span>
              <span className="text-gray-700 dark:text-gray-300">{user?.username}</span>
              <button
                onClick={handleLogout}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-yellow-400 px-4 py-1.5 font-semibold text-gray-900 hover:bg-yellow-300"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

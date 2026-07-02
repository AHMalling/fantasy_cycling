const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface Rider {
  id: number;
  name: string;
  team: string;
  nationality: string;
  prev_year_points: number;
  current_year_points: number;
  pcs_url: string;
  photo_url: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
}

export interface FantasyTeam {
  id: number;
  name: string;
  year: number;
  is_locked: boolean;
  total_cost: number;
  total_score: number;
  rider_count: number;
  riders: Rider[];
  username: string;
  created_at: string;
}

export interface LeaderboardEntry {
  id: number;
  name: string;
  username: string;
  total_score: number;
  total_cost: number;
  rider_count: number;
  year: number;
  score_delta: number | null;
  rank_delta: number | null;
  delta_since: string | null;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

function authHeaders(token?: string): HeadersInit {
  return token ? { Authorization: `Token ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { cache: "no-store", ...options });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? JSON.stringify(body) ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// Auth
export async function apiRegister(username: string, email: string, password: string) {
  return request<{ token: string; user: User }>("/api/auth/register/", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ username, email, password }),
  });
}

export async function apiLogin(username: string, password: string) {
  return request<{ token: string; user: User }>("/api/auth/login/", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ username, password }),
  });
}

export async function apiLogout(token: string) {
  return request<void>("/api/auth/logout/", {
    method: "POST",
    headers: authHeaders(token),
  });
}

export async function apiMe(token: string) {
  return request<User>("/api/auth/me/", { headers: authHeaders(token) });
}

// Riders
export async function apiRiders(params: { search?: string; team?: string; nationality?: string; ordering?: string; page?: number } = {}) {
  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  if (params.team) qs.set("team", params.team);
  if (params.nationality) qs.set("nationality", params.nationality);
  if (params.ordering) qs.set("ordering", params.ordering);
  if (params.page) qs.set("page", String(params.page));
  return request<PaginatedResponse<Rider>>(`/api/riders/?${qs}`);
}

export interface OwnershipData {
  total_teams: number;
  ownership: Record<string, number>; // rider_id -> count of teams
}

export async function apiOwnership(year?: number) {
  const qs = year ? `?year=${year}` : "";
  return request<OwnershipData>(`/api/riders/ownership/${qs}`);
}

// Fantasy Teams
export async function apiMyTeams(token: string) {
  return request<PaginatedResponse<FantasyTeam>>("/api/teams/", { headers: authHeaders(token) });
}

export async function apiCreateTeam(token: string, name: string, riderIds: number[]) {
  return request<FantasyTeam>("/api/teams/", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ name, rider_ids: riderIds }),
  });
}

export async function apiUpdateTeam(token: string, id: number, name: string, riderIds: number[]) {
  return request<FantasyTeam>(`/api/teams/${id}/`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify({ name, rider_ids: riderIds }),
  });
}

export async function apiLockTeam(token: string, id: number) {
  return request<FantasyTeam>(`/api/teams/${id}/lock/`, {
    method: "POST",
    headers: authHeaders(token),
  });
}

export interface RiderResult {
  date: string | null;
  rank: number | null;
  race_name: string | null;
  race_url: string | null;
  uci_points: number;
  category: string | null;
}

export interface UpcomingRace {
  date: string | null;
  race_name: string | null;
  race_url: string | null;
}

export interface RiderDetails {
  recent_results: RiderResult[];
  upcoming_races: UpcomingRace[];
}

export async function apiTopPerformers(n = 10) {
  return request<Rider[]>(`/api/riders/top-performers/?n=${n}`);
}

export async function apiRiderDetails(id: number) {
  return request<RiderDetails>(`/api/riders/${id}/details/`);
}

// Public team detail (locked teams only)
export async function apiPublicTeam(id: number) {
  return request<FantasyTeam>(`/api/teams/${id}/public/`);
}

// Score history snapshots
export interface Snapshot {
  date: string;
  total_score: number;
  rank: number | null;
}

export async function apiTeamSnapshots(id: number) {
  return request<Snapshot[]>(`/api/teams/${id}/snapshots/`);
}

// Race breakdown
export interface RaceBreakdownRider {
  name: string;
  uci_points: number;
  rank: number | null;
}

export interface RaceBreakdown {
  date: string;
  race_name: string;
  race_url: string;
  team_points: number;
  riders: RaceBreakdownRider[];
}

export async function apiTeamRaceBreakdown(id: number) {
  return request<RaceBreakdown[]>(`/api/teams/${id}/race-breakdown/`);
}

// Leagues
export interface League {
  id: number;
  name: string;
  invite_code: string;
  created_by_username: string;
  member_count: number;
  is_member: boolean;
  year: number;
  created_at: string;
}

export async function apiMyLeagues(token: string) {
  const data = await request<PaginatedResponse<League>>("/api/leagues/", { headers: authHeaders(token) });
  return data.results;
}

export async function apiCreateLeague(token: string, name: string) {
  return request<League>("/api/leagues/", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ name }),
  });
}

export async function apiJoinLeague(token: string, invite_code: string) {
  return request<League>("/api/leagues/join/", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ invite_code }),
  });
}

export async function apiLeagueDetail(id: number) {
  return request<League>(`/api/leagues/${id}/`);
}

export async function apiLeagueLeaderboard(id: number) {
  return request<LeaderboardEntry[]>(`/api/leagues/${id}/leaderboard/`);
}

// Leaderboard
export async function apiLeaderboard(year?: number) {
  const qs = year ? `?year=${year}` : "";
  return request<LeaderboardEntry[]>(`/api/leaderboard/${qs}`);
}

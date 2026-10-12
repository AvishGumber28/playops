const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export interface ApiErrorShape {
  statusCode: number;
  path: string;
  timestamp: string;
  message: string | string[];
}

export class ApiError extends Error {
  statusCode: number;
  constructor(shape: ApiErrorShape) {
    super(Array.isArray(shape.message) ? shape.message.join(', ') : shape.message);
    this.statusCode = shape.statusCode;
  }
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data: unknown = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(data as ApiErrorShape);
  }
  return data as T;
}

// ---- Shapes matching docs/api-contract.md exactly ----

export interface SignupInput {
  name: string;
  email: string;
  password: string;
  // D-012: self-reported, optional. photoUrl is a link to an image, not
  // an uploaded file - no file storage exists in this project.
  rollNumber?: string;
  photoUrl?: string;
}

export interface SignupResponse {
  user: { id: string; email: string; name: string };
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
}

export interface HostelRef {
  id: string;
  code: string;
  name: string;
}

export interface MeResponse {
  id: string;
  email: string;
  name: string;
  hostelId: string | null;
  hostel: HostelRef | null;
  isSportsAdmin: boolean;
  caretakerOfHostels: HostelRef[];
  secretaryOfHostels: HostelRef[];
  // D-013: true exactly once, the first time a newly-appointed
  // Secretary's own dashboard loads. Computed server-side, not a raw
  // stored value.
  showSecretaryWelcome: boolean;
}

export interface SelectHostelResponse {
  hostel: HostelRef;
  hostelSelectedAt: string;
  hostelLockedUntil: string;
}

export interface AppointeeRef {
  id: string;
  name: string;
  email: string;
  // D-012: that person's own self-reported values - null until they've
  // filled them in (every seeded account, including Caretakers, starts
  // this way).
  rollNumber: string | null;
  photoUrl: string | null;
}

// D-011: four Caretaker-appointed positions per hostel. Only
// sportsSecretary changes the appointee's dashboard - the other three are
// administrative record-keeping (see decision-log.md D-011).
export interface HostelDetail {
  id: string;
  code: string;
  name: string;
  sportsSecretary: AppointeeRef | null;
  proctor: AppointeeRef | null;
  gymSecretary: AppointeeRef | null;
  messSecretary: AppointeeRef | null;
}

export interface AppointResponse {
  hostel: HostelRef;
  appointee: AppointeeRef;
}

// FR-003's change flow.
export interface ChangeRequestRef {
  id: string;
  status: string;
  createdAt: string;
  requestedHostel: HostelRef;
}

export interface PendingChangeRequest extends ChangeRequestRef {
  user: { id: string; name: string; email: string };
}

// FR-005.
export interface SportRef {
  id: string;
  name: string;
  defaultTeamSize: number | null;
}

export interface TournamentInput {
  name: string;
  sportId: string;
  format: 'knockout' | 'league';
  registrationDeadline: string; // ISO date, e.g. "2026-11-30"
}

export interface Tournament {
  id: string;
  name: string;
  format: 'knockout' | 'league';
  status: string; // draft | registration_open | in_progress | completed | cancelled
  cancellationReason: string | null;
  registrationDeadline: string;
  createdAt: string;
  // FR-010: which result-entry form to render for this tournament's sport.
  sport: { id: string; name: string; scorecardTemplate: string };
  hostel: HostelRef;
  teamCount: number;
}

// FR-006: what a student sees - their own hostel's tournaments, each
// with whether they're already on a team (+ its registration status,
// D-016).
export interface StudentTournament extends Tournament {
  myTeam: {
    id: string;
    name: string;
    isCaptain: boolean;
    registrationStatus: string; // approved | rejected
  } | null;
}

export interface RosterPlayer {
  id: string;
  name: string;
  email: string;
  rollNumber: string | null;
  isCaptain: boolean;
}

export interface TeamRoster {
  id: string;
  name: string;
  captainUserId: string;
  registrationStatus: string; // approved | rejected
  tournament: { id: string; name: string };
  players: RosterPlayer[];
}

// D-016: the Secretary's view of a registered team (no `tournament`
// field - they're already looking at the tournament).
export interface RegisteredTeam {
  id: string;
  name: string;
  captainUserId: string;
  registrationStatus: string;
  players: RosterPlayer[];
}

// FR-007 / D-018: a single scheduled fixture. teamA/teamB are null on a
// knockout's later rounds until the earlier rounds are actually played.
export interface FixtureTeamRef {
  id: string;
  name: string;
}

export interface FixtureMatch {
  id: string;
  round: number;
  matchNumber: number;
  status: string; // scheduled | completed | cancelled | postponed | forfeited
  winnerTeamId: string | null;
  teamA: FixtureTeamRef | null;
  teamB: FixtureTeamRef | null;
  // FR-009: null until a venue request for this match is approved.
  scheduledDate: string | null; // ISO date
  scheduledTime: string | null; // "09:00"
  cancellationReason: string | null;
  // The current still-pending request for this match, if any - set even
  // when the match itself is cancelled (that's how an auto-suggested
  // reschedule after a cancellation shows up, instead of only as a toast
  // that's gone a few seconds after it fires).
  pendingBooking: { venueName: string; date: string; hour: string } | null;
}

export interface FixtureRound {
  round: number;
  matches: FixtureMatch[];
}

export interface Fixtures {
  tournamentId: string;
  rounds: FixtureRound[];
}

export type FixtureSlot = 'teamA' | 'teamB';

// FR-010: a match's post-match result. `data`'s keys depend on the
// tournament's sport.scorecardTemplate (see lib/scorecard-templates.ts).
export interface Scorecard {
  id: string;
  matchId: string;
  data: Record<string, number>;
  winnerTeamId: string | null;
  enteredBy: { id: string; name: string };
  enteredAt: string;
  sport: { id: string; name: string };
}

// FR-011: a league tournament's points table, computed fresh on every
// request - never stored. Co-ranked ties (D-005), not artificially split.
export interface StandingsRow {
  rank: number;
  teamId: string;
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
}

export interface Standings {
  tournamentId: string;
  standings: StandingsRow[];
}

// FR-012 (Announcements & Notifications). Posting one is Secretary-only
// (hostel-wide, or narrowed to one of their own tournaments); reading
// notifications is open to any authenticated user, scoped to their own.
export interface Announcement {
  id: string;
  hostelId: string | null;
  tournamentId: string | null;
  title: string;
  body: string;
  createdById: string;
  createdAt: string;
}

export interface PostAnnouncementResult extends Announcement {
  recipientCount: number;
}

export interface NotificationItem {
  id: string;
  message: string;
  readAt: string | null;
  createdAt: string;
  announcement: {
    id: string;
    title: string;
    body: string;
    hostelId: string | null;
    tournamentId: string | null;
  } | null;
}

export interface NotificationsResponse {
  notifications: NotificationItem[];
  unreadCount: number;
}

// FR-008 (Venue & Equipment Booking) - D-019: both halves let a Student
// or a Secretary request; only the Sports Department (isSportsAdmin)
// approves/rejects/edits inventory.
export interface EquipmentItem {
  id: string;
  name: string;
  totalQuantity: number;
  availableQuantity: number;
}

export interface BookingRequesterRef {
  id: string;
  name: string;
}

export interface EquipmentBooking {
  id: string;
  itemId: string;
  item: { id: string; name: string };
  quantity: number;
  status: string; // pending | checked_out | rejected | returned
  requestedBy: BookingRequesterRef | null;
  requestedByRole: 'student' | 'secretary';
  createdAt: string;
}

export interface VenueRef {
  id: string;
  name: string;
}

export interface VenueBooking {
  id: string;
  venueId: string;
  venue: VenueRef;
  date: string; // ISO date
  hour: string; // "06:00-07:00"
  status: string; // pending | approved | rejected
  requestedBy: BookingRequesterRef | null;
  requestedByRole: 'student' | 'secretary';
  createdAt: string;
}

// FR-009 (Scheduling & Conflict Engine).
export interface MatchBooking {
  id: string;
  venueId: string;
  venue: VenueRef;
  date: string; // ISO date
  hour: string; // "06:00-07:00"
  status: string; // pending | approved | rejected
}

export interface CancelMatchResult {
  cancelled: boolean;
  rescheduled: MatchBooking | null;
  message: string;
}

export interface ConflictMatchBrief {
  id: string;
  round: number;
  matchNumber: number;
  date: string | null;
  hour: string | null;
}

export interface ConflictEntry {
  type: 'team' | 'venue';
  message: string;
  matches: ConflictMatchBrief[];
}

export interface ConflictCheckResult {
  conflicts: ConflictEntry[];
}

export interface ConflictLogEntry {
  id: string;
  type: string;
  matchId: string;
  resolution: string; // unresolved | auto_suggested
  detectedAt: string;
  resolvedAt: string | null;
}

// The four appointment endpoints only differ by URL segment - one helper
// underneath the four named exports below, matching the backend's four
// thin controller methods over one shared service method.
function appointToRole(token: string, hostelId: string, segment: string, email: string) {
  return request<AppointResponse>(`/api/hostels/${hostelId}/${segment}`, {
    method: 'POST',
    token,
    body: { email },
  });
}

export const api = {
  signup: (input: SignupInput) =>
    request<SignupResponse>('/api/auth/signup', { method: 'POST', body: input }),

  login: (input: LoginInput) =>
    request<LoginResponse>('/api/auth/login', { method: 'POST', body: input }),

  me: (token: string) => request<MeResponse>('/api/me', { token }),

  listHostels: () => request<HostelRef[]>('/api/hostels'),

  selectHostel: (token: string, hostelId: string) =>
    request<SelectHostelResponse>('/api/hostels/select', {
      method: 'POST',
      token,
      body: { hostelId },
    }),

  getHostelDetail: (token: string, hostelId: string) =>
    request<HostelDetail>(`/api/hostels/${hostelId}`, { token }),

  appointSecretary: (token: string, hostelId: string, email: string) =>
    appointToRole(token, hostelId, 'secretary', email),

  appointProctor: (token: string, hostelId: string, email: string) =>
    appointToRole(token, hostelId, 'proctor', email),

  appointGymSecretary: (token: string, hostelId: string, email: string) =>
    appointToRole(token, hostelId, 'gym-secretary', email),

  appointMessSecretary: (token: string, hostelId: string, email: string) =>
    appointToRole(token, hostelId, 'mess-secretary', email),

  requestHostelChange: (token: string, requestedHostelId: string) =>
    request<ChangeRequestRef>('/api/hostels/change-requests', {
      method: 'POST',
      token,
      body: { requestedHostelId },
    }),

  // pending is null when the caller has no pending request. Wrapped in an
  // object rather than a bare nullable - see the backend controller
  // comment for why a bare `null` return doesn't survive as JSON "null"
  // over HTTP.
  getMyChangeRequest: (token: string) =>
    request<{ pending: ChangeRequestRef | null }>('/api/hostels/change-requests/mine', {
      token,
    }),

  // Caretaker's queue - server-scoped to their own hostel as each
  // requester's CURRENT hostel (business rule 9 / D-005), not the
  // requested one.
  getPendingChangeRequests: (token: string) =>
    request<PendingChangeRequest[]>('/api/hostels/change-requests/pending', { token }),

  approveChangeRequest: (token: string, id: string) =>
    request<ChangeRequestRef>(`/api/hostels/change-requests/${id}/approve`, {
      method: 'POST',
      token,
    }),

  rejectChangeRequest: (token: string, id: string) =>
    request<ChangeRequestRef>(`/api/hostels/change-requests/${id}/reject`, {
      method: 'POST',
      token,
    }),

  // D-013: fire-and-forget once the congratulations banner has actually
  // been shown - flips showSecretaryWelcome off for future logins.
  acknowledgeSecretaryWelcome: (token: string) =>
    request<{ acknowledged: boolean }>('/api/me/acknowledge-secretary-welcome', {
      method: 'POST',
      token,
    }),

  // FR-005.
  listSports: (token: string) => request<SportRef[]>('/api/sports', { token }),

  createTournament: (token: string, input: TournamentInput) =>
    request<Tournament>('/api/tournaments', { method: 'POST', token, body: input }),

  listMyTournaments: (token: string) =>
    request<Tournament[]>('/api/tournaments/mine', { token }),

  // D-025: the Caretaker's read-only view of their own hostel's tournaments.
  listTournamentsForCaretaker: (token: string) =>
    request<Tournament[]>('/api/tournaments/caretaker', { token }),

  // FR-006.
  listTournaments: (token: string) =>
    request<StudentTournament[]>('/api/tournaments', { token }),

  createTeam: (token: string, tournamentId: string, name: string) =>
    request<TeamRoster>(`/api/tournaments/${tournamentId}/teams`, {
      method: 'POST',
      token,
      body: { name },
    }),

  getTeam: (token: string, teamId: string) =>
    request<TeamRoster>(`/api/teams/${teamId}`, { token }),

  addTeamPlayer: (token: string, teamId: string, email: string) =>
    request<TeamRoster>(`/api/teams/${teamId}/players`, {
      method: 'POST',
      token,
      body: { email },
    }),

  removeTeamPlayer: (token: string, teamId: string, userId: string) =>
    request<TeamRoster>(`/api/teams/${teamId}/players/${userId}`, {
      method: 'DELETE',
      token,
    }),

  // D-016: Secretary views / approves / rejects registered teams.
  listTournamentTeams: (token: string, tournamentId: string) =>
    request<RegisteredTeam[]>(`/api/tournaments/${tournamentId}/teams`, { token }),

  approveTeam: (token: string, teamId: string) =>
    request<TeamRoster>(`/api/teams/${teamId}/approve`, { method: 'POST', token }),

  rejectTeam: (token: string, teamId: string) =>
    request<TeamRoster>(`/api/teams/${teamId}/reject`, { method: 'POST', token }),

  // D-017: Secretary deletes their own tournament.
  deleteTournament: (token: string, tournamentId: string) =>
    request<{ deleted: boolean }>(`/api/tournaments/${tournamentId}`, {
      method: 'DELETE',
      token,
    }),

  // D-021: Secretary calls off a tournament that already has fixtures -
  // cancels every open match and frees their venue bookings too.
  cancelTournament: (token: string, tournamentId: string, reason: string) =>
    request<{ cancelled: boolean }>(`/api/tournaments/${tournamentId}/cancel`, {
      method: 'POST',
      token,
      body: { reason },
    }),

  // FR-007 / D-018: generate the Match schedule, view it, and drag-swap
  // teams between two match slots.
  generateFixtures: (token: string, tournamentId: string) =>
    request<Fixtures>(`/api/tournaments/${tournamentId}/fixtures`, {
      method: 'POST',
      token,
    }),

  getFixtures: (token: string, tournamentId: string) =>
    request<Fixtures>(`/api/tournaments/${tournamentId}/fixtures`, { token }),

  swapFixtureTeams: (
    token: string,
    tournamentId: string,
    matchAId: string,
    slotA: FixtureSlot,
    matchBId: string,
    slotB: FixtureSlot,
  ) =>
    request<Fixtures>(`/api/tournaments/${tournamentId}/fixtures/swap`, {
      method: 'POST',
      token,
      body: { matchAId, slotA, matchBId, slotB },
    }),

  // FR-008 / D-019: equipment.
  listEquipment: (token: string) => request<EquipmentItem[]>('/api/equipment', { token }),

  addEquipmentItem: (token: string, name: string, totalQuantity: number) =>
    request<EquipmentItem>('/api/equipment', {
      method: 'POST',
      token,
      body: { name, totalQuantity },
    }),

  updateEquipmentItem: (token: string, itemId: string, name: string, totalQuantity: number) =>
    request<EquipmentItem>(`/api/equipment/${itemId}`, {
      method: 'PATCH',
      token,
      body: { name, totalQuantity },
    }),

  deleteEquipmentItem: (token: string, itemId: string) =>
    request<{ deleted: boolean }>(`/api/equipment/${itemId}`, { method: 'DELETE', token }),

  requestEquipment: (token: string, itemId: string, quantity: number) =>
    request<EquipmentBooking>(`/api/equipment/${itemId}/bookings`, {
      method: 'POST',
      token,
      body: { quantity },
    }),

  myEquipmentBookings: (token: string) =>
    request<EquipmentBooking[]>('/api/equipment/bookings/mine', { token }),

  allEquipmentBookings: (token: string) =>
    request<EquipmentBooking[]>('/api/equipment/bookings', { token }),

  approveEquipmentBooking: (token: string, bookingId: string) =>
    request<{ approved: boolean }>(`/api/equipment-bookings/${bookingId}/approve`, {
      method: 'POST',
      token,
    }),

  rejectEquipmentBooking: (token: string, bookingId: string) =>
    request<{ rejected: boolean }>(`/api/equipment-bookings/${bookingId}/reject`, {
      method: 'POST',
      token,
    }),

  returnEquipmentBooking: (token: string, bookingId: string) =>
    request<{ returned: boolean }>(`/api/equipment-bookings/${bookingId}/return`, {
      method: 'POST',
      token,
    }),

  // FR-008 / D-019: venue.
  listVenues: (token: string) => request<VenueRef[]>('/api/venues', { token }),

  requestVenue: (token: string, venueId: string, date: string, hour: string) =>
    request<VenueBooking>(`/api/venues/${venueId}/bookings`, {
      method: 'POST',
      token,
      body: { date, hour },
    }),

  myVenueBookings: (token: string) =>
    request<VenueBooking[]>('/api/venues/bookings/mine', { token }),

  allVenueBookings: (token: string) =>
    request<VenueBooking[]>('/api/venues/bookings', { token }),

  approveVenueBooking: (token: string, bookingId: string) =>
    request<{ approved: boolean }>(`/api/venue-bookings/${bookingId}/approve`, {
      method: 'POST',
      token,
    }),

  rejectVenueBooking: (token: string, bookingId: string) =>
    request<{ rejected: boolean }>(`/api/venue-bookings/${bookingId}/reject`, {
      method: 'POST',
      token,
    }),

  // FR-009 / D-020: assign (or re-assign) a venue+date+time to a fixture
  // match, cancel one (with an automatic reschedule search), and scan a
  // tournament's schedule for team/venue clashes.
  scheduleMatch: (token: string, matchId: string, venueId: string, date: string, hour: string) =>
    request<MatchBooking>(`/api/matches/${matchId}/schedule`, {
      method: 'POST',
      token,
      body: { venueId, date, hour },
    }),

  cancelMatch: (token: string, matchId: string, reason: string) =>
    request<CancelMatchResult>(`/api/matches/${matchId}/cancel`, {
      method: 'POST',
      token,
      body: { reason },
    }),

  checkConflicts: (token: string, tournamentId: string) =>
    request<ConflictCheckResult>(`/api/tournaments/${tournamentId}/conflicts/check`, {
      method: 'POST',
      token,
    }),

  getConflicts: (token: string, tournamentId: string) =>
    request<ConflictLogEntry[]>(`/api/tournaments/${tournamentId}/conflicts`, { token }),

  // FR-010: enter (Secretary-only) or read back a match's result.
  submitScorecard: (
    token: string,
    matchId: string,
    winnerTeamId: string | null,
    data: Record<string, number>,
  ) =>
    request<Scorecard>(`/api/matches/${matchId}/scorecard`, {
      method: 'POST',
      token,
      body: { winnerTeamId, data },
    }),

  getScorecard: (token: string, matchId: string) =>
    request<Scorecard>(`/api/matches/${matchId}/scorecard`, { token }),

  // FR-011: open to any authenticated user, unlike almost every other
  // tournament endpoint - no Secretary/hostel ownership check.
  getStandings: (token: string, tournamentId: string) =>
    request<Standings>(`/api/tournaments/${tournamentId}/standings`, { token }),

  // FR-012: Secretary posts (hostel-wide, or narrowed to one of their own
  // tournaments); any authenticated user reads and acknowledges their own.
  postAnnouncement: (token: string, title: string, body: string, tournamentId?: string) =>
    request<PostAnnouncementResult>('/api/announcements', {
      method: 'POST',
      token,
      body: { title, body, tournamentId },
    }),

  listMyAnnouncements: (token: string) =>
    request<Announcement[]>('/api/announcements/mine', { token }),

  // D-029: a full retraction - the recipients' notifications disappear too.
  deleteAnnouncement: (token: string, announcementId: string) =>
    request<{ deleted: boolean }>(`/api/announcements/${announcementId}`, {
      method: 'DELETE',
      token,
    }),

  listMyNotifications: (token: string) =>
    request<NotificationsResponse>('/api/notifications', { token }),

  markNotificationRead: (token: string, notificationId: string) =>
    request<{ read: boolean }>(`/api/notifications/${notificationId}/read`, {
      method: 'POST',
      token,
    }),
};

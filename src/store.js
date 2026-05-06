import { nanoid } from "nanoid";

const STORAGE_KEY = "tournament_data";

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(tournaments) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tournaments));
}

let tournaments = load();

// ---------------------------------------------------------------------------
// Swiss pairing engine
// ---------------------------------------------------------------------------

/**
 * Build a set of "played" pairs for a tournament so we can avoid rematches.
 * Returns a Set of strings like "idA|idB" (always smaller id first).
 */
function playedPairs(t) {
  const pairs = new Set();
  for (const round of t.rounds) {
    for (const match of round.matches) {
      if (match.bye) continue;
      const key = [match.p1.id, match.p2.id].sort().join("|");
      pairs.add(key);
    }
  }
  return pairs;
}

/**
 * Try to find a valid pairing for `players` avoiding pairs in `played`.
 * Uses a recursive backtracking approach so rematches are only used as
 * a last resort when no other arrangement is possible.
 *
 * Returns an array of [p1, p2] pairs, or null if totally impossible.
 */
function backtrack(players, played) {
  if (players.length === 0) return [];
  if (players.length === 1) return null; // caller handles bye separately

  const [first, ...rest] = players;

  // Try pairing `first` with each remaining player in order (already sorted by score)
  for (let i = 0; i < rest.length; i++) {
    const opponent = rest[i];
    const key = [first.id, opponent.id].sort().join("|");

    if (!played.has(key)) {
      const remaining = rest.filter((_, idx) => idx !== i);
      const result = backtrack(remaining, played);
      if (result !== null) {
        return [[first, opponent], ...result];
      }
    }
  }

  // Fallback: allow rematches if no clean solution exists
  for (let i = 0; i < rest.length; i++) {
    const opponent = rest[i];
    const remaining = rest.filter((_, idx) => idx !== i);
    const result = backtrack(remaining, played);
    if (result !== null) {
      return [[first, opponent], ...result];
    }
  }

  return null;
}

/**
 * Generate Swiss pairings for tournament `t`.
 * - Sort players by score desc, then by name for tiebreak.
 * - Handle odd player count: lowest-score player without a prior bye gets a bye.
 * - Avoid rematches via backtracking.
 */
function swissPairings(t) {
  const played = playedPairs(t);

  // Players who already received a bye
  const byeReceivers = new Set(
    t.rounds
      .flatMap((r) => r.matches)
      .filter((m) => m.bye)
      .map((m) => m.p1.id)
  );

  // Sort by score desc, alphabetical for tiebreak
  const sorted = [...t.participants].sort((a, b) =>
    b.score !== a.score ? b.score - a.score : a.name.localeCompare(b.name)
  );

  let byePlayer = null;
  let activePlayers = sorted;

  if (sorted.length % 2 !== 0) {
    // Give bye to the lowest-score player who hasn't had one yet
    const byeCandidate = [...sorted]
      .reverse()
      .find((p) => !byeReceivers.has(p.id));

    byePlayer = byeCandidate || sorted[sorted.length - 1];
    activePlayers = sorted.filter((p) => p.id !== byePlayer.id);
  }

  const pairs = backtrack(activePlayers, played) || [];

  const matches = pairs.map(([p1, p2]) => ({
    id: nanoid(),
    p1: { id: p1.id, name: p1.name },
    p2: { id: p2.id, name: p2.name },
    result: null, // null | "p1" | "p2" | "draw"
    bye: false,
  }));

  if (byePlayer) {
    matches.push({
      id: nanoid(),
      p1: { id: byePlayer.id, name: byePlayer.name },
      p2: null,
      result: "bye",
      bye: true,
    });
  }

  return matches;
}

// ---------------------------------------------------------------------------
// Store API
// ---------------------------------------------------------------------------

export const store = {
  getTournaments() {
    return tournaments;
  },

  getTournament(id) {
    return tournaments.find((t) => t.id === id) || null;
  },

  createTournament(title) {
    const t = {
      id: nanoid(),
      title,
      participants: [],
      rounds: [],
      status: "registration", // "registration" | "ongoing" | "finished"
      createdAt: Date.now(),
    };
    tournaments.push(t);
    save(tournaments);
    return t;
  },

  deleteTournament(id) {
    tournaments = tournaments.filter((t) => t.id !== id);
    save(tournaments);
  },

  addParticipant(id, name) {
    const t = tournaments.find((t) => t.id === id);
    if (!t || t.status !== "registration") return;
    if (t.participants.some((p) => p.name.toLowerCase() === name.toLowerCase())) return;
    t.participants.push({ id: nanoid(), name, score: 0, wins: 0, losses: 0, draws: 0, byes: 0 });
    save(tournaments);
  },

  removeParticipant(id, playerId) {
    const t = tournaments.find((t) => t.id === id);
    if (!t || t.status !== "registration") return;
    t.participants = t.participants.filter((p) => p.id !== playerId);
    save(tournaments);
  },

  generateRound(id) {
    const t = tournaments.find((t) => t.id === id);
    if (!t || t.participants.length < 2) return;

    // Block new round if current round has unscored matches
    const lastRound = t.rounds[t.rounds.length - 1];
    if (lastRound) {
      const incomplete = lastRound.matches.some(
        (m) => !m.bye && m.result === null
      );
      if (incomplete) return { error: "Complete all match results first." };
    }

    t.status = "ongoing";
    const matches = swissPairings(t);

    // Auto-apply bye score
    for (const match of matches) {
      if (match.bye) {
        const player = t.participants.find((p) => p.id === match.p1.id);
        if (player) {
          player.score += 1;
          player.byes += 1;
        }
      }
    }

    t.rounds.push({
      id: nanoid(),
      number: t.rounds.length + 1,
      matches,
    });

    save(tournaments);
    return { ok: true };
  },

  recordResult(tournamentId, roundId, matchId, result) {
    // result: "p1" | "p2" | "draw"
    const t = tournaments.find((t) => t.id === tournamentId);
    if (!t) return;
    const round = t.rounds.find((r) => r.id === roundId);
    if (!round) return;
    const match = round.matches.find((m) => m.id === matchId);
    if (!match || match.bye) return;

    const prevResult = match.result;

    // Undo previous result if any
    if (prevResult !== null) {
      const p1 = t.participants.find((p) => p.id === match.p1.id);
      const p2 = t.participants.find((p) => p.id === match.p2.id);
      if (prevResult === "p1") { p1.score -= 1; p1.wins -= 1; p2.losses -= 1; }
      else if (prevResult === "p2") { p2.score -= 1; p2.wins -= 1; p1.losses -= 1; }
      else if (prevResult === "draw") { p1.score -= 0.5; p2.score -= 0.5; p1.draws -= 1; p2.draws -= 1; }
    }

    // Apply new result
    match.result = result;
    const p1 = t.participants.find((p) => p.id === match.p1.id);
    const p2 = t.participants.find((p) => p.id === match.p2.id);

    if (result === "p1") { p1.score += 1; p1.wins += 1; p2.losses += 1; }
    else if (result === "p2") { p2.score += 1; p2.wins += 1; p1.losses += 1; }
    else if (result === "draw") { p1.score += 0.5; p2.score += 0.5; p1.draws += 1; p2.draws += 1; }

    save(tournaments);
  },

  finishTournament(id) {
    const t = tournaments.find((t) => t.id === id);
    if (t) { t.status = "finished"; save(tournaments); }
  },
};
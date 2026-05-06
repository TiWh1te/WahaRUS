import { useParams, Link } from "react-router-dom";
import { store } from "../store";
import { useState } from "react";

function resultLabel(result) {
  if (result === "p1")   return "1 – 0";
  if (result === "p2")   return "0 – 1";
  if (result === "draw") return "½ – ½";
  return "";
}

function scoreDisplay(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function rankPlayers(participants) {
  return [...participants].sort((a, b) =>
    b.score !== a.score ? b.score - a.score : a.name.localeCompare(b.name)
  );
}

// ─── Standings ───────────────────────────────────────────────────────────────

function Standings({ participants }) {
  const ranked = rankPlayers(participants);
  const hasScores = participants.some((p) => p.score > 0);
  return (
    <div className="card">
      <div className="card-header">
        <span className="section-title">Standings</span>
        <span className="count-pill">{participants.length} players</span>
      </div>
      <table className="standings-table">
        <thead>
          <tr>
            <th className="rank">#</th>
            <th className="name-col">Player</th>
            <th title="Points">Pts</th>
            <th title="Wins">W</th>
            <th title="Draws">D</th>
            <th title="Losses">L</th>
            <th title="Byes">Bye</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((p, i) => (
            <tr key={p.id} className={i === 0 && hasScores ? "leader" : ""}>
              <td className="rank">{i + 1}</td>
              <td className="name-col">{p.name}</td>
              <td className="pts">{scoreDisplay(p.score)}</td>
              <td>{p.wins}</td>
              <td>{p.draws}</td>
              <td>{p.losses}</td>
              <td>{p.byes || 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Match row ────────────────────────────────────────────────────────────────

function MatchRow({ match, tournamentId, roundId, onUpdate }) {
  if (match.bye) {
    return (
      <div className="match-row bye-row">
        <span className="player-name">{match.p1.name}</span>
        <span className="bye-badge">BYE +1</span>
      </div>
    );
  }

  const setResult = (result) => {
    store.recordResult(tournamentId, roundId, match.id, result);
    onUpdate();
  };

  return (
    <div className="match-row">
      <span className={`player-name ${match.result === "p1" ? "winner" : match.result === "p2" ? "loser" : ""}`}>
        {match.p1.name}
      </span>

      <div className="result-controls">
        {match.result && (
          <span className="result-badge">{resultLabel(match.result)}</span>
        )}
        <div className="result-buttons">
          <button
            className={`res-btn ${match.result === "p1" ? "active" : ""}`}
            onClick={() => setResult("p1")}
            title={`${match.p1.name} wins`}
          >W</button>
          <button
            className={`res-btn draw ${match.result === "draw" ? "active" : ""}`}
            onClick={() => setResult("draw")}
            title="Draw"
          >½</button>
          <button
            className={`res-btn ${match.result === "p2" ? "active" : ""}`}
            onClick={() => setResult("p2")}
            title={`${match.p2.name} wins`}
          >W</button>
        </div>
      </div>

      <span className={`player-name right ${match.result === "p2" ? "winner" : match.result === "p1" ? "loser" : ""}`}>
        {match.p2.name}
      </span>
    </div>
  );
}

// ─── Round card ───────────────────────────────────────────────────────────────

function RoundCard({ round, tournamentId, onUpdate }) {
  const allDone = round.matches.every((m) => m.result !== null);
  return (
    <div className={`card round-card ${allDone ? "round-complete" : ""}`}>
      <div className="round-header">
        <span className="section-title" style={{ marginBottom: 0 }}>Round {round.number}</span>
        {allDone && <span className="complete-badge">✓ Complete</span>}
      </div>
      {round.matches.map((m) => (
        <MatchRow
          key={m.id}
          match={m}
          tournamentId={tournamentId}
          roundId={round.id}
          onUpdate={onUpdate}
        />
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Tournament() {
  const { id } = useParams();
  const [tick, setTick] = useState(0);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");

  const rerender = () => setTick((x) => x + 1);

  const t = store.getTournament(id);
  if (!t) return (
    <div className="container">
      <p style={{ color: "var(--text-dim)", paddingTop: "2rem" }}>
        Tournament not found. <Link to="/" style={{ color: "var(--accent)" }}>← Back</Link>
      </p>
    </div>
  );

  const isRegistration = t.status === "registration";
  const isFinished     = t.status === "finished";
  const lastRound      = t.rounds[t.rounds.length - 1];
  const lastRoundComplete = !lastRound || lastRound.matches.every((m) => m.result !== null);

  const addPlayer = () => {
    const name = newName.trim();
    if (!name) return;
    store.addParticipant(id, name);
    setNewName("");
    rerender();
  };

  const handleGenerateRound = () => {
    const result = store.generateRound(id);
    if (result?.error) setError(result.error);
    else { setError(""); rerender(); }
  };

  const winner = isFinished ? rankPlayers(t.participants)[0] : null;

  const STATUS_CLS = { registration: "status-registration", ongoing: "status-ongoing", finished: "status-finished" };
  const STATUS_LBL = { registration: "Registration", ongoing: "Live", finished: "Finished" };

  return (
    <div className="container">

      {/* ── Header ── */}
      <div className="page-header">
        <Link to="/" className="back-link">← All Tournaments</Link>
        <div className="tournament-meta">
          <h2 className="tournament-title">{t.title}</h2>
          <span className={`status-badge ${STATUS_CLS[t.status]}`}>
            {STATUS_LBL[t.status]}
          </span>
        </div>
      </div>

      {/* ── Winner ── */}
      {isFinished && winner && (
        <div className="card winner-card">
          <div className="trophy">🏆</div>
          <div>
            <div className="winner-label">Tournament Winner</div>
            <div className="winner-name">{winner.name}</div>
            <div className="winner-score">{scoreDisplay(winner.score)} points</div>
          </div>
        </div>
      )}

      {/* ── Registration ── */}
      {isRegistration && (
        <div className="card">
          <div className="section-title">Add Players</div>
          <div className="input-row">
            <input
              className="input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addPlayer()}
              placeholder="Player name"
              autoFocus
            />
            <button className="button" onClick={addPlayer}>Add</button>
          </div>
          {t.participants.length > 0 && (
            <ul className="player-list">
              {t.participants.map((p) => (
                <li key={p.id} className="player-item">
                  <span>{p.name}</span>
                  <button className="remove-btn" onClick={() => { store.removeParticipant(id, p.id); rerender(); }}>×</button>
                </li>
              ))}
            </ul>
          )}
          {t.participants.length === 0 && (
            <p className="hint">Add at least 2 players to start.</p>
          )}
        </div>
      )}

      {/* ── Standings ── */}
      {t.participants.length >= 2 && <Standings participants={t.participants} />}

      {/* ── Actions ── */}
      {!isFinished && (
        <div className="action-row">
          {error && <span className="error-msg">{error}</span>}
          {t.participants.length >= 2 && lastRoundComplete && (
            <button className="button primary" onClick={handleGenerateRound}>
              {t.rounds.length === 0 ? "Start Tournament → Round 1" : `→ Round ${t.rounds.length + 1}`}
            </button>
          )}
          {t.rounds.length > 0 && lastRoundComplete && (
            <button className="button danger" onClick={() => { store.finishTournament(id); rerender(); }}>
              Finish Tournament
            </button>
          )}
        </div>
      )}

      {/* ── Rounds ── */}
      <div className="rounds-list">
        {[...t.rounds].reverse().map((r) => (
          <RoundCard
            key={r.id}
            round={r}
            tournamentId={id}
            onUpdate={rerender}
          />
        ))}
      </div>

    </div>
  );
}
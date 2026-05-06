import { useState } from "react";
import { store } from "../store";
import { Link } from "react-router-dom";

const DOT_CLASS  = { registration: "dot-reg", ongoing: "dot-live", finished: "dot-done" };
const STATUS_CLS = { registration: "status-registration", ongoing: "status-ongoing", finished: "status-finished" };
const STATUS_LBL = { registration: "Reg", ongoing: "Live", finished: "Done" };

export default function Home() {
  const [title, setTitle] = useState("");
  const [list, setList] = useState(store.getTournaments());

  const refresh = () => setList([...store.getTournaments()]);

  const create = () => {
    if (!title.trim()) return;
    store.createTournament(title.trim());
    setTitle("");
    refresh();
  };

  const remove = (id, name) => {
    if (!confirm(`Delete "${name}"?`)) return;
    store.deleteTournament(id);
    refresh();
  };

  return (
    <div className="container">

      {/* ── Wordmark ── */}
      <div className="home-header">
        <div className="wordmark">
          <div className="wordmark-icon">
            {/* Trophy / star icon */}
            <svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 2l2.09 4.26L17 7.27l-3.5 3.41.83 4.82L10 13.27l-4.33 2.23.83-4.82L3 7.27l4.91-.71z"/>
            </svg>
          </div>
          <span className="wordmark-text">PairingOS</span>
        </div>
        <p className="app-subtitle">Swiss-system board game pairings</p>
      </div>

      {/* ── Create ── */}
      <div className="card">
        <div className="section-title">New Tournament</div>
        <div className="input-row">
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            placeholder="Tournament name"
            autoFocus
          />
          <button className="button primary" onClick={create}>Create</button>
        </div>
      </div>

      {/* ── List ── */}
      {list.length > 0 ? (
        <div className="card">
          <div className="card-header">
            <span className="section-title">Tournaments</span>
            <span className="count-pill">{list.length}</span>
          </div>
          <ul className="tournament-list">
            {list.map((t) => (
              <li key={t.id} className="tournament-item">
                <span className={`t-dot ${DOT_CLASS[t.status]}`} />
                <Link to={`/t/${t.id}`} className="tournament-link">
                  <span className="t-name">{t.title}</span>
                  <span className="t-meta">
                    {t.participants.length} player{t.participants.length !== 1 ? "s" : ""} · Round {t.rounds.length}
                  </span>
                </Link>
                <div className="t-right">
                  <span className={`status-badge ${STATUS_CLS[t.status]}`}>
                    {STATUS_LBL[t.status]}
                  </span>
                  <button className="remove-btn" onClick={() => remove(t.id, t.title)} title="Delete">×</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="card empty-state">
          <p>No tournaments yet — create one above.</p>
        </div>
      )}

    </div>
  );
}
import { useState } from "react";
import { useNavigate } from "react-router";

export function Home() {
  const [username, setUsername] = useState("");
  const navigate = useNavigate();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = username.trim();
    if (!trimmed) return;
    navigate(`/leagues/${encodeURIComponent(trimmed)}`);
  }

  return (
    <main className="page">
      <h1>Sleeper Sidekick</h1>
      <p className="subtitle">Analytics your Sleeper league doesn't show you.</p>
      <form className="username-form" onSubmit={handleSubmit}>
        <label htmlFor="username">Sleeper username</label>
        <input
          id="username"
          name="username"
          type="text"
          placeholder="Your Sleeper username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
        />
        <button type="submit" disabled={!username.trim()}>
          Find my leagues
        </button>
      </form>
    </main>
  );
}

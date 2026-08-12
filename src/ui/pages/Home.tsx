export function Home() {
  return (
    <main className="page">
      <h1>Sleeper Sidekick</h1>
      <p className="subtitle">Analytics your Sleeper league doesn't show you.</p>
      <form className="username-form">
        <label htmlFor="username">Sleeper username</label>
        <input id="username" name="username" type="text" placeholder="e.g. Havok21" disabled />
        <button type="submit" disabled>
          Find my leagues
        </button>
      </form>
    </main>
  );
}

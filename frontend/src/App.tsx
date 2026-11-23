import { useCallback, useEffect, useState } from "react";
import {
  getCurrentUser,
  getEmails,
  logout,
  searchEmails,
  type CurrentUser
} from "./api";
import { ComposeForm } from "./components/ComposeForm";
import { EmailTable } from "./components/EmailTable";
import { SlackSettings } from "./components/SlackSettings";
import type { EmailRecord } from "./types";

type Tab = "scheduled" | "sent";

export default function App() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [checkingLogin, setCheckingLogin] = useState(true);
  const [tab, setTab] = useState<Tab>("scheduled");
  const [emails, setEmails] = useState<EmailRecord[]>([]);
  const [searchResults, setSearchResults] = useState<EmailRecord[] | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError("");

    try {
      setEmails(await getEmails(tab));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load emails");
    } finally {
      setLoading(false);
    }
  }, [tab, user]);

  useEffect(() => {
    getCurrentUser()
      .then(({ user: currentUser }) => setUser(currentUser))
      .catch(() => setUser(null))
      .finally(() => setCheckingLogin(false));
  }, []);

  useEffect(() => {
    if (user) void refresh();
  }, [user, refresh]);

  async function handleLogout() {
    await logout();
    setUser(null);
    setEmails([]);
    setSearchResults(null);
  }

  async function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }

    setSearching(true);
    setError("");

    try {
      setSearchResults(await searchEmails(searchQuery, tab));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  function changeTab(nextTab: Tab) {
    setTab(nextTab);
    setSearchResults(null);
    setSearchQuery("");
  }

  if (checkingLogin) {
    return (
      <main className="shell">
        <p>Checking sign-in…</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="login-shell">
        <section className="login-card">
          <p className="eyebrow">REACHINBOX</p>
          <h1>Email Scheduler</h1>
          <p>Sign in with Google to schedule and search your emails.</p>
          <a className="google-button" href="/api/auth/google">
            Continue with Google
          </a>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">REACHINBOX</p>
          <h1>Email Scheduler</h1>
        </div>

        <div className="user-menu">
          {user.picture && (
            <img src={user.picture} alt="" className="avatar" />
          )}
          <div className="user-details">
            <strong>{user.name}</strong>
            <span>{user.email}</span>
          </div>
          <button className="secondary" onClick={() => void handleLogout()}>
            Logout
          </button>
        </div>
      </header>

      <ComposeForm onScheduled={() => void refresh()} />
      <SlackSettings />

      <section className="list-panel">
        <form
          onSubmit={(event) => void handleSearch(event)}
          style={{ display: "flex", gap: 8, marginBottom: 16 }}
        >
          <input
            aria-label="Search emails"
            placeholder="Search recipient, subject, or body"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
          <button disabled={searching}>
            {searching ? "Searching…" : "Search"}
          </button>
          {searchResults && (
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setSearchQuery("");
                setSearchResults(null);
              }}
            >
              Clear
            </button>
          )}
        </form>

        <nav className="tabs">
          <button
            className={tab === "scheduled" ? "active" : ""}
            onClick={() => changeTab("scheduled")}
          >
            Scheduled
          </button>
          <button
            className={tab === "sent" ? "active" : ""}
            onClick={() => changeTab("sent")}
          >
            Sent
          </button>
          <button className="secondary" onClick={() => void refresh()}>
            Refresh
          </button>
        </nav>

        {error ? (
          <p className="error">{error}</p>
        ) : loading ? (
          <p className="empty">Loading emails…</p>
        ) : (
          <EmailTable
            emails={searchResults ?? emails}
            status={tab}
          />
        )}
      </section>
    </main>
  );
}
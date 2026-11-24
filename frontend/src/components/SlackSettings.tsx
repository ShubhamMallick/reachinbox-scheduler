import { useEffect, useState } from "react";
import {
  disconnectSlack,
  getSlackChannels,
  getSlackStatus,
  saveSlackChannel,
  type SlackChannel,
  type SlackStatus
} from "../api";

export function SlackSettings() {
  const [status, setStatus] = useState<SlackStatus | null>(null);
  const [channels, setChannels] = useState<SlackChannel[]>([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    setMessage("");

    try {
      const current = await getSlackStatus();
      console.log("Slack status:", current);
      setStatus(current);

      if (current.connected) {
        const result = await getSlackChannels();
        console.log("Slack channels:", result);
        setChannels(result.channels);
        setSelected(result.selected ?? "");
      }
    } catch (error) {
      console.error("Slack load error:", error);
      setMessage(error instanceof Error ? error.message : "Could not load Slack");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleChannelChange(channelId: string) {
    setSelected(channelId);

    try {
      await saveSlackChannel(channelId);
      setMessage("Slack notification channel saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save channel");
    }
  }

  async function handleDisconnect() {
    try {
      await disconnectSlack();
      setChannels([]);
      setSelected("");
      setStatus({ connected: false, connection: null });
      setMessage("Slack disconnected.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not disconnect");
    }
  }

  return (
    <section className="slack-panel">
      <div>
        <h2>Slack notifications</h2>
        {loading ? (
          <p>Checking Slack connection…</p>
        ) : status?.connected ? (
          <p>
            Connected to <strong>{status.connection?.teamName ?? "Slack"}</strong>
          </p>
        ) : (
          <p>Connect Slack to receive alerts when a sender reaches its hourly limit.</p>
        )}
      </div>

      {!loading && !status?.connected && (
        <button
          className="slack-connect"
          onClick={() => {
            const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";
            window.location.href = `${apiUrl}/api/slack/connect`;
          }}
        >
          Connect Slack
        </button>
      )}

      {!loading && status?.connected && (
        <div className="slack-controls">
          <label>
            Alert channel
            <select
              value={selected}
              onChange={(event) => {
                console.log("Channel changed:", event.target.value);
                void handleChannelChange(event.target.value);
              }}
              disabled={channels.length === 0}
              style={{ 
                pointerEvents: "auto", 
                opacity: 1, 
                display: "block",
                position: "relative",
                zIndex: 10
              }}
            >
              <option value="">
                {channels.length === 0 ? "No channels available" : "Choose a channel"}
              </option>
              {channels.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  #{channel.name}
                </option>
              ))}
            </select>
          </label>

          <button className="secondary" onClick={() => void handleDisconnect()}>
            Disconnect Slack
          </button>
        </div>
      )}

      {status?.connected && channels.length === 0 && !loading && (
        <p className="hint">
          No channels found that the app belongs to. In Slack, invite the app to a
          channel, then refresh this page.
        </p>
      )}

      {message && <p role="status">{message}</p>}
    </section>
  );
}
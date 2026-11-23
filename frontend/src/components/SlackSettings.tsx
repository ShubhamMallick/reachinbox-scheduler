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
      setStatus(current);

      if (current.connected) {
        const result = await getSlackChannels();
        setChannels(result.channels);
        setSelected(result.selected ?? "");
      }
    } catch (error) {
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
        <a className="google-button slack-connect" href="/api/slack/connect">
          Connect Slack
        </a>
      )}

      {!loading && status?.connected && (
        <div className="slack-controls">
          <label>
            Alert channel
            <select
              value={selected}
              onChange={(event) => void handleChannelChange(event.target.value)}
            >
              <option value="">Choose a channel</option>
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
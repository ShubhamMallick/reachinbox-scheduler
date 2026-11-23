import { useState } from "react";
import { scheduleEmails } from "../api";

export function ComposeForm({ onScheduled }: { onScheduled: () => void }) {
  const [recipients, setRecipients] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [fromName, setFromName] = useState("ReachInbox Demo");
  const [fromEmail, setFromEmail] = useState("demo@example.com");
  const [startAt, setStartAt] = useState("");
  const [delayBetweenMs, setDelayBetweenMs] = useState(2000);
  const [senderKey, setSenderKey] = useState("default");
  const [hourlyLimit, setHourlyLimit] = useState(100);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function readFile(file?: File) {
    if (!file) return;

    const text = await file.text();
    const found = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
    const unique = [...new Set(found.map((email) => email.toLowerCase()))];

    setRecipients(unique);
    setMessage(`Detected ${unique.length} email address(es).`);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      await scheduleEmails({
        recipients,
        subject,
        body,
        startAt: new Date(startAt).toISOString(),
        delayBetweenMs,
        senderKey,
        hourlyLimit,
        fromName,
        fromEmail
      });

      setMessage(`Scheduled ${recipients.length} email(s).`);
      setRecipients([]);
      onScheduled();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Scheduling failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="compose" onSubmit={submit}>
      <h2>Compose new email</h2>

      <label>
        Leads file (CSV or text)
        <input
          type="file"
          accept=".csv,.txt,text/plain,text/csv"
          onChange={(event) => void readFile(event.target.files?.[0])}
        />
      </label>
      <p className="hint">{recipients.length} recipient(s) detected</p>

      <label>
        Subject
        <input
          required
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
        />
      </label>

      <label>
        Body
        <textarea
          required
          rows={5}
          value={body}
          onChange={(event) => setBody(event.target.value)}
        />
      </label>

      <div className="row">
        <label>
          From name
          <input
            required
            value={fromName}
            onChange={(event) => setFromName(event.target.value)}
          />
        </label>

        <label>
          From email
          <input
            required
            type="email"
            value={fromEmail}
            onChange={(event) => setFromEmail(event.target.value)}
          />
        </label>
      </div>

      <div className="row">
        <label>
          Start time
          <input
            required
            type="datetime-local"
            value={startAt}
            onChange={(event) => setStartAt(event.target.value)}
          />
        </label>

        <label>
          Delay between emails (ms)
          <input
            type="number"
            min="0"
            value={delayBetweenMs}
            onChange={(event) =>
              setDelayBetweenMs(Number(event.target.value))
            }
          />
        </label>
      </div>

      <div className="row">
        <label>
          Sender key
          <input
            required
            value={senderKey}
            onChange={(event) => setSenderKey(event.target.value)}
          />
        </label>

        <label>
          Emails per hour for this sender
          <input
            required
            type="number"
            min="1"
            max="100000"
            value={hourlyLimit}
            onChange={(event) => setHourlyLimit(Number(event.target.value))}
          />
        </label>
      </div>

      <button disabled={busy || recipients.length === 0}>
        {busy ? "Scheduling…" : "Schedule emails"}
      </button>

      {message && <p role="status">{message}</p>}
    </form>
  );
}
import type { EmailRecord } from "../types";

export function EmailTable({
  emails,
  status
}: {
  emails: EmailRecord[];
  status: "scheduled" | "sent";
}) {
  if (emails.length === 0) {
    return <p className="empty">No {status} emails yet.</p>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Email</th>
            <th>Subject</th>
            <th>{status === "sent" ? "Sent time" : "Scheduled time"}</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {emails.map((email) => (
            <tr key={email.id}>
              <td>{email.recipient}</td>
              <td>{email.subject}</td>
              <td>
                {new Date(
                  status === "sent" && email.sentAt
                    ? email.sentAt
                    : email.scheduledAt
                ).toLocaleString()}
              </td>
              <td>
                <span className={`badge ${email.status}`}>{email.status}</span>
                {email.error && <small>{email.error}</small>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
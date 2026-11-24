import type { EmailRecord } from "./types";

const API = "https://reachinbox-scheduler-ajqn.onrender.com";

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  picture: string | null;
};

export type SlackChannel = {
  id: string;
  name: string;
};

export type SlackStatus = {
  connected: boolean;
  connection: {
    teamName: string | null;
    channelId: string | null;
    connectedAt: string;
  } | null;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers
    }
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result.error ?? `Request failed (${response.status})`);
  }

  return result as T;
}

export function getCurrentUser() {
  return request<{ user: CurrentUser }>("/api/auth/me");
}

export function logout() {
  return request<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
}

export function getEmails(status: "scheduled" | "sent") {
  return request<EmailRecord[]>(`/api/emails?status=${status}`);
}

export function scheduleEmails(data: {
  recipients: string[];
  subject: string;
  body: string;
  startAt: string;
  delayBetweenMs: number;
  senderKey: string;
  hourlyLimit: number;
  fromName: string;
  fromEmail: string;
}) {
  return request<{ count: number }>("/api/emails/schedule", {
    method: "POST",
    body: JSON.stringify(data)
  });
}

export function searchEmails(
  query: string,
  status: "scheduled" | "sent"
) {
  const params = new URLSearchParams({ q: query, status });
  return request<EmailRecord[]>(`/api/emails/search?${params}`);
}

export function getSlackStatus() {
  return request<SlackStatus>("/api/slack/status");
}

export function getSlackChannels() {
  return request<{
    channels: SlackChannel[];
    selected: string | null;
  }>("/api/slack/channels");
}

export function saveSlackChannel(channelId: string) {
  return request<{ ok: boolean }>("/api/slack/channel", {
    method: "POST",
    body: JSON.stringify({ channelId })
  });
}

export function disconnectSlack() {
  return request<{ ok: boolean }>("/api/slack/disconnect", {
    method: "POST"
  });
}
import { prisma } from "../db";
import { redis } from "../redis";

const SLACK_API = "https://slack.com/api";

export async function notifyRateLimitHit(
  userId: string,
  senderKey: string
): Promise<void> {
  try {
    const connection = await prisma.slackConnection.findUnique({
      where: { userId }
    });

    if (!connection?.channelId) return;

    const hourWindow = Math.floor(Date.now() / 3_600_000);
    const dedupeKey = `slack-rate-alert:${userId}:${senderKey}:${hourWindow}`;

    // Send only one alert per user, sender, and hourly window.
    const reserved = await redis.set(dedupeKey, "1", "EX", 7200, "NX");
    if (reserved !== "OK") return;

    const response = await fetch(`${SLACK_API}/chat.postMessage`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${connection.accessToken}`,
        "Content-Type": "application/json; charset=utf-8"
      },
      body: JSON.stringify({
        channel: connection.channelId,
        text: `⚠️ The hourly email limit was reached for sender "${senderKey}". Remaining emails have been deferred to the next hourly window.`
      })
    });

    const result = (await response.json()) as {
      ok: boolean;
      error?: string;
    };

    if (!result.ok) {
      console.error("[slack] notification failed:", result.error);
    }
  } catch (error) {
    // A Slack outage must not stop email processing.
    console.error("[slack] notification error:", error);
  }
}

export async function listSlackChannels(accessToken: string) {
  const response = await fetch(
    `${SLACK_API}/conversations.list?types=public_channel&exclude_archived=true&limit=200`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  );

  const result = (await response.json()) as {
    ok: boolean;
    error?: string;
    channels?: Array<{
      id: string;
      name: string;
    }>;
  };

  if (!result.ok) {
    throw new Error(result.error ?? "Could not load Slack channels");
  }

  return (result.channels ?? []).map(({ id, name }) => ({ id, name }));
}
import crypto from "crypto";
import { Router } from "express";
import { config } from "../config";
import { prisma } from "../db";
import { requireAuth } from "../auth";
import { listSlackChannels } from "../services/slack";

export const slackRouter = Router();

const STATE_COOKIE = "slack_oauth_state";
const STATE_MAX_AGE = 10 * 60 * 1000;

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge,
    path: "/"
  };
}

function sameValue(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

slackRouter.get("/status", requireAuth, async (req, res, next) => {
  try {
    const connection = await prisma.slackConnection.findUnique({
      where: { userId: req.userId! },
      select: { teamName: true, channelId: true, connectedAt: true }
    });

    return res.json({
      connected: Boolean(connection),
      connection
    });
  } catch (error) {
    return next(error);
  }
});

slackRouter.get("/connect", requireAuth, (req, res) => {
  if (!config.slackClientId || !config.slackClientSecret) {
    return res.status(503).json({ error: "Slack OAuth is not configured" });
  }

  const state = crypto.randomBytes(32).toString("hex");
  res.cookie(STATE_COOKIE, state, cookieOptions(STATE_MAX_AGE));

  const params = new URLSearchParams({
    client_id: config.slackClientId,
    scope: "chat:write,channels:read",
    redirect_uri: config.slackRedirectUri,
    state
  });

  return res.redirect(`https://slack.com/oauth/v2/authorize?${params}`);
});

slackRouter.get("/callback", requireAuth, async (req, res, next) => {
  try {
    const state = req.query.state;
    const savedState = req.cookies?.[STATE_COOKIE];
    const code = req.query.code;

    res.clearCookie(STATE_COOKIE, { path: "/" });

    if (
      typeof state !== "string" ||
      typeof savedState !== "string" ||
      !sameValue(state, savedState) ||
      typeof code !== "string"
    ) {
      return res.redirect(`${config.frontendUrl}/?slackError=invalid_state`);
    }

    const response = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        client_id: config.slackClientId,
        client_secret: config.slackClientSecret,
        code,
        redirect_uri: config.slackRedirectUri
      })
    });

    const result = (await response.json()) as {
      ok: boolean;
      error?: string;
      access_token?: string;
      team?: { name?: string };
    };

    if (!result.ok || !result.access_token) {
      console.error("[slack] OAuth exchange failed:", result.error);
      return res.redirect(`${config.frontendUrl}/?slackError=exchange_failed`);
    }

    await prisma.slackConnection.upsert({
      where: { userId: req.userId! },
      update: {
        accessToken: result.access_token,
        teamName: result.team?.name ?? null,
        channelId: null
      },
      create: {
        userId: req.userId!,
        accessToken: result.access_token,
        teamName: result.team?.name ?? null
      }
    });

    return res.redirect(`${config.frontendUrl}/?slack=connected`);
  } catch (error) {
    return next(error);
  }
});

slackRouter.get("/channels", requireAuth, async (req, res, next) => {
  try {
    const connection = await prisma.slackConnection.findUnique({
      where: { userId: req.userId! }
    });

    if (!connection) {
      return res.status(404).json({ error: "Slack is not connected" });
    }

    const channels = await listSlackChannels(connection.accessToken);
    return res.json({
      channels,
      selected: connection.channelId
    });
  } catch (error) {
    return next(error);
  }
});

slackRouter.post("/channel", requireAuth, async (req, res, next) => {
  try {
    const channelId = req.body?.channelId;

    if (typeof channelId !== "string" || !channelId) {
      return res.status(400).json({ error: "channelId is required" });
    }

    const connection = await prisma.slackConnection.findUnique({
      where: { userId: req.userId! }
    });

    if (!connection) {
      return res.status(404).json({ error: "Slack is not connected" });
    }

    const channels = await listSlackChannels(connection.accessToken);
    if (!channels.some((channel) => channel.id === channelId)) {
      return res.status(400).json({ error: "Choose a channel the app belongs to" });
    }

    await prisma.slackConnection.update({
      where: { userId: req.userId! },
      data: { channelId }
    });

    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

slackRouter.post("/disconnect", requireAuth, async (req, res, next) => {
  try {
    await prisma.slackConnection.deleteMany({
      where: { userId: req.userId! }
    });

    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});
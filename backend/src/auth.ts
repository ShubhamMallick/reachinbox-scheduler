import crypto from "crypto";
import { Router, Request, Response, NextFunction } from "express";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "./db";
import { config } from "./config";

export const authRouter = Router();

const SESSION_COOKIE = "reachinbox_session";
const STATE_COOKIE = "google_oauth_state";
const SESSION_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const googleClient = new OAuth2Client(
  config.googleClientId,
  config.googleClientSecret,
  config.googleRedirectUri
);

function sign(value: string): string {
  return crypto
    .createHmac("sha256", config.sessionSecret)
    .update(value)
    .digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function makeSession(userId: string): string {
  const payload = Buffer.from(
    JSON.stringify({ userId, expiresAt: Date.now() + SESSION_AGE_MS })
  ).toString("base64url");

  return `${payload}.${sign(payload)}`;
}

function readSession(value?: string): string | null {
  if (!value) return null;

  const [payload, signature] = value.split(".");
  if (!payload || !signature || !safeEqual(signature, sign(payload))) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data.userId || data.expiresAt < Date.now()) return null;
    return data.userId as string;
  } catch {
    return null;
  }
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "none" as const,
    secure: true,
    maxAge,
    path: "/"
  };
}

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = readSession(req.cookies?.[SESSION_COOKIE]);
    
    // Fallback: check for session token in URL parameter
    if (!userId && req.query.session) {
      const urlToken = req.query.session as string;
      const fromUrl = readSession(urlToken);
      if (fromUrl) {
        req.userId = fromUrl;
        return next();
      }
    }
    
    if (!userId) return res.status(401).json({ error: "unauthenticated" });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(401).json({ error: "user_not_found" });

    req.userId = user.id;
    return next();
  } catch (error) {
    return next(error);
  }
}

authRouter.get("/google", (_req, res) => {
  if (!config.googleClientId || !config.googleClientSecret) {
    return res.status(503).json({ error: "Google OAuth is not configured" });
  }

  const state = crypto.randomBytes(32).toString("hex");
  res.cookie(STATE_COOKIE, state, cookieOptions(10 * 60 * 1000));

  const url = googleClient.generateAuthUrl({
    scope: ["openid", "email", "profile"],
    state,
    prompt: "select_account"
  });

  return res.redirect(url);
});

authRouter.get("/google/callback", async (req, res, next) => {
  try {
    const state = req.query.state;
    const code = req.query.code;
    const savedState = req.cookies?.[STATE_COOKIE];

    res.clearCookie(STATE_COOKIE, { path: "/" });

    if (
      typeof state !== "string" ||
      typeof savedState !== "string" ||
      !safeEqual(state, savedState) ||
      typeof code !== "string"
    ) {
      return res.redirect(`${config.frontendUrl}/?loginError=invalid_oauth_state`);
    }

    const { tokens } = await googleClient.getToken(code);
    if (!tokens.id_token) {
      return res.redirect(`${config.frontendUrl}/?loginError=missing_id_token`);
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: config.googleClientId
    });

    const profile = ticket.getPayload();
    if (!profile?.sub || !profile.email || profile.email_verified !== true) {
      return res.redirect(`${config.frontendUrl}/?loginError=unverified_google_account`);
    }

    const user = await prisma.user.upsert({
      where: { googleId: profile.sub },
      update: {
        email: profile.email,
        name: profile.name ?? profile.email,
        picture: profile.picture ?? null
      },
      create: {
        googleId: profile.sub,
        email: profile.email,
        name: profile.name ?? profile.email,
        picture: profile.picture ?? null
      }
    });

    const sessionToken = makeSession(user.id);
    res.cookie(SESSION_COOKIE, sessionToken, cookieOptions(SESSION_AGE_MS));
    return res.redirect(`${config.frontendUrl}?session=${sessionToken}`);
  } catch (error) {
    return next(error);
  }
});

authRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, email: true, name: true, picture: true }
    });

    if (!user) return res.status(401).json({ error: "user_not_found" });
    return res.json({ user });
  } catch (error) {
    return next(error);
  }
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
  return res.json({ ok: true });
});
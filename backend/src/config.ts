import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:5173",

  redisHost: process.env.REDIS_HOST ?? "localhost",
  redisPort: Number(process.env.REDIS_PORT ?? 6379),

  concurrency: Number(process.env.WORKER_CONCURRENCY ?? 5),
  minDelayMs: Number(process.env.MIN_DELAY_MS ?? 2000),
  maxEmailsPerHour: Number(process.env.MAX_EMAILS_PER_HOUR ?? 100),

  smtpHost: process.env.ETHEREAL_HOST ?? "smtp.ethereal.email",
  smtpPort: Number(process.env.ETHEREAL_PORT ?? 587),
  smtpUser: required("ETHEREAL_USER"),
  smtpPass: required("ETHEREAL_PASS"),
  emailFrom:
    process.env.EMAIL_FROM ?? "ReachInbox Demo <demo@example.com>",

  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  googleRedirectUri:
    process.env.GOOGLE_REDIRECT_URI ??
    "http://localhost:4000/api/auth/google/callback",

  slackClientId: process.env.SLACK_CLIENT_ID ?? "",
  slackClientSecret: process.env.SLACK_CLIENT_SECRET ?? "",
  slackRedirectUri:
    process.env.SLACK_REDIRECT_URI ??
    "http://localhost:4000/api/slack/callback",

  sessionSecret: required("SESSION_SECRET"),

  elasticsearchUrl: process.env.ELASTICSEARCH_URL ?? "http://localhost:9200",
  elasticsearchIndex: process.env.ELASTICSEARCH_INDEX ?? "scheduled-emails",

  bullBoardUser: process.env.BULL_BOARD_USER ?? "admin",
  bullBoardPassword: required("BULL_BOARD_PASSWORD")
};
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { config } from "./config";
import { emailsRouter } from "./routes/email";
import { healthRouter } from "./routes/health";
import { authRouter } from "./auth";
import { slackRouter } from "./routes/slack";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { emailQueue } from "./queue";
import type { Request, Response, NextFunction } from "express";

export const app = express();

app.use(cors({ origin: config.frontendUrl, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: "2mb" }));

app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/slack", slackRouter);
app.use("/api/emails", emailsRouter);

const bullBoardAdapter = new ExpressAdapter();
bullBoardAdapter.setBasePath("/admin/queues");

createBullBoard({
  queues: [new BullMQAdapter(emailQueue)],
  serverAdapter: bullBoardAdapter
});

function requireBullBoardAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization ?? "";

  if (header.startsWith("Basic ")) {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    const username = decoded.slice(0, separator);
    const password = decoded.slice(separator + 1);

    if (
      separator !== -1 &&
      username === config.bullBoardUser &&
      password === config.bullBoardPassword
    ) {
      return next();
    }
  }

  res.setHeader("WWW-Authenticate", 'Basic realm="BullMQ Dashboard"');
  return res.status(401).send("Authentication required");
}

app.use(
  "/admin/queues",
  requireBullBoardAuth,
  bullBoardAdapter.getRouter()
);

app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    if (error instanceof Error && error.name === "ZodError") {
      return res.status(400).json({ error: error.message });
    }
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
);
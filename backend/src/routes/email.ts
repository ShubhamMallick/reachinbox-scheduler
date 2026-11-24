import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { emailQueue } from "../queue";
import { requireAuth } from "../auth";
import {
  indexEmail,
  searchEmails
} from "../services/elasticsearch";
import { Prisma, Email } from "@prisma/client";

export const emailsRouter = Router();
emailsRouter.use(requireAuth);

const scheduleSchema = z.object({
  recipients: z.array(z.string().email()).min(1),
  subject: z.string().min(1),
  body: z.string().min(1),
  startAt: z.string().datetime(),
  delayBetweenMs: z.number().int().min(0).default(0),
  senderKey: z.string().trim().min(1).max(100).default("default"),
  hourlyLimit: z.number().int().min(1).max(100000).default(100),
  fromName: z.string().trim().min(1).max(100).default("ReachInbox Demo"),
  fromEmail: z.string().email().default("demo@example.com")
});

emailsRouter.post("/schedule", async (req, res, next) => {
  try {
    const input = scheduleSchema.parse(req.body);
    const start = new Date(input.startAt);

    if (start.getTime() <= Date.now()) {
      return res.status(400).json({ error: "startAt must be in the future" });
    }

    const created = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const records: Email[] = [];

      for (let i = 0; i < input.recipients.length; i++) {
        const scheduledAt = new Date(
          start.getTime() + i * input.delayBetweenMs
        );

        const email = await tx.email.create({
          data: {
            userId: req.userId!,
            recipient: input.recipients[i],
            subject: input.subject,
            body: input.body,
            senderKey: input.senderKey,
            hourlyLimit: input.hourlyLimit,
            fromName: input.fromName,
            fromEmail: input.fromEmail,
            scheduledAt
          }
        });

        records.push(email);
      }

      return records;
    });

    await Promise.all(
      created.map((email: Email) =>
        emailQueue.add(
          "send",
          { emailId: email.id },
          {
            jobId: email.id,
            delay: Math.max(0, email.scheduledAt.getTime() - Date.now()),
            attempts: 5,
            backoff: { type: "exponential", delay: 3000 },
            removeOnComplete: 1000,
            removeOnFail: 5000
          }
        )
      )
    );

    await Promise.all(created.map((email: Email) => indexEmail(email.id)));

    return res.status(201).json({ count: created.length, emails: created });
  } catch (error) {
    return next(error);
  }
});

emailsRouter.get("/search", async (req, res, next) => {
  try {
    const query = String(req.query.q ?? "");
    const status = req.query.status === "sent" ? "sent" : "scheduled";
    const results = await searchEmails(req.userId!, query, status);
    return res.json(results);
  } catch (error) {
    return next(error);
  }
});

emailsRouter.get("/", async (req, res, next) => {
  try {
    const status = req.query.status === "sent" ? "sent" : "scheduled";
    const emails = await prisma.email.findMany({
      where: { userId: req.userId!, status },
      orderBy:
        status === "sent" ? { sentAt: "desc" } : { scheduledAt: "asc" },
      take: 500
    });

    return res.json(emails);
  } catch (error) {
    return next(error);
  }
});
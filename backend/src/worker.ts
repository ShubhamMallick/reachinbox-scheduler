import { Worker, Job, DelayedError } from "bullmq";
import { config } from "./config";
import { prisma } from "./db";
import { redis } from "./redis";
import { emailQueue, SendEmailJob } from "./queue";
import { sendEmail } from "./email-sender";
import { reserveHourlySlot } from "./rate-limiter";
import { notifyRateLimitHit } from "./services/slack";
import { indexEmail } from "./services/elasticsearch";

async function reconcileScheduledEmails() {
  const emails = await prisma.email.findMany({
    where: { status: "scheduled" },
    select: { id: true, scheduledAt: true }
  });

  let requeued = 0;

  for (const email of emails) {
    const existingJob = await emailQueue.getJob(email.id);

    if (existingJob) {
      const state = await existingJob.getState();

      if (!["completed", "failed"].includes(state)) {
        continue;
      }

      await existingJob.remove();
    }

    await emailQueue.add(
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
    );

    requeued++;
  }

  console.log(
    `[reconcile] checked ${emails.length} scheduled emails; requeued ${requeued}`
  );
}

const worker = new Worker<SendEmailJob>(
  "emails",
  async (job: Job<SendEmailJob>, token?: string) => {
    const email = await prisma.email.findUnique({
      where: { id: job.data.emailId }
    });

    if (!email || email.status === "sent") return;

    const hasSlot = await reserveHourlySlot(
      email.senderKey,
      email.hourlyLimit
    );

    if (!hasSlot) {
      if (email.userId) {
        await notifyRateLimitHit(email.userId, email.senderKey);
      }

      const nextHour =
        Math.floor(Date.now() / 3_600_000) * 3_600_000 + 3_600_000;

      await job.moveToDelayed(nextHour, token);
      throw new DelayedError();
    }

    // Only one worker can claim this email for sending.
    const claim = await prisma.email.updateMany({
      where: {
        id: email.id,
        status: { in: ["scheduled", "failed"] }
      },
      data: { status: "processing", error: null }
    });

    if (claim.count === 0) return;

    await indexEmail(email.id);

    try {
      await sendEmail(
        email.recipient,
        email.subject,
        email.body,
        email.fromName,
        email.fromEmail
      );

      await prisma.email.update({
        where: { id: email.id },
        data: { status: "sent", sentAt: new Date() }
      });

      await indexEmail(email.id);
    } catch (error) {
      await prisma.email.update({
        where: { id: email.id },
        data: {
          status: "failed",
          error: error instanceof Error ? error.message : "Send failed"
        }
      });

      await indexEmail(email.id);
      throw error;
    }
  },
  {
    connection: redis,
    concurrency: config.concurrency,
    limiter: {
      max: 1,
      duration: Math.max(1, config.minDelayMs)
    }
  }
);

worker.on("completed", (job) => console.log(`Completed ${job.id}`));

worker.on("failed", (job, error) =>
  console.error(`Failed ${job?.id}: ${error.message}`)
);

async function main() {
  await reconcileScheduledEmails();
  console.log(`Email worker running with concurrency ${config.concurrency}`);
}

main().catch((error) => {
  console.error("[worker] startup failed:", error);
});
import { Queue } from "bullmq";
import { redis } from "./redis";

export type SendEmailJob = {
  emailId: string;
};

export const emailQueue = new Queue<SendEmailJob>("emails", {
  connection: redis
});
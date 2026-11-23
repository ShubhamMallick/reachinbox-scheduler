export type EmailRecord = {
  id: string;
  userId: string | null;
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: string;
  sentAt: string | null;
  status: string;
  error: string | null;
};
import { Client } from "@elastic/elasticsearch";
import { config } from "../config";
import { prisma } from "../db";

const client = new Client({ node: config.elasticsearchUrl });
const indexName = config.elasticsearchIndex;

type EmailDocument = {
  emailId: string;
  userId: string;
  recipient: string;
  subject: string;
  body: string;
  senderKey: string;
  status: string;
  scheduledAt: string;
  sentAt: string | null;
};

export async function ensureEmailIndex(): Promise<void> {
  const exists = await client.indices.exists({ index: indexName });
  if (exists) return;

  try {
    await client.indices.create({
      index: indexName,
      mappings: {
        properties: {
          emailId: { type: "keyword" },
          userId: { type: "keyword" },
          recipient: { type: "text" },
          subject: { type: "text" },
          body: { type: "text" },
          senderKey: { type: "keyword" },
          status: { type: "keyword" },
          scheduledAt: { type: "date" },
          sentAt: { type: "date" }
        }
      }
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "meta" in error &&
      (error as { meta?: { statusCode?: number } }).meta?.statusCode === 400
    ) {
      return;
    }
    throw error;
  }
}

export async function indexEmail(emailId: string): Promise<void> {
  try {
    await ensureEmailIndex();

    const email = await prisma.email.findUnique({
      where: { id: emailId }
    });

    if (!email?.userId) return;

    const document: EmailDocument = {
      emailId: email.id,
      userId: email.userId,
      recipient: email.recipient,
      subject: email.subject,
      body: email.body,
      senderKey: email.senderKey,
      status: email.status,
      scheduledAt: email.scheduledAt.toISOString(),
      sentAt: email.sentAt?.toISOString() ?? null
    };

    await client.index({
      index: indexName,
      id: email.id,
      document,
      refresh: "wait_for"
    });
  } catch (error) {
    console.error("[elasticsearch] indexing failed:", error);
  }
}

export async function searchEmails(
  userId: string,
  query: string,
  status: "scheduled" | "sent"
) {
  await ensureEmailIndex();

  const result = await client.search<EmailDocument>({
    index: indexName,
    size: 100,
    query: {
      bool: {
        filter: [
          { term: { userId } },
          { term: { status } }
        ],
        must: query.trim()
          ? [
              {
                multi_match: {
                  query: query.trim(),
                  fields: ["recipient", "subject", "body", "senderKey"]
                }
              }
            ]
          : [{ match_all: {} }]
      }
    },
    sort: [{ scheduledAt: "desc" }]
  });

  return result.hits.hits.flatMap((hit) => {
    const email = hit._source;
    if (!email) return [];

    return [{
      id: email.emailId,
      recipient: email.recipient,
      subject: email.subject,
      body: email.body,
      scheduledAt: email.scheduledAt,
      sentAt: email.sentAt,
      status: email.status,
      error: null
    }];
  });
}

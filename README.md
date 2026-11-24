# ReachInbox Scheduler

A full-stack email scheduling app with delayed delivery, per-sender hourly limits, Slack alerts, email search, BullMQ queue dashboard, and day/night theme support.

## Features

- Sign in with Google
- Upload recipients from a CSV or text file
- Schedule emails with a start time and delay between messages
- Configure sender name, sender email, sender key, and hourly limit
- Send through Ethereal SMTP for development
- Defer queued emails when a sender reaches its hourly limit
- Send Slack alerts when an hourly limit is reached
- Search email records through Elasticsearch
- Inspect the BullMQ queue in Bull Board (accessible from the dashboard header)
- Dark/light theme toggle with persistent preference
- Responsive design with animations and transitions

## Requirements

- Node.js and npm
- Docker Desktop
- Google OAuth credentials
- A Slack app installed in a Slack workspace
- Ethereal SMTP credentials

## Start the supporting services

From the project root, start PostgreSQL, Redis, and Elasticsearch:

```bash
docker compose up -d
```

Confirm Elasticsearch is available at `http://localhost:9200`.

## Configure environment variables

Create `backend/.env` (or use the location your backend and Prisma setup already load) with values for your local environment:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/scheduler
REDIS_HOST=localhost
REDIS_PORT=6379

PORT=4000
FRONTEND_URL=http://localhost:5173
API_URL=http://localhost:4000

ETHEREAL_HOST=smtp.ethereal.email
ETHEREAL_PORT=587
ETHEREAL_USER=your-ethereal-username
ETHEREAL_PASS=your-ethereal-password
EMAIL_FROM=ReachInbox Demo <demo@example.com>

WORKER_CONCURRENCY=5
MIN_DELAY_MS=2000
MAX_EMAILS_PER_HOUR=100

GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:4000/api/auth/google/callback
SESSION_SECRET=replace-with-a-long-random-secret

SLACK_CLIENT_ID=your-slack-client-id
SLACK_CLIENT_SECRET=your-slack-client-secret
SLACK_REDIRECT_URI=http://localhost:4000/api/slack/callback

ELASTICSEARCH_URL=http://localhost:9200

BULL_BOARD_USER=admin
BULL_BOARD_PASSWORD=replace-with-a-strong-password
```

Use your existing Slack and Google variable names if they differ from this example. Keep real credentials out of source control; add `.env` files to `.gitignore`.

For local testing, you can generate a session secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Set up the database

From the project root:

```bash
npm install
npm run db:migrate --workspace backend
```

If your Prisma schema has changed and the generated client is stale, run:

```bash
npm run db:generate --workspace backend
```

## Start the application

Open separate terminals from the project root. Start the backend, frontend, and email worker using the scripts defined in the root and workspace `package.json` files. For example, if these scripts are present:

```bash
npm run dev --workspace backend
npm run dev --workspace frontend
npm run worker --workspace backend
```

Keep the worker running while you schedule emails. If a script name differs in your project, use the corresponding script from that workspace’s `package.json`.

Open the frontend at `http://localhost:5173`.

## Connect Google sign-in

In Google Cloud Console, configure the OAuth client as a **Web application** and add this authorized redirect URI:

```text
http://localhost:4000/api/auth/google/callback
```

The Google OAuth client ID and secret must match the values in the backend environment file.

## Connect Slack notifications

In your Slack app settings:

1. Add the redirect URL configured by `SLACK_REDIRECT_URI`.
2. Enable the bot scopes `channels:read` and `chat:write`.
3. Reinstall the app to the workspace after changing scopes.
4. Invite the app into the channel where alerts should be posted.
5. Connect Slack in the scheduler and select the alert channel.

When a sender reaches its hourly limit, remaining emails are deferred to the next hourly window. Slack alerts are deduplicated for each sender and hourly window.

## Schedule an email

1. Sign in to the scheduler.
2. Upload a CSV or text file containing recipient email addresses.
3. Enter a subject and message body.
4. Choose a start time in the future.
5. Set the delay between messages and the sender’s hourly limit.
6. Optionally enter the sender name and email address.
7. Select **Schedule emails**.

Use an Ethereal mailbox to inspect outgoing test messages. Ethereal is for development and testing; it does not deliver to real recipients.

## Search email records

Use the search field in the dashboard to search email records by recipient, subject, or body. The backend stores searchable email data in Elasticsearch.

## Bull Board

Open:

```text
http://localhost:4000/admin/queues
```

Sign in using the `BULL_BOARD_USER` and `BULL_BOARD_PASSWORD` values from the backend environment file. Bull Board displays queue and job status; it does not schedule messages itself.

## Useful commands

```bash
docker compose up -d
docker compose down
npm run db:migrate --workspace backend
npm run db:generate --workspace backend
```

## Notes

- Keep the API, frontend, database, Redis, Elasticsearch, and worker running during local use.
- If you change environment variables, restart the relevant backend or worker process.
- Do not commit credentials, OAuth secrets, SMTP passwords, session secrets, or Bull Board passwords.
- SMTP delivery and database updates cannot be made into one atomic operation. If the process stops after an SMTP server accepts a message but before the database records it as sent, delivery status may be uncertain.
- This project is configured for local development. Before deployment, use managed services and production credentials, configure HTTPS and secure cookies, and review OAuth redirect URLs and access controls.
# 📘 PipelineHub — Comprehensive Setup, Migration, Debugging & Testing Guide

This guide provides complete, end-to-end instructions to configure, migrate, run, debug, and test the **PipelineHub** backend ecosystem (Express, MongoDB, Redis/BullMQ, OAuth, and GitHub Webhooks).

---

## 📑 Table of Contents
1. [System Architecture & Requirements](#1-system-architecture--requirements)
2. [Environment Configuration (.env)](#2-environment-configuration-env)
3. [Database Management & Migration](#3-database-management--migration)
   - [Local MongoDB vs Docker MongoDB](#local-mongodb-vs-docker-mongodb)
   - [Connecting MongoDB Compass](#connecting-mongodb-compass)
   - [Atlas to Local Migration Script](#atlas-to-local-data-migration-script)
4. [Redis & Background Queues (BullMQ)](#4-redis--background-queues-bullmq)
5. [Running the Application](#5-running-the-application)
   - [Local Development Mode](#a-local-development-mode-recommended)
   - [Docker Compose Mode](#b-docker-compose-mode)
   - [Exposing Webhooks via Ngrok](#c-exposing-webhooks-via-ngrok)
6. [OAuth Setup & Provider Configuration](#6-oauth-setup--provider-configuration)
7. [API Testing & Postman Workflows](#7-api-testing--postman-workflows)
   - [1. Authentication & Cookie Capture](#1-authentication--cookie-capture)
   - [2. Connect a Repository](#2-connect-a-repository)
   - [3. List User Repositories](#3-list-user-repositories)
   - [4. Ingest & Verify Webhook Events](#4-ingest--verify-webhook-events)
8. [Comprehensive Troubleshooting & Debugging](#8-comprehensive-troubleshooting--debugging)

---

## 1. System Architecture & Requirements

### Tech Stack
- **Runtime:** Node.js (v18+)
- **Framework:** Express.js
- **Database:** MongoDB (Local, Docker, or Atlas)
- **Job Queue:** Redis (v7+) + BullMQ
- **Authentication:** JWT via HTTP-only Cookies & OAuth 2.0 (GitHub, GitLab, Bitbucket)
- **API Documentation:** Swagger UI at `http://localhost:3000/api-docs`

### Prerequisites
- Node.js installed (`node -v`)
- MongoDB installed locally or Docker installed (`docker -v`)
- Redis installed locally or running via Docker
- Ngrok CLI installed (`ngrok --version`)
- MongoDB Compass installed

---

## 2. Environment Configuration (.env)

Create a `.env` file in the root directory. Use the following template:

```env
# ==========================================
# Server Configuration
# ==========================================
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:3000

# ==========================================
# Database & Cache
# ==========================================
# For Local MongoDB:
MONGODB_URI=mongodb://127.0.0.1:27017/pipelinehub

# For Redis (BullMQ Queues):
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# ==========================================
# Security & JWT
# ==========================================
JWT_SECRET=supersecretjwtkey_replace_in_production
WEBHOOK_SECRET=supersecretstring

# ==========================================
# Public Domain (For GitHub Webhook Deliveries)
# Update this with your active ngrok URL
# ==========================================
PUBLIC_DOMAIN=https://your-active-subdomain.ngrok-free.app

# ==========================================
# GitHub OAuth App Credentials
# ==========================================
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# ==========================================
# GitLab OAuth App Credentials
# ==========================================
GITLAB_CLIENT_ID=your_gitlab_client_id
GITLAB_CLIENT_SECRET=your_gitlab_client_secret
GITLAB_REDIRECT_URI=http://localhost:3000/auth/gitlab/callback

# ==========================================
# Bitbucket OAuth App Credentials
# ==========================================
BITBUCKET_CLIENT_ID=your_bitbucket_client_id
BITBUCKET_CLIENT_SECRET=your_bitbucket_client_secret
BITBUCKET_REDIRECT_URI=http://localhost:3000/auth/bitbucket/callback

# ==========================================
# Notifications & Email (Optional)
# ==========================================
SLACK_WEBHOOK_URL=
EMAILJS_PUBLIC_KEY=
EMAILJS_PRIVATE_KEY=
```

---

## 3. Database Management & Migration

### Local MongoDB vs Docker MongoDB
You can run MongoDB either natively on Windows or via Docker:

#### Option A: Running MongoDB with Docker
```bash
# Start MongoDB container only
docker compose up -d mongodb

# Verify container is running
docker ps
```

#### Option B: Native Windows MongoDB Service
Ensure the `MongoDB` Windows service is running in Services (`services.msc`) or started via PowerShell:
```powershell
net start MongoDB
```

---

### Connecting MongoDB Compass
1. Open **MongoDB Compass**.
2. Paste the connection string:
   ```text
   mongodb://127.0.0.1:27017
   ```
3. Click **Connect**.
4. Database name: **`pipelinehub`**
5. **Key Collections:**
   - `users`: Registered and OAuth-authenticated users.
   - `oauthaccounts`: Stores OAuth access tokens (`accessToken`), provider user IDs, and profile links.
   - `repositories`: Connected repositories with their dedicated `webhookSecret` and branches.
   - `webhookkeys`: Dynamic routing keys mapping `/webhook/:platform/:key` to specific users.
   - `events` & `event2`: Incoming normalized webhook events (push, pull_request, merge).
   - `pipelineruns`: Queue execution records and pipeline status.
   - `contributors`: Contributor metrics and activity tracking.

> **Note:** MongoDB creates the `pipelinehub` database automatically upon inserting the first record. Empty databases are hidden by default in Compass.

---

### Atlas to Local Data Migration Script
If your previous data was saved on MongoDB Atlas (e.g. in database `test`), run this script to clone all collections into your local MongoDB:

```bash
node -e "
const mongoose = require('mongoose');
(async () => {
  const atlasUri = // here mongodb uri of cloud;
  const localUri = 'mongodb://127.0.0.1:27017/pipelinehub';

  console.log('Connecting to Atlas & Local MongoDB...');
  const atlas = await mongoose.createConnection(atlasUri).asPromise();
  const local = await mongoose.createConnection(localUri).asPromise();

  const collections = await atlas.db.listCollections().toArray();
  for (const col of collections) {
    const docs = await atlas.db.collection(col.name).find({}).toArray();
    if (docs.length > 0) {
      await local.db.collection(col.name).deleteMany({});
      await local.db.collection(col.name).insertMany(docs);
      console.log('✔ Migrated', docs.length, 'documents in collection:', col.name);
    }
  }
  console.log('🎉 Migration to local MongoDB successfully completed!');
  process.exit(0);
})().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
"
```

---

## 4. Redis & Background Queues (BullMQ)

PipelineHub uses BullMQ workers to process events asynchronously. Redis must be running.

### Start Redis via Docker
```bash
docker compose up -d redis
```
Verify Redis is accepting connections:
```bash
docker exec -it pipelinehub_redis redis-cli ping
# Expected Output: PONG
```

### Active BullMQ Queues & Workers
- **`webhook-events`** (`webhookWorker.js`): Ingests raw webhook payload, updates contributor metrics, and stores normalized event docs.
- **`pipeline-queue`** (`pipelineWorker.js`): Manages pipeline stages, build steps, and execution statuses.
- **`notification-queue`** (`notificationWorker.js`): Handles Slack/Email alerts.
- **`outgoing-webhook-queue`** (`outgoingWebhookWorker.js`): Dispatches outgoing webhooks to third-party receivers.

---

## 5. Running the Application

### A. Local Development Mode (Recommended)

1. **Install Dependencies:**
   ```bash
   npm install
   ```
2. **Start Redis & MongoDB:**
   ```bash
   docker compose up -d mongodb redis
   ```
3. **Start the Express API Server:**
   ```bash
   node server.js
   # or with nodemon for auto-reload:
   npx nodemon server.js
   ```
   **Expected Terminal Output:**
   ```text
   Connected to MongoDB
   Server running on port 3000
   ```

---

### B. Docker Compose Mode

To run all backend services in isolated containers:
```bash
# Build and run all services (app, mongodb, redis)
docker compose up --build -d

# View real-time logs
docker compose logs -f app
```

---

### C. Exposing Webhooks via Ngrok

GitHub cannot send webhook HTTP POST events to `localhost:3000`. You must expose port 3000 to the internet using `ngrok`:

1. Start ngrok on port 3000:
   ```bash
   ngrok http 3000
   ```
2. Copy the **Forwarding URL** (e.g., `https://1234-56-78.ngrok-free.app`).
3. Update `PUBLIC_DOMAIN` in `.env`:
   ```env
   PUBLIC_DOMAIN=https://1234-56-78.ngrok-free.app
   ```
4. Restart your backend server.

---

## 6. OAuth Setup & Provider Configuration

### GitHub OAuth App Settings
1. Go to **GitHub -> Settings -> Developer settings -> OAuth Apps -> [Your App]**.
2. Set **Homepage URL**:
   ```text
   http://localhost:5173
   ```
3. Set **Authorization callback URL**:
   ```text
   http://localhost:3000/auth/github/callback
   ```
4. Ensure `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` match your `.env`.

> **Important Scopes:** When logging in via GitHub, the app requests `scope=user:email,repo,admin:repo_hook` so it has permission to automatically create webhooks on your repositories.

---

## 7. API Testing & Postman Workflows

### 1. Authentication & Cookie Capture

#### Via Browser (OAuth):
1. In your browser, open `http://localhost:3000/auth/github`.
2. Authorize the application on GitHub.
3. You will be redirected back to `FRONTEND_URL` with a `token` cookie set.
4. Press `F12` -> **Application** -> **Cookies** -> `http://localhost:3000` -> copy the value of **`token`**.

#### Via Postman (Direct Email/Password Login):
- **Method:** `POST`
- **URL:** `http://localhost:3000/auth/login`
- **Body (raw JSON):**
  ```json
  {
    "email": "user@example.com",
    "password": "yourpassword"
  }
  ```
- Copy the JWT token returned in the response.

### 2. Fetch Available Repositories (From GitHub)

Fetches all remote repositories accessible by the user's GitHub account and marks which ones are already connected to PipelineHub.

- **Method:** `GET`
- **URL:** `http://localhost:3000/repo/available/github`
- **Headers:**
  - `Cookie: token=<YOUR_JWT_TOKEN>`
- **Expected Response (`200 OK`):**
  ```json
  {
    "success": true,
    "count": 5,
    "repos": [
      {
        "id": "1003710391",
        "name": "PipelineHub",
        "fullName": "VoyagerX21/PipelineHub",
        "defaultBranch": "main",
        "isPrivate": false,
        "description": "CI/CD & Webhook Orchestration Hub",
        "htmlUrl": "https://github.com/VoyagerX21/PipelineHub",
        "alreadyConnected": false
      }
    ]
  }
  ```

---

### 3. Connect a Repository

Auto-configures the webhook on GitHub and registers the repo in MongoDB.

- **Method:** `POST`
- **URL:** `http://localhost:3000/repo/connect`
- **Headers:**
  - `Content-Type: application/json`
  - `Cookie: token=<YOUR_JWT_TOKEN>`
- **Body (raw JSON):**
  ```json
  {
    "provider": "github",
    "fullName": "YourGitHubUsername/YourRepositoryName"
  }
  ```
- **Expected Response (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Repository connected and webhook configured successfully.",
    "repository": {
      "_id": "66a846...",
      "provider": "github",
      "fullName": "YourGitHubUsername/YourRepositoryName",
      "externalRepoId": "1003710391",
      "defaultBranch": "main",
      "isPrivate": false,
      "webhookSecret": "4a27bad5..."
    }
  }
  ```

---

### 3. List User Repositories

- **Method:** `GET`
- **URL:** `http://localhost:3000/repo/list/:userId`
- **Headers:**
  - `Cookie: token=<YOUR_JWT_TOKEN>`

---

### 4. Ingest & Verify Webhook Events

#### Real Event (GitHub Push / PR):
1. Push a commit to your connected GitHub repository:
   ```bash
   git commit --allow-empty -m "Trigger PipelineHub"
   git push origin main
   ```
2. Check your backend terminal logs:
   ```text
   [github] Signature verification: Match: true
   [github] Event push queued for processing
   [Worker] Processing push event for github
   [PROCESSOR] Processing event: push
   [PIPELINE] Pipeline job queued successfully
   [Worker] Successfully processed push event for github
   ```

#### View Webhook Delivery History:
- **Method:** `GET`
- **URL:** `http://localhost:3000/webhook/status`
- **Response:** Lists past processed events, commit shas, branches, and statuses.

---

## 8. Comprehensive Troubleshooting & Debugging

| Issue / Error | Root Cause | Solution |
| :--- | :--- | :--- |
| **CORS Error in Browser** | Frontend calling an unreachable URL (expired ngrok, missing port) or calling ngrok without skip header. | Set `VITE_API_URL=http://localhost:3000` in frontend. Frontend should always call `localhost`, not ngrok. |
| **No Cookie Saved After OAuth** | `secure: true` & `sameSite: "none"` rejected on plain HTTP `localhost`. | Use `secure: process.env.NODE_ENV === "production"` and `sameSite: isProduction ? "none" : "lax"`. |
| **GitHub: `Bad credentials` (401)** | `OAuthAccount` record in MongoDB contains an old or revoked `accessToken`. | Re-login via `http://localhost:3000/auth/github` to refresh and save the new access token to MongoDB. |
| **Webhook 401: `Signature verification failed`** | Webhook secret mismatch or repo lookup failed by `externalRepoId`. | Look up repo by both `externalRepoId` and `fullName` to retrieve the dynamic `repo.webhookSecret`. |
| **`Custom Id cannot contain :`** | BullMQ restricts custom job IDs containing colons (`:`). | Change custom `jobId` from `pipeline:${id}` to `pipeline-${id}` in `src/services/pipelineEngine.js`. |
| **Database `pipelinehub` missing in Compass** | MongoDB only shows databases on disk after the first write operation. | Trigger a login or repo connection, or run the migration script, then click Refresh in Compass. |
| **Redis `ECONNREFUSED`** | Redis server container is not running on port 6379. | Run `docker compose up -d redis` or start your local Redis server. |

---

## 🚀 Summary Checklist for Clean Startup

1. `docker compose up -d mongodb redis`
2. `ngrok http 3000` -> Copy URL to `PUBLIC_DOMAIN` in `.env`
3. Verify `MONGODB_URI=mongodb://127.0.0.1:27017/pipelinehub`
4. Run `node server.js`
5. Visit `http://localhost:3000/auth/github` to authenticate
6. Send `POST /repo/connect` in Postman
7. Push to GitHub repo -> Watch BullMQ pipeline runs execute in real time!

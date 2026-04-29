# Contributor Tracking System - Implementation Guide

## Problem Statement
Previously, the system only tracked the repository owner, not the actual pushers/contributors. When Arnav (a contributor) pushes to a repository owned by someone else, the system couldn't distinguish that Arnav made the push—it only showed the owner. This made it impossible to:
- Track who actually contributed to a repository
- See contribution statistics per person
- Show top contributors
- Allow contributors to see their own contribution history

## Solution Overview
The new contributor tracking system automatically:
1. **Extracts pusher information** from webhooks (GitHub, GitLab, Bitbucket)
2. **Auto-creates user accounts** for unknown contributors
3. **Links push events to actual pushers** (not just repository owners)
4. **Tracks contribution statistics** per user per repository
5. **Provides analytics endpoints** to view contributors and their stats

## Architecture Changes

### 1. Data Models

#### **Contributor Model** (`src/models/Contributor.js`)
Tracks contributions by a user in a specific repository:
```javascript
{
  userId: Reference to User,
  repositoryId: Reference to Repository,
  platform: 'github' | 'gitlab' | 'bitbucket',
  platformUsername: String,           // The pusher's username on the platform
  commitCount: Number,                 // Total commits by this user
  pullRequestCount: Number,            // Total PRs by this user
  branchesCreated: [String],          // Branches created by this user
  lastContributedAt: Date,
  firstContributedAt: Date
}
```

**Example Scenario:**
- Arnav pushes 3 commits to owner's repo
- System creates Arnav's user account
- System creates Contributor record: userId=Arnav, repositoryId=owner's-repo, commitCount=3
- Owner can now see Arnav in the top contributors list

#### **Event Model** (Updated - `src/models/Event.js`)
Now links to the actual pusher:
```javascript
{
  pusherId: Reference to User,        // WHO made the push (NEW!)
  pusherName: String,                 // Pusher's name for quick reference
  repositoryId: Reference to Repository,  // WHICH repository (NEW!)
  // ... other fields
}
```

#### **User Model** (Already exists - `src/models/User.js`)
Stores user information - now automatically populated from webhooks:
```javascript
{
  name: String,
  email: String (unique),
  avatarUrl: String,
  bio: String,
  location: String
}
```

### 2. New Utility: Pusher Extraction (`src/utils/extractPusher.js`)
Normalizes pusher information across three platforms:

**GitHub Webhook:**
```javascript
{
  pusher: {
    name: "Arnav",
    login: "arnav123",
    email: "arnav@example.com",
    avatar_url: "...",
    id: 12345
  }
}
```

**GitLab Webhook:**
```javascript
{
  user_username: "arnav123",
  user_name: "Arnav",
  user_email: "arnav@example.com",
  user_avatar: "...",
  user_id: 12345
}
```

**Bitbucket Webhook:**
```javascript
{
  push: {
    changes: [{
      new: {
        target: {
          author: {
            display_name: "Arnav",
            username: "arnav123",
            uuid: "...",
            // ...
          }
        }
      }
    }]
  }
}
```

The extraction utility normalizes all three formats into:
```javascript
{
  name: "Arnav",
  username: "arnav123",
  email: "arnav@example.com",
  avatarUrl: "...",
  platformId: "12345",
  platform: "github"  // or "gitlab", "bitbucket"
}
```

### 3. Contributor Service (`src/services/contributorService.js`)
Core logic for user and contribution management:

#### **findOrCreateUserFromPusher(payload, platform)**
- Extracts pusher info from webhook
- Searches for existing user by email or username
- **Auto-creates account if user doesn't exist**
- Updates avatar/name if needed
- Returns User document

**Flow:**
```
Webhook arrives → Extract pusher info → Search for user by email
  ↓
  Found? → Use existing user
  Not found? → Create new user account
  ↓
  Return user with _id
```

#### **trackContribution(userId, repositoryId, platform, platformUsername, eventType)**
- Finds or creates Contributor record
- Increments commitCount or pullRequestCount
- Updates lastContributedAt
- Returns Contributor document

#### **getTopContributors(repositoryId, limit)**
- Returns top N contributors sorted by commitCount
- Populated with full User and Repository info
- Used for "Top Contributors" views

#### **getContributorStats(userId, repositoryId)**
- Returns contribution details for a specific user in a repository
- Shows commit count, PR count, dates

### 4. Webhook Controller Updates (`src/controllers/webhookController.js`)
Integration points:
```javascript
// When webhook arrives:
1. Extract pusher: const pusherUser = await findOrCreateUserFromPusher(json, platform)
2. Track contribution: await trackContribution(pusherUser._id, repositoryId, platform, ...)
3. Create event with pusher link: Event.create({ pusherId: pusherUser._id, ... })
```

### 5. Analytics Endpoints (`src/controllers/contributorAnalytics.js` and `src/routes/contributorAnalytics.js`)

#### **GET /api/analytics/repository/:repositoryId/top-contributors?limit=10**
```json
{
  "repository": { "id": "...", "name": "my-repo", "fullName": "owner/my-repo" },
  "topContributors": [
    {
      "name": "Arnav",
      "email": "arnav@example.com",
      "platformUsername": "arnav123",
      "commits": 45,
      "pullRequests": 3,
      "lastContributed": "2026-04-06T10:30:00Z"
    },
    {
      "name": "Owner",
      "email": "owner@example.com",
      "platformUsername": "owner123",
      "commits": 120,
      "pullRequests": 15,
      "lastContributed": "2026-04-06T12:00:00Z"
    }
  ],
  "total": 2
}
```

#### **GET /api/analytics/user/:userId/repositories**
Shows all repositories where this user has contributed:
```json
{
  "userId": "...",
  "userName": "Arnav",
  "repositoriesContributedTo": [
    {
      "repository": { "id": "...", "name": "project1" },
      "commits": 45,
      "pullRequests": 3,
      "lastContributed": "2026-04-06T10:30:00Z"
    }
  ],
  "totalCommits": 45,
  "totalPullRequests": 3
}
```

#### **GET /api/analytics/contributor/:userId/:repositoryId**
Detailed stats for a specific contributor:
```json
{
  "contributor": { "name": "Arnav", "email": "...", "platformUsername": "..." },
  "repository": { "name": "project1", "fullName": "owner/project1" },
  "statistics": {
    "commitCount": 45,
    "pullRequestCount": 3,
    "branchesCreated": ["feature/new-ui", "fix/bug123"],
    "firstContributedAt": "2026-03-01T00:00:00Z",
    "lastContributedAt": "2026-04-06T10:30:00Z"
  }
}
```

#### **GET /api/analytics/repository/:repositoryId/summary**
Complete breakdown of all contributions:
```json
{
  "repository": { "name": "my-repo" },
  "summary": {
    "totalContributors": 2,
    "totalCommits": 165,
    "totalPullRequests": 18,
    "contributorBreakdown": [
      {
        "name": "Owner",
        "commits": 120,
        "commitPercentage": "72.73%",
        "lastContributed": "2026-04-06T12:00:00Z"
      },
      {
        "name": "Arnav",
        "commits": 45,
        "commitPercentage": "27.27%",
        "lastContributed": "2026-04-06T10:30:00Z"
      }
    ]
  }
}
```

## Use Cases Solved

### Use Case 1: "How will we see TOP CONTRIBUTORS?"
**Answer:** Call `GET /api/analytics/repository/:repositoryId/top-contributors`
- Returns list sorted by commitCount
- Shows each contributor's name, email, avatar, stats
- Can filter by limit (e.g., top 10)

### Use Case 2: "How will Arnav see that HE is working in the repo?"
**Answer:** 
- Arnav's user account is auto-created when he pushes
- Call `GET /api/analytics/user/:arnav_id/repositories`
- Shows all repos where Arnav contributed
- Shows his contribution numbers

### Use Case 3: "How will the OWNER see that many people are contributing?"
**Answer:**
- Call `GET /api/analytics/repository/:repo_id/summary`
- Shows complete breakdown of all contributors
- Shows who contributed what percentage
- Shows last activity dates

### Use Case 4: "Should we auto-create accounts for unknown contributors?"
**Answer:** **YES!** That's exactly what `findOrCreateUserFromPusher()` does:
- When Arnav pushes, system extracts his info
- Searches for Arnav by email
- If not found, creates new User: `{ name: "Arnav", email: "arnav@example.com", avatar: "...", bio: "Contributor from github" }`
- Creates Contributor link
- Next time Arnav pushes, system uses existing user account

## Integration Steps

1. **Install/Update the models** (already done):
   - Contributor.js
   - Event.js (updated)

2. **Add utilities** (already done):
   - extractPusher.js

3. **Add services** (already done):
   - contributorService.js

4. **Update webhook controller** (already done):
   - webhookController.js now calls `findOrCreateUserFromPusher` and `trackContribution`

5. **Add analytics endpoints** (already done):
   - contributorAnalytics.js controller
   - contributorAnalytics.js routes

6. **Mount the routes in your main app** (YOU NEED TO DO THIS):
   ```javascript
   // In src/app.js or server.js
   const contributorAnalyticsRoutes = require('./routes/contributorAnalytics');
   app.use('/api/analytics', contributorAnalyticsRoutes);
   ```

## Data Flow Example

```
Scenario: Arnav pushes to owner's repository

1. GitHub sends webhook with:
   {
     "pusher": { "name": "Arnav", "email": "arnav@example.com", "login": "arnav123" },
     "repository": { "name": "my-repo", "owner": { "login": "owner123" } },
     "commits": [...]
   }

2. webhookController receives request

3. extractPusher() normalizes to:
   {
     "name": "Arnav",
     "email": "arnav@example.com",
     "username": "arnav123",
     "platform": "github"
   }

4. findOrCreateUserFromPusher() checks database:
   → User.findOne({ email: "arnav@example.com" })
   → Not found → Create new User
   → { _id: "user_arnav", name: "Arnav", email: "arnav@example.com", avatarUrl: "..." }

5. trackContribution() creates/updates:
   → Contributor { userId: "user_arnav", repositoryId: "repo_id", commitCount: 1 }

6. Event created:
   → Event { pusherId: "user_arnav", repository: "owner/my-repo", status: "triggered" }

7. Next time Arnav pushes:
   → findOrCreateUserFromPusher() finds existing user
   → trackContribution() increments commitCount: 2
   → Event created with same pusherId
```

## Backward Compatibility

- Old Event records with `pusher` (string) field won't be affected
- New Event records use `pusherId` (reference) + `pusherName` (string backup)
- Old queries can still use `pusherName` or migrate to join with User
- Contributor model is new, so no conflicts

## Next Steps

1. Mount the analytics routes in your main app
2. Test the webhook flow by pushing code
3. Query the analytics endpoints
4. Display contributor info in your UI using these endpoints
5. Consider adding contributor medals/badges for top contributors
6. Consider adding contribution timeline graphs

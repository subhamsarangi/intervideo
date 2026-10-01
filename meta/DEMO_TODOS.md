# InterVideo Demo Stage – Core Implementation

Focus: Get the app live with basic access control, session limits, and admin monitoring.

## Phase 1: Authentication & Access Control

- [ ] **Password-Protected Access Pages**
  - [ ] Create `/password` endpoint - regular user password entry page
  - [ ] Create `/admin/password` endpoint - admin password entry page
  - [ ] Implement password verification logic (hash comparison, not plaintext)
  - [ ] Set secure HTTP-only cookies for authenticated sessions

- [ ] **Password Management (Backend)**
  - [ ] Store user & admin passwords as hashed values in `.env`
  - [ ] Create admin endpoint to view regular user password in plaintext (`/admin/user-password`)
  - [ ] Create admin endpoint to change regular user password (`/admin/change-user-password`)
  - [ ] On password change: invalidate all active regular user sessions immediately

## Phase 2: Session Management & Rate Limiting

- [ ] **Session Tracking (Regular Users)**
  - [ ] Track session start time on server
  - [ ] Implement 5-minute hard limit per session
  - [ ] Auto-stop recording and close session when timer expires
  - [ ] Notify user (UI alert) when limit is reached

- [ ] **Admin Sessions**
  - [ ] No time limits on admin sessions
  - [ ] Admins can start/stop sessions freely

- [ ] **Per-IP Daily Quota**
  - [ ] Track total session duration per IP per calendar day (IST/Kolkata)
  - [ ] Limit: 15 minutes per IP per day
  - [ ] Reject session start if IP has used ≥15 minutes today
  - [ ] Reset quota at midnight IST

- [ ] **Global Daily Quota**
  - [ ] Track total session duration across all regular users per day (IST/Kolkata)
  - [ ] Limit: 60 minutes total per day for entire user base
  - [ ] Reject session start if global usage ≥60 minutes today
  - [ ] Reset quota at midnight IST

- [ ] **Usage Tracking Storage**
  - [ ] Store usage data: IP → list of {sessionId, startTime, duration, endTime}
  - [ ] Store global usage: {date, totalDurationMinutes, sessionCount}
  - [ ] Use JSONL files (`usage/daily-usage.jsonl`, `usage/ip-usage.jsonl`)

## Phase 3: Cloudflare R2 Integration

- [ ] **R2 Setup**
  - [ ] Add Cloudflare R2 credentials to `.env`
  - [ ] Install AWS SDK (`@aws-sdk/client-s3`)

- [ ] **Recording Upload**
  - [ ] Change from local `.webm` save to R2 upload
  - [ ] Upload file with metadata: `{sessionId}_{timestamp}.webm`
  - [ ] Store R2 file URL in JSONL transcript record
  - [ ] Hide recording details from regular users (silent upload)

## Phase 4: Transcript & Memory Management

- [ ] **Session-Scoped Summary**
  - [ ] Keep `summary.json` in-memory only during active session
  - [ ] Clear summary at session end (do NOT persist)

- [ ] **JSONL Transcript Persistence**
  - [ ] Store in `sessions/<sessionId>.jsonl`
  - [ ] Include metadata: IP, timestamp, duration, R2 recording URL

## Phase 5: Admin Dashboard & Monitoring

- [ ] **Admin Dashboard**
  - [ ] Create `/admin/dashboard` page
  - [ ] Display all sessions: IP, timestamp, duration, session ID
  - [ ] Link to recording player for each session
  - [ ] Link to view transcript

- [ ] **Usage Dashboard**
  - [ ] Create `/admin/usage` page
  - [ ] Display today's global usage (X min / 60 min)
  - [ ] Display per-IP usage table (IP, sessions, duration, time remaining)
  - [ ] Add basic filters (by IP, date range)

- [ ] **Recordings Player**
  - [ ] Create `/admin/recordings-player` page
  - [ ] Standard HTML5 video player for admin playback
  - [ ] Display recording metadata (IP, timestamp, duration)

## Phase 6: Access Control Middleware

- [ ] **Auth Middleware**
  - [ ] Add auth check middleware for protected routes
  - [ ] Differentiate between regular user and admin roles
  - [ ] Return 401 Unauthorized for unauthenticated
  - [ ] Return 403 Forbidden for insufficient permissions

- [ ] **Regular User Permissions**
  - [ ] Can start a session (5-min limit, rate-limited)
  - [ ] Cannot see recordings, transcripts, or activity logs
  - [ ] Cannot access `/admin/*` routes

- [ ] **Admin Permissions**
  - [ ] Can start/stop sessions without limits
  - [ ] Can view dashboard, usage, and all recordings
  - [ ] Can view all transcripts
  - [ ] Can manage user password

## Phase 7: Environment & Config

- [ ] **Update `.env` with demo values**
  - [ ] `REGULAR_USER_PASSWORD` (bcrypt hash)
  - [ ] `ADMIN_PASSWORD` (bcrypt hash)
  - [ ] `CLOUDFLARE_R2_ACCESS_KEY_ID`
  - [ ] `CLOUDFLARE_R2_SECRET_ACCESS_KEY`
  - [ ] `CLOUDFLARE_R2_BUCKET_NAME=intervideo-recordings`
  - [ ] `CLOUDFLARE_R2_ENDPOINT`

## Phase 8: Deployment to Vercel

- [ ] **Vercel Setup**
  - [ ] Set environment variables in Vercel dashboard
  - [ ] Ensure Node.js 26.x

- [ ] **Local Testing**
  - [ ] Test password pages (user & admin)
  - [ ] Test 5-min session limit
  - [ ] Test rate limits (per-IP 15 min, global 60 min)
  - [ ] Test R2 upload
  - [ ] Test admin dashboard & usage view
  - [ ] Test password change and forced logout

- [ ] **Deploy & Verify**
  - [ ] Deploy to Vercel
  - [ ] Verify live functionality
  - [ ] Monitor R2 uploads
  - [ ] Check session isolation

---

## Notes

- **Demo scope**: Minimal auth, working rate limits, admin oversight.
- **Data storage**: JSONL files (sufficient for demo).
- **R2 recordings**: Transparent to regular users (no UI feedback).
- **Summary**: In-memory only, cleared at session end.
- **Timezones**: All quotas reset at midnight IST (Kolkata time).

## Code Reusability for Future Development

The following components built during demo can be reused/extended later:

- **Auth Middleware** (Phase 6): Extend with JWT/per-user logic instead of replacing.
- **Rate Limiting & Quota Logic** (Phase 2): Keep the calculation logic; migrate storage from JSONL to database.
- **Admin Dashboard Structure** (Phase 5): Extend with more analytics; reuse UI components.
- **Usage Tracking Functions** (Phase 2): Refactor to accept user ID instead of IP.
- **R2 Upload Logic** (Phase 3): Reuse; just add user-scoped prefixes.
- **JSONL Serialization** (Phase 4): Migrate data to DB once; keep serialization logic for exports.
- **WebSocket Session Management**: Reuse for admin features, multi-device sync, etc.

**Strategy**: Build demo code with clear separation of concerns (auth, storage, logic) so migrations involve swapping storage layer, not rewriting business logic.

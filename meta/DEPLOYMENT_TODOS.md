# InterVideo Deployment & Features Todo

## Phase 1: Authentication & Access Control

- [ ] **Password-Protected Access Pages**
  - [ ] Create `/password` endpoint - regular user password entry page
  - [ ] Create `/admin/password` endpoint - admin password entry page
  - [ ] Implement password verification logic (compare hashes, not plaintext)
  - [ ] Set secure HTTP-only cookies for authenticated sessions
  - [ ] Add session timeout logic (logout after inactivity)

- [ ] **Password Management (Backend)**
  - [ ] Store user & admin passwords as hashed values in `.env` or secure config
  - [ ] Create admin endpoint to view regular user password in plaintext (`/admin/user-password`)
  - [ ] Create admin endpoint to change regular user password (`/admin/change-user-password`)
  - [ ] On password change: invalidate all active regular user sessions immediately
  - [ ] Emit WebSocket disconnect or 401 response to force logout of regular users

## Phase 2: Session Management & Limits

- [ ] **Session Tracking**
  - [ ] Track session start time on server
  - [ ] Implement 5-minute hard limit for regular users per session
  - [ ] Auto-stop recording and close session when timer expires
  - [ ] Notify user (via UI alert) when 5-min limit is reached
  - [ ] Regular users cannot manually extend or restart within same "session window"

- [ ] **Admin Sessions**
  - [ ] No time limits on admin sessions
  - [ ] Admins can start/stop sessions freely

## Phase 2.5: Rate Limiting & Usage Quotas

- [ ] **Per-IP Daily Quota (Regular Users)**
  - [ ] Track total session duration per IP address per calendar day (IST/Kolkata time)
  - [ ] Limit: 15 minutes per IP per day
  - [ ] Reject session start if IP has used ≥15 minutes today
  - [ ] Show user error message: "Daily limit reached for this IP. Limit: 15 min/day"
  - [ ] Reset quota at midnight IST (Kolkata time)

- [ ] **Global Daily Quota (All Regular Users)**
  - [ ] Track total session duration across all regular users per calendar day (IST/Kolkata time)
  - [ ] Limit: 60 minutes total per day for entire user base
  - [ ] Reject session start if global usage ≥60 minutes today
  - [ ] Show user error message: "Global usage limit reached. Try again tomorrow"
  - [ ] Reset quota at midnight IST (Kolkata time)

- [ ] **Admin Exemption**
  - [ ] Admin sessions do NOT count toward any quotas
  - [ ] Admins can start/use sessions without rate limit restrictions

- [ ] **Usage Tracking Storage**
  - [ ] Store usage data: IP → list of {sessionId, startTime, duration, endTime}
  - [ ] Store global usage: {date, totalDurationMinutes, sessionCount}
  - [ ] Use persistent storage (JSONL file like `usage/daily-usage.jsonl` or database)
  - [ ] Aggregate per-IP data in `usage/ip-usage.jsonl` or similar

- [ ] **Session Start Validation**
  - [ ] On `/api/session/start` (regular user):
    - [ ] Retrieve user's IP address
    - [ ] Calculate today's usage for that IP
    - [ ] Calculate today's global usage
    - [ ] If IP usage ≥15 min, reject with 429 Too Many Requests
    - [ ] If global usage ≥60 min, reject with 429 Too Many Requests
    - [ ] Otherwise, allow session start

- [ ] **Session End Recording**
  - [ ] On `/api/session/end`:
    - [ ] Calculate actual session duration
    - [ ] Record session in per-IP usage log
    - [ ] Record session in global usage log
    - [ ] Update running totals for today

- [ ] **Admin Usage Dashboard**
  - [ ] Create `/admin/usage` page
  - [ ] Display **Today's Usage**:
    - [ ] Global total (X min / 60 min)
    - [ ] Session count
    - [ ] Time remaining today
  - [ ] Display **Per-IP Usage Table**:
    - [ ] IP Address
    - [ ] Sessions today (count)
    - [ ] Total duration today (X min / 15 min)
    - [ ] Last session timestamp
    - [ ] Time remaining for that IP
  - [ ] Add filters/search (by IP, date range)
  - [ ] Add **Historical Data View**:
    - [ ] Select date range
    - [ ] View daily usage summary for each day
    - [ ] View per-IP breakdown for selected date

- [ ] **Usage Data Export (Optional)**
  - [ ] Provide CSV export of usage data (admin only)
  - [ ] Include columns: date, IP, sessions, duration, last-session-time

## Phase 3: Cloudflare R2 Integration

- [ ] **R2 Bucket Configuration**
  - [ ] Add Cloudflare R2 credentials to `.env` (access key, secret key, bucket name: `intervideo-recordings`)
  - [ ] Install and configure AWS SDK or Cloudflare R2 client (`@aws-sdk/client-s3` or equivalent)

- [ ] **Recording Upload**
  - [ ] Change from local `.webm` save to R2 upload
  - [ ] Upload file with metadata: `{userId}/{sessionId}_{timestamp}.webm`
  - [ ] Store R2 file URL/path in JSONL transcript record
  - [ ] Hide recording details from regular users (no UI feedback that recording is being saved)

- [ ] **Admin Recording Retrieval**
  - [ ] Create `/admin/recordings` endpoint - list all recordings with metadata
  - [ ] Create `/admin/recording/:sessionId` endpoint - retrieve presigned URL or stream video
  - [ ] Implement admin video player page (`/admin/recordings-player`) with standard HTML5 video player
  - [ ] Display recording metadata: IP, timestamp, duration, user info

## Phase 4: Activity Logging & Admin Dashboard

- [ ] **Session Metadata Collection**
  - [ ] Capture user IP address on session start
  - [ ] Log session timestamp (start time)
  - [ ] Calculate session duration on end
  - [ ] Store transcript (already in JSONL)

- [ ] **Admin Dashboard**
  - [ ] Create `/admin/dashboard` page
  - [ ] Display table/list of all sessions with columns:
    - [ ] IP Address
    - [ ] Timestamp (start time)
    - [ ] Duration (in seconds or MM:SS format)
    - [ ] Transcript preview or link to full transcript
    - [ ] Link to recording player for that session
    - [ ] Session ID
  - [ ] Add filters/search (by IP, date range, duration, etc.)
  - [ ] Add pagination if needed

## Phase 5: Transcript & Memory Management

- [ ] **Session-Scoped Summary**
  - [ ] Keep `summary.json` in-memory only during active session
  - [ ] Do NOT persist summary across sessions
  - [ ] Clear summary at session end
  - [ ] Use summary only for LLM context within a single conversation

- [ ] **JSONL Transcript Persistence**
  - [ ] Keep current JSONL structure for session transcripts
  - [ ] Store in `sessions/<sessionId>.jsonl`
  - [ ] Include metadata in first line or separate metadata file:
    - [ ] User IP
    - [ ] Timestamp
    - [ ] Duration (added at session end)
    - [ ] R2 recording URL/path
  - [ ] Admins can query/view full transcripts
  - [ ] Regular users cannot access transcripts

## Phase 6: Access Control & Permission Logic

- [ ] **Regular User Permissions**
  - [ ] Can access `/password` page
  - [ ] Can start a session (after password entry)
  - [ ] Can chat live (5-min hard limit)
  - [ ] Cannot see recordings
  - [ ] Cannot see transcripts
  - [ ] Cannot see activity logs
  - [ ] Cannot access `/admin/*` routes

- [ ] **Admin Permissions**
  - [ ] Can access `/admin/password` page
  - [ ] Can start/stop sessions without time limit
  - [ ] Can view all sessions on dashboard
  - [ ] Can view all recordings and play them
  - [ ] Can view all transcripts
  - [ ] Can view/change regular user password
  - [ ] Can access all admin endpoints

- [ ] **Middleware**
  - [ ] Add auth check middleware for protected routes
  - [ ] Differentiate between regular user and admin roles in middleware
  - [ ] Return 401 Unauthorized for unauthenticated requests
  - [ ] Return 403 Forbidden for insufficient permissions

## Phase 7: UI/UX Updates

- [ ] **Regular User Flow**
  - [ ] `/password` → enter password → redirect to app
  - [ ] Show 5-min timer countdown during session
  - [ ] Show warning at 4:30, 4:45, 4:50 marks
  - [ ] Auto-stop at 5:00 with "Session ended" message
  - [ ] No indication that recording is being saved

- [ ] **Admin Flow**
  - [ ] `/admin/password` → enter admin password → redirect to admin dashboard
  - [ ] Dashboard shows all activity in real-time or with refresh
  - [ ] Link to recordings player page
  - [ ] Link to view/manage user password
  - [ ] Clean navigation between dashboard, recordings, password management

## Phase 8: Environment & Config

- [ ] **Update `.env` template**
  - [ ] Add: `REGULAR_USER_PASSWORD` (hash)
  - [ ] Add: `ADMIN_PASSWORD` (hash)
  - [ ] Add: `CLOUDFLARE_R2_ACCESS_KEY_ID`
  - [ ] Add: `CLOUDFLARE_R2_SECRET_ACCESS_KEY`
  - [ ] Add: `CLOUDFLARE_R2_BUCKET_NAME=intervideo-recordings`
  - [ ] Add: `CLOUDFLARE_R2_ENDPOINT`

- [ ] **Update `.env.example`** with dummy values

## Phase 9: Deployment to Vercel

- [ ] **Vercel Configuration**
  - [ ] Set environment variables in Vercel dashboard (from `.env`)
  - [ ] Ensure Node.js version is set to 26.x
  - [ ] Configure build command: `npm run build`
  - [ ] Configure start command (if applicable)

- [ ] **Testing Before Deploy**
  - [ ] Test password pages locally
  - [ ] Test 5-min limit for regular users
  - [ ] Test session timeout and logout
  - [ ] Test R2 upload (with test bucket or staging)
  - [ ] Test admin dashboard
  - [ ] Test password change and forced logout
  - [ ] Test recording retrieval and playback

- [ ] **Post-Deployment**
  - [ ] Monitor logs for errors
  - [ ] Test live on Vercel URL
  - [ ] Verify R2 uploads are working
  - [ ] Verify session isolation (one user's data doesn't leak to another)

## Phase 10: Security & Edge Cases

- [ ] **Security Review**
  - [ ] Ensure passwords are hashed (bcrypt or similar), never stored plaintext
  - [ ] Use HTTPS only (Vercel provides this automatically)
  - [ ] Validate IP addresses are being captured correctly
  - [ ] Add rate limiting on password endpoints to prevent brute force
  - [ ] Sanitize admin dashboard inputs/queries

- [ ] **Edge Cases**
  - [ ] Handle network disconnect during 5-min session (clean up gracefully)
  - [ ] Handle admin password change while regular user is mid-session (force logout)
  - [ ] Handle R2 upload failure (retry logic or fallback)
  - [ ] Handle session ID collisions (ensure uniqueness)
  - [ ] Handle browser tab close (cleanup on server side)

---

## Notes

- **Summary Management**: Keep in-memory during session only, clear at end. Do not persist across sessions.
- **JSONL Storage**: Continue using JSONL for transcripts. It's production-ready.
- **R2 Recordings**: User uploads are invisible to regular users. Only admins see recording links/metadata.
- **Immediate Logout**: Password change must invalidate all regular user sessions instantly via WebSocket disconnect or forced 401.
- **5-Min Limit**: Hard stop, no extensions. Regular users cannot restart immediately in same session context.
- **Rate Limiting Quotas**: 
  - Per-IP: 15 min/day (regular users only)
  - Global: 60 min/day (all regular users combined)
  - Admins: No restrictions
  - Reset at midnight IST (Kolkata time)
  - Admin can view daily usage, per-IP usage, and historical trends

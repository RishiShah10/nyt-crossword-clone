# Production Security Checklist — Rishi's Crossword

## Pre-Deployment (Required)

### Secrets & Environment Variables
- [ ] Generate a new `JWT_SECRET` (min 32 chars): `python3 -c "import secrets; print(secrets.token_urlsafe(48))"`
- [ ] Set `JWT_SECRET` in Vercel environment variables (not in code)
- [ ] Set `ABLY_API_KEY` in Vercel environment variables
- [ ] Set `DATABASE_URL` in Vercel environment variables
- [ ] Set `GOOGLE_CLIENT_ID` in Vercel environment variables
- [ ] Set `CORS_ORIGINS` in Vercel to your production domain (e.g., `https://your-app.vercel.app`)
- [ ] Verify `.env` files are in `.gitignore` (root, backend, frontend)
- [ ] Verify no secrets in git history — if previously committed, rotate ALL credentials:
  - [ ] Rotate Neon database password
  - [ ] Regenerate Ably API key from Ably dashboard
  - [ ] Regenerate JWT_SECRET
  - [ ] Review Google OAuth app for unauthorized access

### Authentication
- [x] JWT stored in httpOnly/Secure/SameSite=Lax cookies (not localStorage)
- [x] Backend reads JWT from cookie (with Bearer header fallback)
- [x] `/api/auth/logout` endpoint clears cookie
- [x] JWT includes `iss` and `aud` claims, verified on decode
- [x] Google email_verified check enforced
- [x] Specific JWT exception handling (ExpiredSignatureError, InvalidTokenError)
- [x] No token/secret exposed in API responses

### CORS & Headers
- [x] CORS origins restricted to specific domains (no wildcard `*`)
- [x] CORS methods restricted to `GET, POST, PUT, DELETE, OPTIONS`
- [x] CORS headers restricted to `Content-Type, Authorization`
- [x] `X-Content-Type-Options: nosniff`
- [x] `X-Frame-Options: DENY`
- [x] `Strict-Transport-Security` (HSTS) on HTTPS
- [x] `Referrer-Policy: strict-origin-when-cross-origin`
- [x] `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- [x] `X-XSS-Protection: 1; mode=block`

### Rate Limiting
- [x] Login endpoint: 10 requests/minute per IP
- [x] Room creation: 10 requests/minute per IP
- [x] Room join: 10 requests/minute per IP
- [x] Ably token: 20 requests/minute per IP
- [x] Client-side Ably publish: 20 events/second per tab

### Input Validation
- [x] Room codes validated (alphanumeric, 4-8 chars)
- [x] Puzzle IDs validated (word chars + hyphens, max 50)
- [x] `puzzle_data` size capped at 500KB
- [x] Grid/cell lists capped at 2000 items
- [x] Integer bounds enforced (elapsed_seconds, completion_pct, etc.)
- [x] Color values validated as hex pattern `#XXXXXX`
- [x] Google credential max length: 4096
- [x] Bulk import capped at 100 saves

### Access Control
- [x] Room details require membership (GET /api/rooms/{code})
- [x] Room state requires membership
- [x] Ably token requires membership
- [x] All saves endpoints scoped to authenticated user
- [x] Color change validates color not taken by another member

### Error Handling
- [x] ErrorMaskingMiddleware catches unhandled exceptions
- [x] Generic "Internal server error" returned (no stack traces)
- [x] Auth errors don't leak exception details
- [x] Ably errors don't leak API key or internal details
- [x] All exceptions logged server-side with full context

### Infrastructure
- [x] SSL/TLS certificate verification enabled on database connection
- [x] Room codes generated with `secrets.choice()` (cryptographic RNG)
- [x] `/docs`, `/redoc`, `/openapi.json` disabled in production
- [x] Config validation at startup (JWT_SECRET length, CORS_ORIGINS, DATABASE_URL)
- [x] `withCredentials: true` on frontend API client for cookie transport

## Post-Deployment Verification

- [ ] Visit `/docs` on production — should return 404 (not the Swagger UI)
- [ ] Check response headers for security headers (use browser DevTools > Network)
- [ ] Verify cookies: `auth_token` should be `HttpOnly`, `Secure`, `SameSite=Lax`
- [ ] Test rate limiting: hit `/api/auth/google` 11 times quickly — 11th should be 429
- [ ] Test room access: try `GET /api/rooms/FAKECODE` with a valid JWT — should be 404
- [ ] Verify CORS: `curl -H "Origin: https://evil.com" -X OPTIONS your-api` — should be rejected
- [ ] Run `npm audit` in `frontend/` to check for dependency vulnerabilities

## Ongoing Maintenance

- [ ] Rotate `JWT_SECRET` every 6 months
- [ ] Rotate `ABLY_API_KEY` every 6 months
- [ ] Review and update dependencies quarterly (`pip list --outdated`, `npm outdated`)
- [ ] Monitor Ably usage dashboard for anomalies
- [ ] Monitor Neon database for unusual query patterns
- [ ] Clean up expired rooms periodically (rooms older than 24h)
- [ ] Review Google Cloud Console for OAuth app health

## Known Limitations (Accepted Risk)

1. **No token blacklisting** — JWT tokens valid until expiry (24h). Mitigated by httpOnly cookies (can't be stolen via XSS) and reasonable expiry.
2. **No refresh token rotation** — Single long-lived JWT. Acceptable for a crossword game; would need refresh tokens for higher-security apps.
3. **No CSRF tokens** — Mitigated by `SameSite=Lax` cookies, which prevent cross-origin POST/PUT/DELETE requests from other sites.
4. **HS256 (symmetric) JWT** — Same secret signs and verifies. Acceptable for single-service apps. Would use RS256 for multi-service architectures.
5. **No WAF** — Vercel doesn't provide a built-in WAF. Consider Cloudflare if DDoS becomes a concern.
6. **Puzzle answers accessible via API** — `/api/puzzles/{date}/check` and `/api/puzzles/{date}/reveal` are unauthenticated. Acceptable since these puzzles are archived/public.

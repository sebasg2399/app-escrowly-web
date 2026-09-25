# Archive Report: escrowly-foundation

**Change**: `escrowly-foundation`
**Archived**: 2026-09-24
**Artifact store**: openspec
**Verification verdict**: PASS WITH WARNINGS (no CRITICAL issues)

---

## What Was Archived

The `escrowly-foundation` change (Escrowly Foundation, backend-only) is complete and archived. It established the Fastify/TypeScript modular-monolith backend: API conventions (error envelope, zod boundary validation, structured logging, OpenAPI contract baseline), self-managed auth (register/login/logout/current-user, Argon2id hashing, roles, JWT + opaque refresh), and the `Users` persistence model with profile read/update.

## Spec Sync Table

| Domain | Action | Requirements Added | Modified | Removed |
|--------|--------|-------------------|----------|---------|
| api-foundations | Created | 8 | 0 | 0 |
| user-auth | Created | 10 | 0 | 0 |
| user-accounts | Created | 4 | 0 | 0 |

Main specs did not exist (`openspec/specs/` was empty), so each delta spec was promoted to a full source-of-truth spec (delta header converted to a title-case specification header with a `## Purpose` section; `## ADDED Requirements` renamed to `## Requirements`). All 22 requirements and 27 scenarios preserved verbatim.

## Archive Contents Checklist

- [x] `proposal.md`
- [x] `specs/` (api-foundations, user-auth, user-accounts)
- [x] `design.md`
- [x] `tasks.md` (23/24 complete; task 1.6 intentionally deferred to developer)
- [x] `verify-report.md`
- [x] `state.yaml`
- [x] `archive-report.md` (this file)

## Verification Verdict

**PASS WITH WARNINGS** — no CRITICAL issues.

- 46 tests passed, 0 failed; type check (`tsc --noEmit`) clean; `pnpm openapi` generates successfully.
- Compliance: **22/27 scenarios fully compliant (81%)**, 2 partial, 3 untested.

### Accepted Known Gaps (user chose not to close)

The following gaps were recorded and accepted; the user chose not to close them before archive:

**3 UNTESTED scenarios** (implemented but lacking dedicated test assertions):
1. `GET /health` → 200 (health check endpoint)
2. Unknown route → 404 error envelope
3. Structured logging with correlation ID + secret redaction

**2 PARTIAL scenarios** (practical limitations):
1. Token expiry — malformed/missing token 401 is tested, but no time-based expiry test (5-min TTL).
2. OpenAPI contract validation — `pnpm openapi` regenerates the file, but no test asserts the contract describes all required routes against a baseline.

These are recorded here as the accepted state at archive time. Suggested follow-ups (health test, 404 test, fake-timer expiry test, log-redaction test) are documented in `verify-report.md` but were explicitly deferred.

## PR / Commit Trail

| PR | Branch | Description | Merge commit |
|----|--------|-------------|--------------|
| #1 | `feat/foundation-scaffold` | Scaffold Fastify backend with health check and error envelope | `eca67e2` |
| #2 | `fix/foundation-local-dev` | Local-dev fix: host port 5433, load `.env` at runtime, pnpm lockfile + initial migration | `39441a7` |
| #3 | `feat/foundation-auth` | Self-managed JWT authentication | `1a40936` |
| #4 | `feat/foundation-users` | User profile endpoints with required name field | `ba74bb3` |
| #5 | `feat/foundation-contract` | OpenAPI contract generation + lint/format/README | `87c0938` |

All 5 PRs merged to `main`. Task 1.6 (`pnpm prisma migrate dev`) remains a local-only developer step; migration files are committed.

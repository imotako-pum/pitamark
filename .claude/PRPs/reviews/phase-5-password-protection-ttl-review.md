# Code Review: Phase 5 — パスワード保護 + DO Alarms TTL

**Reviewed**: 2026-05-01
**Branch**: `feat/phase-5-password-ttl` → `main` (PR not yet opened — local diff review)
**Commits**: `80bb167` backend / `f686909` frontend / `88a86cf` docs
**Diff**: 38 files, +3212 / -79
**Decision**: **REQUEST CHANGES** (1 HIGH security finding + 3 MEDIUM. No CRITICAL.)

## Summary

Phase 5 implementation is structurally sound and well-tested (247 tests pass; new test count +74). PBKDF2 hashing, HS256 JWT, DO-Alarm-driven TTL cleanup, and the 4-state `RoomEditor` are implemented per plan with thoughtful patterns (constant-time compare, super-first `onStart`, idempotent alarm). Three deviations from plan are documented and reasonable.

The blocker is **HIGH-1**: protected images inherit the Phase 2 `Cache-Control: public, max-age=3600` setting from R2, which contradicts the threat model "URL を Teams で雑に貼っても画像内容は守られる" — browser private cache (and potentially shared caches) can serve the image to subsequent unauthenticated requests. One-line fix in `images.ts`.

The other findings are quality improvements, not security/correctness blockers.

---

## Findings

### CRITICAL

None.

### HIGH

#### HIGH-1: Protected images served with `Cache-Control: public, max-age=3600`

- **Location**: `apps/api/src/routes/images.ts:90-91` (response headers built from R2 metadata)
- **Root cause**: `apps/api/src/storage/r2-image-storage.ts:22` sets `httpMetadata: { contentType, cacheControl: 'public, max-age=3600' }` on every PUT, established in Phase 2 for unprotected rooms. `obj.writeHttpMetadata(headers)` in `images.ts:91` then propagates this to the Bearer-protected response in Phase 5.
- **Impact**: Browser private cache (and any RFC-noncompliant intermediate cache) can store the protected image for up to 1 hour and serve it to subsequent requests on the same machine without re-checking Authorization. On shared computers or via cache leakage attacks, this defeats the protection.
- **PRD contract violated**: "URL を Teams で雑に貼っても画像内容は守られる" — the URL alone (without password) becomes sufficient to recover the image from cache for an hour after the legitimate user fetches it.
- **Severity**: HIGH. Not CRITICAL because the practical exploit window is bounded (1 hour) and Cloudflare Worker `fetch()` responses are NOT cached at the edge by default. Browser-level leak remains the realistic vector.
- **Suggested fix** (smallest patch, in `images.ts` after line 91 `obj.writeHttpMetadata(headers)`):
  ```ts
  if (meta.auth) {
    headers.set('cache-control', 'private, no-store');
  }
  ```
  Or, more conservatively, override unconditionally to `private, max-age=300` for both protected and unprotected to reduce cache-leak surface across the board.
- **Test**: add to `apps/api/src/__tests__/images.test.ts`:
  ```ts
  it('uses no-store cache-control for protected rooms', async () => {
    const env = buildEnv();
    const created = await createProtectedRoomWithImage(env, 'letmein');
    const token = await issueRoomToken(created.id, DEFAULT_ROOM_TOKEN_SECRET);
    const res = await app.request(`/rooms/${created.id}/image`, {
      headers: { authorization: `Bearer ${token}` },
    }, env);
    expect(res.headers.get('cache-control')).toMatch(/no-store|private/);
  });
  ```

### MEDIUM

#### MEDIUM-1: WebSocket connects (and gets 401) before authentication on protected rooms

- **Location**: `apps/web/src/pages/RoomEditor.tsx:103` (`useYjsAnnotationsStore(roomId, undefined, token)` runs unconditionally during render)
- **Behavior**: When `imageState === 'gate'`, RoomEditor returns `<RoomGate />` early at line 132, but the `useYjsAnnotationsStore` hook has already fired and instantiated a `WebsocketProvider` with `token=null`. The provider tries to connect to `/sync/:id` with no `?token=`, the server middleware rejects with 401 (Phase 5 `yjs.ts:90-92`), and y-websocket retries with exponential backoff until the token state updates.
- **Impact**: Wasted network round-trips and noisy 401 logs while the user is still typing the password. No correctness or security issue.
- **Suggested fix**: extract `<RoomEditorAuthenticated roomId token>` as a child that owns the Yjs store, so the hook only runs after `imageState === 'ready'`. Sketch:
  ```tsx
  if (imageState.kind === 'ready') {
    return <RoomEditorAuthenticated roomId={roomId} token={token} url={imageState.url} />;
  }
  ```
- **Severity**: MEDIUM. Acceptable to defer to Phase 7 (公開準備) when rate limiting and Turnstile land — at that point the noisy 401 will need cleanup anyway.

#### MEDIUM-2: `base64UrlDecode` silently accepts non-alphabet characters

- **Location**: `apps/api/src/lib/password.ts:88-128`
- **Behavior**: `REVERSE[someUnknownChar]` returns `undefined`, then `undefined!` is asserted via biome-ignore. The downstream bit math `(v0 << 2) | (v1 >> 4)` coerces `undefined` → `NaN` → `0`. The function returns `Uint8Array` populated with garbage, never throws.
- **Impact**: `password-service.verify` path is safe — `constantTimeEqual` will return `false` for garbage hash, so the auth check fails closed. But defensive programming suggests upfront rejection so storage corruption surfaces as an error rather than silent garbage.
- **Suggested fix**: validate each char against the alphabet:
  ```ts
  const v0 = REVERSE[str[i++]!];
  if (v0 === undefined) throw new Error('Invalid base64url character');
  ```
- **Severity**: MEDIUM. No active exploit path because all production input passes through `base64UrlEncode` first (round-trip safe) — only attacker-injected R2 meta could trip this, which is itself out-of-band.

#### MEDIUM-3: Duplicate `ErrorResponseSchema` in `routes/rooms.ts` and `routes/images.ts`

- **Location**: `apps/api/src/routes/rooms.ts:12-25` and `apps/api/src/routes/images.ts:11-24` (identical Zod enum)
- **Behavior**: Phase 5 added `'UNAUTHORIZED'` to both files manually. Future error codes added to `lib/error.ts` ErrorCode union must be remembered to be synced to both Zod enums or hc/OpenAPI types drift.
- **Suggested fix**: hoist to `apps/api/src/lib/error.ts` and import in both routes:
  ```ts
  // lib/error.ts
  export const ErrorResponseSchema = z.object({
    ok: z.literal(false),
    error: z.object({
      code: z.enum(['INVALID_REQUEST', 'UNSUPPORTED_MEDIA_TYPE', 'PAYLOAD_TOO_LARGE',
                    'NOT_FOUND', 'UNAUTHORIZED', 'INTERNAL']),
      message: z.string(),
    }),
  });
  ```
- **Severity**: MEDIUM (maintainability). No current bug.

### LOW

#### LOW-1: Unused `passwordId` in LocalEditor

- **Location**: `apps/web/src/pages/LocalEditor.tsx:34` declares `const passwordId = useId();`
- **Issue**: Used as `id={passwordId}` on the input, but no `<label htmlFor={passwordId}>`. The input falls back to `aria-label="ルームのパスワード"`. Either drop `passwordId` or add a visible label connected via `htmlFor`.

#### LOW-2: Unused `ownsObjectUrl` boolean in RoomEditor `ImageState`

- **Location**: `apps/web/src/pages/RoomEditor.tsx:25` `ImageState.ready` carries `ownsObjectUrl: boolean`, but cleanup uses the local `createdObjectUrl` ref-like var (line 49). The state field is set but never read.
- **Issue**: Either use the state flag for cleanup, or drop the field for clarity.

#### LOW-3: `authRoute` rebuilds three services per request

- **Location**: `apps/api/src/routes/rooms.ts:175-177`
- **Issue**: `buildRoomService` / `buildPasswordService` / `buildTokenService` are re-instantiated on every auth request. Each is cheap, but Cloudflare Worker cold-start and per-request allocation could be cleaner via a `c.set('services', ...)` middleware. Defer to Phase 7 refactor if profiling shows pressure.

#### LOW-4: `buildSyncUrl` token branch is dead code

- **Location**: `apps/web/src/lib/yjs-config.ts:25-35` exposes `buildSyncUrl(roomId, base, token)` with token query-param support, but `useYjsAnnotationsStore` switched to `WebsocketProvider`'s `params: { token }` option (deviation #1 in implementation report). No production caller passes the third argument.
- **Issue**: Either remove the `token` parameter (and its 3 tests) or wire it back in for consistency. Currently confusing for future readers.

---

## Validation Results

| Check | Result | Notes |
|---|---|---|
| Type check (`pnpm turbo run typecheck`) | ✅ Pass | 4 workspaces, zero errors (cached) |
| Lint (`pnpm lint` / `biome ci .`) | ✅ Pass | 0 errors |
| Tests (`pnpm test`) | ✅ Pass | 247/247 (api 93 / web 140 / shared 14) |
| Build (`pnpm build`) | ✅ Pass | vite 702 KB / gzip 214 KB; wrangler dry-run sees `env.Y_ROOM (SnapShareYDO)` |

All cached green; no test/lint regression introduced by Phase 5.

---

## Files Reviewed (highlights)

| File | Type | Notes |
|---|---|---|
| `apps/api/src/lib/password.ts` | Added | PBKDF2 + base64url. Constant-time compare correctly bit-XORs full buffer. **MED-2** on base64UrlDecode validation. |
| `apps/api/src/lib/token.ts` | Added | HS256 JWT wrapper. Signature-then-exp ordering of hono `verify` correctly avoids `expired` reason leaking signature info. Bearer extractor regex is sound. |
| `apps/api/src/services/password-service.ts` | Added | Clean factory. Future-proof unknown-algo rejection. Verify path catches `base64UrlDecode` exceptions (relevant only if MED-2 is fixed to throw). |
| `apps/api/src/services/token-service.ts` | Added | Trivial closure wrapper. |
| `apps/api/src/services/room-service.ts` | Modified | Hashes password BEFORE writing image — correct ordering for orphan-prevention rollback. `protected: !!auth` flag is the only auth-derived data ever logged. |
| `apps/api/src/routes/rooms.ts` | Modified | Auth route returns identical 401 message for all wrong-password paths (no timing oracle through messages). 400 for unprotected-room and 404 for nonexistent are intentionally distinct — acceptable per plan Decisions Log. |
| `apps/api/src/routes/images.ts` | Modified | **HIGH-1** on cache-control. Otherwise solid: nosniff + svg disposition unchanged from Phase 2; Bearer gate fails closed. |
| `apps/api/src/yjs.ts` | Modified | `SnapShareYDO.onStart` correctly awaits super first. `getAlarm()` idempotency is right. `alarm()` order (R2 image → R2 meta → DO storage wipe) tolerates partial cleanup. WS query token middleware never logs token. |
| `apps/api/src/storage/r2-meta-storage.ts` | Modified | `deleteMeta` mirrors `deleteImage` non-fatal pattern. |
| `apps/api/wrangler.toml` | Modified | Migration v2 `renamed_classes` syntax correct. Secret comment accurate. |
| `apps/web/src/lib/api-client.ts` | Modified | Tagged `AuthResult` type is a good API. `fetchProtectedImage` documents the caller's `URL.revokeObjectURL` responsibility. |
| `apps/web/src/lib/auth-storage.ts` | Added | Try/catch wrapping is comprehensive (storage-disabled / quota-full all swallowed). sessionStorage choice over localStorage matches threat model. |
| `apps/web/src/lib/yjs-config.ts` | Modified | **LOW-4**: `buildSyncUrl` token argument is dead code — `useYjsAnnotationsStore` switched to y-websocket `params` option. |
| `apps/web/src/pages/RoomEditor.tsx` | Modified | 4-state machine is correct. Cleanup via `cancelled` flag + cleanup-time `revokeObjectURL` handles all races. **MED-1** on premature WS connect. **LOW-2** on unused `ownsObjectUrl`. |
| `apps/web/src/pages/LocalEditor.tsx` | Modified | Empty-password block prevents silent unprotected upload — good. **LOW-1** on dangling `passwordId`. |
| `apps/web/src/components/room-gate/RoomGate.tsx` | Added | Solid a11y (aria-invalid / aria-describedby / role=alert). Submitting flag intentionally not cleared on success — correctly relies on parent unmount. |

### Tests

74 new tests added; 247/247 pass.

| Test file | Tests | Coverage notes |
|---|---|---|
| `apps/api/src/lib/__tests__/password.test.ts` | 14 | Iteration count regression-guarded. Round-trip 0/1/2/3/16/32 byte covers boundary. |
| `apps/api/src/lib/__tests__/token.test.ts` | 7 | Expiry, sub_mismatch, signature mismatch all asserted. Uses `now: () => 0` injection cleanly. |
| `apps/api/src/services/__tests__/password-service.test.ts` | 9 | Empty + 257-char rejection, unknown-algo forward-compat, corrupt-salt graceful false. |
| `apps/api/src/__tests__/{rooms,images,yjs}.test.ts` | +21 | Strong coverage of protected/unprotected branches across all 3 surfaces (REST + WS). |
| `apps/web/src/lib/__tests__/auth-storage.test.ts` | 8 | Throwing-Storage stub asserts resilience promise. |
| `apps/web/src/components/room-gate/__tests__/RoomGate.test.tsx` | 5 | react-dom/client + happy-dom + fetch stub gives realistic submit flow without testing-library dep. |

**Test gap**: HIGH-1 (cache-control on protected images) — no test verifies the response Cache-Control header. See suggested test in HIGH-1 fix section.

---

## Recommendations

### Block-merge fix (required)

1. **HIGH-1**: Override `Cache-Control` to `private, no-store` for protected images in `apps/api/src/routes/images.ts` + add regression test.

### Strongly recommended (next session)

2. **MED-1**: Refactor `RoomEditor` so `useYjsAnnotationsStore` only mounts when `imageState === 'ready'`. Reduces 401 noise during gate state.
3. **MED-2**: Validate base64url alphabet in `base64UrlDecode` and throw on invalid input. Currently safe only by accident; future callers may not catch.
4. **MED-3**: Hoist `ErrorResponseSchema` to `lib/error.ts` and import in both routes.

### Optional cleanup

5. **LOW-1/2/3/4** as listed above. None block merge.

### Manual verification still pending (per implementation report)

- [ ] `ROOM_TTL_MS=10000` smoke test for DO Alarm cleanup
- [ ] Two-tab protected room E2E (auth + sync)

---

## Decision Rationale

**REQUEST CHANGES** because HIGH-1 has security implications that contradict the PRD threat model and is a one-line fix. Once HIGH-1 + a regression test are added, this PR is ready to merge — the MED findings are quality improvements that can land in follow-up PRs without blocking Phase 5 → main.

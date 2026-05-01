// sessionStorage wrapper for room-bound JWTs.
// Why sessionStorage and not localStorage:
//   - tokens expire in 24h server-side and are tightly room-bound, so
//     long-lived persistence has no benefit and increases leak surface
//   - sessionStorage clears on tab close, which matches the "URL share"
//     trust model: each new window must re-enter the password
//
// All accessors swallow exceptions because the storage API can throw on
// quota-exceeded, disabled-by-user, or sandboxed-iframe environments and
// we never want token plumbing to crash the editor.

const tokenKey = (roomId: string): string => `roomToken:${roomId}`;

export const getRoomToken = (
  roomId: string,
  storage: Storage = window.sessionStorage,
): string | null => {
  try {
    return storage.getItem(tokenKey(roomId));
  } catch {
    return null;
  }
};

export const setRoomToken = (
  roomId: string,
  token: string,
  storage: Storage = window.sessionStorage,
): void => {
  try {
    storage.setItem(tokenKey(roomId), token);
  } catch {
    // Storage full / disabled — caller will simply re-prompt next session.
  }
};

export const clearRoomToken = (roomId: string, storage: Storage = window.sessionStorage): void => {
  try {
    storage.removeItem(tokenKey(roomId));
  } catch {
    // Best-effort.
  }
};

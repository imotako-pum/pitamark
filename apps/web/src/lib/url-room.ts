import { ROOM_ID_REGEX } from '@snap-share/shared';

const ROOM_PREFIX = '/r/';

export const parseRoomIdFromPath = (pathname: string): string | null => {
  if (!pathname.startsWith(ROOM_PREFIX)) return null;
  const id = pathname.slice(ROOM_PREFIX.length).replace(/\/$/, '');
  return ROOM_ID_REGEX.test(id) ? id : null;
};

export const buildRoomPath = (roomId: string): string => `${ROOM_PREFIX}${roomId}`;

export const setRoomIdInUrl = (roomId: string, history: History = window.history): void => {
  const next = buildRoomPath(roomId);
  if (window.location.pathname !== next) {
    history.pushState(null, '', next);
  }
};

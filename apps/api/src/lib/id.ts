import { ROOM_ID_LENGTH, ROOM_ID_REGEX } from '@snap-share/shared';
import { nanoid } from 'nanoid';

export { ROOM_ID_LENGTH, ROOM_ID_REGEX };

export const generateRoomId = (): string => nanoid(ROOM_ID_LENGTH);

import { LocalEditor } from './LocalEditor';
import { RoomEditor } from './RoomEditor';

type Props = Readonly<{
  roomId: string | null;
  onRoomIdChange: (roomId: string | null) => void;
}>;

/**
 * Dispatches to either the local-only or the Yjs-backed room editor.
 * The hook-order rule is satisfied by mounting two distinct components, so
 * navigating between modes unmounts/remounts cleanly.
 */
export const EditorPage = ({ roomId, onRoomIdChange }: Props) =>
  roomId ? (
    <RoomEditor key={roomId} roomId={roomId} />
  ) : (
    <LocalEditor onRoomIdChange={onRoomIdChange} />
  );

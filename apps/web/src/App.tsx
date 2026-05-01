import { useEffect, useState } from 'react';
import { parseRoomIdFromPath } from './lib/url-room';
import { EditorPage } from './pages/EditorPage';

export const App = () => {
  const [roomId, setRoomId] = useState<string | null>(() =>
    parseRoomIdFromPath(window.location.pathname),
  );

  useEffect(() => {
    const onPop = () => setRoomId(parseRoomIdFromPath(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  return <EditorPage roomId={roomId} onRoomIdChange={setRoomId} />;
};

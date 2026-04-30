import { useEffect, useMemo, useState } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

const ROOM_ID = 'spike-room';
const WS_BASE = (() => {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}/rooms`;
})();

type Status = 'connecting' | 'connected' | 'disconnected';

export const App = () => {
  const doc = useMemo(() => new Y.Doc(), []);
  const ytext = useMemo(() => doc.getText('shared-text'), [doc]);

  const [text, setText] = useState<string>('');
  const [status, setStatus] = useState<Status>('connecting');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let provider: WebsocketProvider | null = null;
    try {
      provider = new WebsocketProvider(WS_BASE, ROOM_ID, doc);
    } catch (err) {
      console.error('[spike:yjs-do] WS provider construction failed', err);
      setError('同期サーバへの接続に失敗しました');
      return;
    }

    const onStatus = ({ status: s }: { status: string }) => {
      console.info('[spike:yjs-do] provider status', s);
      if (s === 'connected') setStatus('connected');
      else if (s === 'disconnected') setStatus('disconnected');
      else setStatus('connecting');
    };
    const onTextChange = () => {
      setText(ytext.toString());
    };
    provider.on('status', onStatus);
    ytext.observe(onTextChange);
    setText(ytext.toString());

    return () => {
      provider?.off('status', onStatus);
      ytext.unobserve(onTextChange);
      provider?.destroy();
    };
  }, [doc, ytext]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    doc.transact(() => {
      ytext.delete(0, ytext.length);
      ytext.insert(0, next);
    });
  };

  return (
    <main className="page">
      <header>
        <h1>Spike B — Yjs + Durable Objects</h1>
        <p className="hint">2 タブで開いて入力すると同期されます</p>
        <p className={`status status-${status}`}>状態: {status}</p>
        {error && <p className="error">{error}</p>}
      </header>
      <textarea
        value={text}
        onChange={handleChange}
        rows={12}
        placeholder="ここに入力..."
        aria-label="同期テキスト"
      />
    </main>
  );
};

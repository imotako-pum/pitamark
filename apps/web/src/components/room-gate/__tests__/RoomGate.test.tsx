import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RoomGate } from '../RoomGate';

const ROOM = 'V1StGXR8_Z5jdHi6B-mYT';

const setupMount = () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root | undefined;
  act(() => {
    root = createRoot(container);
  });
  return {
    container,
    render: (el: React.ReactElement) => {
      act(() => {
        root?.render(el);
      });
    },
    unmount: () => {
      act(() => {
        root?.unmount();
      });
      container.remove();
    },
  };
};

const flushPromises = () => new Promise((r) => setTimeout(r, 0));

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  sessionStorage.clear();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const findInput = (container: HTMLElement): HTMLInputElement => {
  const el = container.querySelector('input[type="password"]');
  if (!el) throw new Error('password input not found');
  return el as HTMLInputElement;
};

const findButton = (container: HTMLElement): HTMLButtonElement => {
  const el = container.querySelector('button[type="submit"]');
  if (!el) throw new Error('submit button not found');
  return el as HTMLButtonElement;
};

const findForm = (container: HTMLElement): HTMLFormElement => {
  const el = container.querySelector('form');
  if (!el) throw new Error('form not found');
  return el as HTMLFormElement;
};

const setInputValue = (input: HTMLInputElement, value: string) => {
  // happy-dom propagates `value=` setter to React's onChange via the
  // synthetic event system as long as we dispatch a real `input` event.
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

describe('RoomGate', () => {
  it('renders the lock heading, password input, and submit button', () => {
    const m = setupMount();
    m.render(<RoomGate roomId={ROOM} onAuthenticated={() => {}} />);
    expect(m.container.textContent).toContain('このルームはパスワードで保護されています');
    expect(findInput(m.container)).toBeTruthy();
    expect(findButton(m.container).textContent).toContain('入室');
    m.unmount();
  });

  it('disables submit button while password is empty', () => {
    const m = setupMount();
    m.render(<RoomGate roomId={ROOM} onAuthenticated={() => {}} />);
    expect(findButton(m.container).disabled).toBe(true);
    m.unmount();
  });

  it('on success: persists token in sessionStorage and calls onAuthenticated', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ token: 'jwt.synthetic.token' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const onAuth = vi.fn();
    const m = setupMount();
    m.render(<RoomGate roomId={ROOM} onAuthenticated={onAuth} />);

    setInputValue(findInput(m.container), 'letmein');
    await act(async () => {
      findForm(m.container).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await flushPromises();
    });

    expect(onAuth).toHaveBeenCalledWith('jwt.synthetic.token');
    expect(sessionStorage.getItem(`roomToken:${ROOM}`)).toBe('jwt.synthetic.token');
    m.unmount();
  });

  it('on 401: shows the wrong-password message and does not call onAuthenticated', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: false, error: { code: 'UNAUTHORIZED', message: '...' } }), {
        status: 401,
      }),
    );
    const onAuth = vi.fn();
    const m = setupMount();
    m.render(<RoomGate roomId={ROOM} onAuthenticated={onAuth} />);

    setInputValue(findInput(m.container), 'wrong');
    await act(async () => {
      findForm(m.container).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await flushPromises();
    });

    expect(onAuth).not.toHaveBeenCalled();
    expect(m.container.textContent).toContain('パスワードが違います');
    expect(sessionStorage.getItem(`roomToken:${ROOM}`)).toBeNull();
    m.unmount();
  });

  it('on network error: shows the network error message', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const onAuth = vi.fn();
    const m = setupMount();
    m.render(<RoomGate roomId={ROOM} onAuthenticated={onAuth} />);

    setInputValue(findInput(m.container), 'letmein');
    await act(async () => {
      findForm(m.container).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await flushPromises();
    });

    expect(onAuth).not.toHaveBeenCalled();
    expect(m.container.textContent).toContain('ネットワークエラー');
    m.unmount();
  });
});

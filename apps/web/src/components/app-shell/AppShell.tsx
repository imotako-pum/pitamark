import type { ReactNode } from 'react';

type AppShellProps = Readonly<{ children: ReactNode }>;

export const AppShell = ({ children }: AppShellProps) => (
  <main className="app-shell">
    <header className="app-shell-header">
      <h1>snap-share</h1>
    </header>
    <section className="app-shell-body">{children}</section>
  </main>
);

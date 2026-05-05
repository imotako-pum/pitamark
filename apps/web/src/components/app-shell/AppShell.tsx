import type { ReactNode } from 'react';
import { useTranslation } from '../../i18n';

type AppShellProps = Readonly<{ children: ReactNode }>;

export const AppShell = ({ children }: AppShellProps) => {
  const t = useTranslation();
  return (
    <main className="app-shell">
      <header className="app-shell-header">
        <h1>{t('common.appName')}</h1>
      </header>
      <section className="app-shell-body">{children}</section>
    </main>
  );
};

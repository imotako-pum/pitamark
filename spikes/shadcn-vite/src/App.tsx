import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export const App = () => {
  const [name, setName] = useState('');
  const [submitted, setSubmitted] = useState<string | null>(null);

  return (
    <main className="min-h-screen p-8 flex flex-col items-center justify-center gap-6">
      <header className="text-center space-y-2">
        <h1 className="text-2xl font-semibold">Spike C — shadcn/ui</h1>
        <p className="text-muted-foreground">
          Vite + Tailwind v4 + shadcn 互換コンポーネントの動作確認
        </p>
      </header>

      <section className="flex flex-wrap items-center justify-center gap-3">
        <Button>Default</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="link">Link</Button>
      </section>

      <Dialog>
        <DialogTrigger asChild>
          <Button>名前を入力する</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>こんにちは</DialogTitle>
            <DialogDescription>
              日本語UIが正しく表示されるか、Esc/×で閉じられるかを確認します。
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="お名前"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <DialogFooter>
            <Button
              onClick={() => {
                setSubmitted(name);
              }}
            >
              送信
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {submitted && (
        <p className="text-sm" role="status">
          送信値: <strong>{submitted}</strong>
        </p>
      )}
    </main>
  );
};

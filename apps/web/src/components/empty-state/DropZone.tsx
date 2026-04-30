import { ImagePlus } from 'lucide-react';
import { type DragEvent, useEffect, useState } from 'react';

type DropZoneProps = Readonly<{
  onFile: (file: File) => void;
  error: string | null;
}>;

export const DropZone = ({ onFile, error }: DropZoneProps) => {
  const [isOver, setIsOver] = useState(false);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = e.clipboardData?.files?.[0];
      if (file) {
        onFile(file);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [onFile]);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!isOver) setIsOver(true);
  };

  const handleDragLeave = () => setIsOver(false);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      onFile(file);
    }
  };

  return (
    <section
      aria-labelledby="dropzone-heading"
      className="grid h-full w-full place-items-center px-6"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div
        className={[
          'flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-12 py-16',
          'transition-colors duration-[var(--duration-normal)] ease-[var(--ease-out-expo)]',
          isOver
            ? 'border-[color:var(--color-accent)] bg-[color:oklch(96%_0.05_250)]'
            : 'border-[color:var(--color-toolbar-border)] bg-[color:var(--color-surface)]',
        ].join(' ')}
      >
        <ImagePlus size={48} strokeWidth={1.25} className="text-[color:var(--color-accent)]" />
        <h2 id="dropzone-heading" className="text-lg font-medium">
          画像をドロップしてください
        </h2>
        <p className="text-sm opacity-75">
          または <kbd className="rounded border px-1.5 py-0.5 text-xs">⌘V</kbd>{' '}
          でクリップボード画像を貼り付け
        </p>
        <p className="text-xs opacity-60">PNG / JPEG / WebP / SVG (10MB まで)</p>
        {error && (
          <p
            role="alert"
            className="mt-2 rounded-md bg-[color:oklch(96%_0.05_27)] px-3 py-1.5 text-sm text-[color:oklch(40%_0.22_27)]"
          >
            {error}
          </p>
        )}
      </div>
    </section>
  );
};

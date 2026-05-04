import { ALLOWED_IMAGE_MIME_TYPES } from '@snap-share/shared';
import { ImagePlus } from 'lucide-react';
import { type ChangeEvent, type DragEvent, useEffect, useRef, useState } from 'react';

type DropZoneProps = Readonly<{
  onFile: (file: File) => void;
  error: string | null;
}>;

const ACCEPT_ATTRIBUTE = ALLOWED_IMAGE_MIME_TYPES.join(',');

export const DropZone = ({ onFile, error }: DropZoneProps) => {
  const [isOver, setIsOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const handleDragOver = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    if (!isOver) setIsOver(true);
  };

  const handleDragLeave = () => setIsOver(false);

  const handleDrop = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    setIsOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      onFile(file);
    }
  };

  const openPicker = () => inputRef.current?.click();

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
    // Reset so re-selecting the same file fires onChange again.
    e.target.value = '';
  };

  return (
    <section
      aria-labelledby="dropzone-heading"
      className="grid h-full w-full place-items-center px-6"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <button
        type="button"
        onClick={openPicker}
        aria-labelledby="dropzone-heading"
        className={[
          'flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-12 py-16',
          'transition-colors duration-(--duration-normal) ease-(--ease-out-expo)',
          'focus-visible:ring-2 focus-visible:ring-(--color-accent) focus-visible:outline-none',
          isOver
            ? 'border-(--color-accent) bg-[oklch(96%_0.05_250)]'
            : 'border-(--color-toolbar-border) bg-(--color-surface)',
        ].join(' ')}
      >
        <ImagePlus size={48} strokeWidth={1.25} className="text-(--color-accent)" />
        <h2 id="dropzone-heading" className="text-lg font-medium">
          画像をドロップしてください
        </h2>
        <p className="text-sm opacity-75">
          クリックで選択、または <kbd className="rounded border px-1.5 py-0.5 text-xs">⌘V</kbd>{' '}
          で貼り付け
        </p>
        <p className="text-xs opacity-60">PNG / JPEG / WebP / SVG (10MB まで)</p>
        {error && (
          <p
            role="alert"
            className="mt-2 rounded-md bg-[oklch(96%_0.05_27)] px-3 py-1.5 text-sm text-[oklch(40%_0.22_27)]"
          >
            {error}
          </p>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={handleInputChange}
      />
    </section>
  );
};

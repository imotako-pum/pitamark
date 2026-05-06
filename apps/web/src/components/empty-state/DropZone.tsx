import { ALLOWED_IMAGE_MIME_TYPES } from '@pitamark/shared';
import { ImagePlus } from 'lucide-react';
import { type ChangeEvent, type DragEvent, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from '../../i18n';

type DropZoneProps = Readonly<{
  onFile: (file: File) => void;
  error: string | null;
}>;

const ACCEPT_ATTRIBUTE = ALLOWED_IMAGE_MIME_TYPES.join(',');

export const DropZone = ({ onFile, error }: DropZoneProps) => {
  const t = useTranslation();
  const [isOver, setIsOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const errorId = useId();

  // 最新の `onFile` を ref に格納して、paste effect の deps を空に保てるようにする。
  // 以前は caller (LocalEditor の `useCallback`) で memo 化しないと render 毎に paste
  // listener が再 attach される不可視の契約があった。`useKeyboardShortcuts` と同じ
  // ref パターンで揃えている。
  const onFileRef = useRef(onFile);
  onFileRef.current = onFile;

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = e.clipboardData?.files?.[0];
      if (file) onFileRef.current(file);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

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
    // 同じファイルを再選択しても onChange が発火するように reset する。
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
      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={openPicker}
          aria-labelledby="dropzone-heading"
          aria-describedby={error ? errorId : undefined}
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
            {t('dropzone.headline')}
          </h2>
          <p className="text-sm opacity-75">
            {t('dropzone.instructionPrefix')}{' '}
            <kbd className="rounded border px-1.5 py-0.5 text-xs">⌘V</kbd>
            {t('dropzone.instructionSuffix') ? ` ${t('dropzone.instructionSuffix')}` : ''}
          </p>
          <p className="text-xs opacity-60">{t('dropzone.formats')}</p>
        </button>
        {/* error を <button> の表示内に置かないことで、screen reader が button 名と
            alert 文を 1 塊で読み上げないようにする。focus 文脈は上の `aria-describedby`
            で繋いでいる。 */}
        {error && (
          <p
            id={errorId}
            role="alert"
            className="rounded-md bg-[oklch(96%_0.05_27)] px-3 py-1.5 text-sm text-[oklch(40%_0.22_27)]"
          >
            {error}
          </p>
        )}
      </div>
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

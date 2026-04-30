import type { TextAnnotation } from '@snap-share/shared';
import { useEffect, useRef } from 'react';
import { OUTLINE_ACCENT } from './colors';

type TextEditorOverlayProps = Readonly<{
  annotation: TextAnnotation;
  stageContainerRect: DOMRect;
  onCommit: (text: string) => void;
  onCancel: () => void;
}>;

const PADDING = 4;

export const TextEditorOverlay = ({
  annotation,
  stageContainerRect,
  onCommit,
  onCancel,
}: TextEditorOverlayProps) => {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.select();
  }, []);

  return (
    <textarea
      ref={ref}
      defaultValue={annotation.text}
      aria-label="注釈テキストを編集"
      style={{
        position: 'absolute',
        left: stageContainerRect.left + annotation.x - PADDING,
        top: stageContainerRect.top + annotation.y - PADDING,
        minWidth: '6ch',
        padding: PADDING,
        margin: 0,
        border: `1px dashed ${OUTLINE_ACCENT}`,
        background: 'rgba(255, 255, 255, 0.95)',
        color: annotation.fill,
        fontSize: annotation.fontSize,
        fontFamily: 'inherit',
        lineHeight: 1.2,
        resize: 'both',
        outline: 'none',
        zIndex: 100,
      }}
      onBlur={(e) => onCommit(e.currentTarget.value)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          onCommit(e.currentTarget.value);
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          onCancel();
        }
      }}
      onClick={(e) => e.stopPropagation()}
    />
  );
};

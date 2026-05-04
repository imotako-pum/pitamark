import type { TextAnnotation } from '@snap-share/shared';
import { useEffect, useRef } from 'react';
import { useTranslation } from '../../i18n';
import { OUTLINE_ACCENT } from './colors';

type TextEditorOverlayProps = Readonly<{
  annotation: TextAnnotation;
  stageContainerRect: DOMRect;
  /** Stage transform so the textarea overlays the matching Konva text under
   *  zoom and pan. Identity when the canvas is not zoomed/panned. */
  transform: { scale: number; x: number; y: number };
  onCommit: (text: string) => void;
  onCancel: () => void;
}>;

const PADDING = 4;

export const TextEditorOverlay = ({
  annotation,
  stageContainerRect,
  transform,
  onCommit,
  onCancel,
}: TextEditorOverlayProps) => {
  const t = useTranslation();
  const ref = useRef<HTMLTextAreaElement>(null);
  const armedRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.select();
    // Ignore the first blur events that fire from the same click that
    // mounted the textarea (mousedown -> mount -> mouseup loses focus).
    const t = setTimeout(() => {
      armedRef.current = true;
    }, 250);
    return () => clearTimeout(t);
  }, []);

  return (
    <textarea
      ref={ref}
      defaultValue={annotation.text}
      aria-label={t('canvas.textEditor.aria')}
      style={{
        position: 'absolute',
        left: stageContainerRect.left + annotation.x * transform.scale + transform.x - PADDING,
        top: stageContainerRect.top + annotation.y * transform.scale + transform.y - PADDING,
        minWidth: '6ch',
        padding: PADDING,
        margin: 0,
        border: `1px dashed ${OUTLINE_ACCENT}`,
        background: 'rgba(255, 255, 255, 0.95)',
        color: annotation.color,
        fontSize: annotation.fontSize * transform.scale,
        fontFamily: 'inherit',
        lineHeight: 1.2,
        resize: 'both',
        outline: 'none',
        zIndex: 100,
      }}
      onBlur={(e) => {
        if (!armedRef.current) return;
        onCommit(e.currentTarget.value);
      }}
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

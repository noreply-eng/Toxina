import React from 'react';

interface AutoResizeTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  minRows?: number;
}

const AutoResizeTextarea = React.forwardRef<HTMLTextAreaElement, AutoResizeTextareaProps>(
  ({ minRows = 1, className = '', onChange, ...props }, forwardedRef) => {
    const innerRef = React.useRef<HTMLTextAreaElement | null>(null);

    const setRefs = React.useCallback(
      (el: HTMLTextAreaElement | null) => {
        innerRef.current = el;
        if (typeof forwardedRef === 'function') forwardedRef(el);
        else if (forwardedRef) forwardedRef.current = el;
      },
      [forwardedRef]
    );

    const adjustHeight = React.useCallback(() => {
      const el = innerRef.current;
      if (!el) return;

      el.style.height = 'auto';
      const styles = getComputedStyle(el);
      const lineHeight = Number.parseFloat(styles.lineHeight) || 18;
      const padding =
        Number.parseFloat(styles.paddingTop) + Number.parseFloat(styles.paddingBottom);
      const minHeight = lineHeight * minRows + padding;
      el.style.height = `${Math.max(el.scrollHeight, minHeight)}px`;
    }, [minRows]);

    React.useLayoutEffect(() => {
      adjustHeight();
    }, [props.value, adjustHeight]);

    React.useEffect(() => {
      const el = innerRef.current;
      if (!el || typeof ResizeObserver === 'undefined') return;

      const observer = new ResizeObserver(() => adjustHeight());
      observer.observe(el);
      return () => observer.disconnect();
    }, [adjustHeight]);

    return (
      <textarea
        ref={setRefs}
        rows={minRows}
        onChange={(e) => {
          onChange?.(e);
          requestAnimationFrame(adjustHeight);
        }}
        className={`overflow-hidden resize-none ${className}`.trim()}
        {...props}
      />
    );
  }
);

AutoResizeTextarea.displayName = 'AutoResizeTextarea';

export default AutoResizeTextarea;

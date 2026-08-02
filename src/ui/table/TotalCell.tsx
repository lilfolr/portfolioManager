import { Mono } from '../text';

/**
 * A totals-row cell. The first column carries the row's label ("TOTAL", or the
 * financial year) in the smaller tracked style; the rest carry figures.
 */
export function TotalCell({
  text,
  label = false,
}: {
  text: string;
  label?: boolean;
}) {
  return (
    <Mono
      className={
        label
          ? 'font-mono-med text-[11px] tracking-[0.9px] text-mid'
          : 'font-mono-med text-[13px] text-strong'
      }
    >
      {text}
    </Mono>
  );
}

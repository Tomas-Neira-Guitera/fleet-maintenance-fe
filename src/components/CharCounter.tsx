import { TITLE_MAX_LENGTH } from '../utils/textLimits';

interface CharCounterProps {
  value: string;
  max?: number;
}

export function CharCounter({ value, max = TITLE_MAX_LENGTH }: CharCounterProps) {
  const atLimit = value.length >= max;
  return (
    <span className={`char-counter${atLimit ? ' char-counter--limit' : ''}`} aria-live="polite">
      {value.length}/{max}
    </span>
  );
}

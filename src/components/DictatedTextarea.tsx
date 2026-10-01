import { useDictation } from '../hooks/useDictation';
import { MicIcon, StopIcon } from './icons';

interface DictatedTextareaProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  rows?: number;
  placeholder?: string;
  disabled?: boolean;
}

function appendDictated(current: string, text: string, maxLength?: number): string {
  const phrase = text.charAt(0).toUpperCase() + text.slice(1);
  const separator = current.trim() ? (/[.!?…]$/.test(current.trim()) ? ' ' : '. ') : '';
  const next = `${current.trim()}${separator}${phrase}`;
  return maxLength ? next.slice(0, maxLength) : next;
}

/**
 * CAM-32: campo de texto largo que también se puede dictar. Lo dictado se agrega al final y
 * queda editable. Si el navegador no soporta el dictado, el botón no aparece y se escribe.
 */
export function DictatedTextarea({ id, value, onChange, maxLength, rows = 3, placeholder, disabled }: DictatedTextareaProps) {
  const { supported, listening, interim, error, toggle } = useDictation((text) =>
    onChange(appendDictated(value, text, maxLength)),
  );

  return (
    <div className="dictated-field">
      <textarea
        id={id}
        className="defect-textarea"
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
      <div className="dictated-field__bar">
        {supported && (
          <button
            type="button"
            className={`dictate-btn${listening ? ' dictate-btn--listening' : ''}`}
            onClick={toggle}
            disabled={disabled}
            aria-pressed={listening}
          >
            {listening ? <StopIcon width={18} height={18} /> : <MicIcon width={18} height={18} />}
            {listening ? 'Terminar' : 'Dictar'}
          </button>
        )}
        {maxLength && (
          <span className="char-counter">
            {value.length}/{maxLength}
          </span>
        )}
      </div>
      {listening && (
        <p className="dictated-field__status" aria-live="polite">
          <span className="dictated-field__dot" />
          {interim || 'Escuchando… hablá cerca del celular.'}
        </p>
      )}
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}

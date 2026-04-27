import { useCallback } from 'react';
import { Button } from './button.js';

export type NumpadProps = {
  value: string;
  onChange: (next: string) => void;
  maxLength?: number;
  onSubmit?: () => void;
  showDecimal?: boolean;
};

const KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
] as const;

export function Numpad({ value, onChange, maxLength = 12, onSubmit, showDecimal }: NumpadProps) {
  const press = useCallback(
    (k: string) => {
      if (value.length >= maxLength && k !== 'back') return;
      if (k === 'back') {
        onChange(value.slice(0, -1));
        return;
      }
      onChange(value + k);
    },
    [value, onChange, maxLength],
  );

  return (
    <div className="grid grid-cols-3 gap-2">
      {KEYS.flat().map((k) => (
        <Button key={k} variant="secondary" size="xl" onClick={() => press(k)}>
          {k}
        </Button>
      ))}
      <Button
        variant="secondary"
        size="xl"
        onClick={() => press('.')}
        disabled={!showDecimal || value.includes('.')}
      >
        {showDecimal ? '.' : ''}
      </Button>
      <Button variant="secondary" size="xl" onClick={() => press('0')}>
        0
      </Button>
      <Button variant="secondary" size="xl" onClick={() => press('back')}>
        ←
      </Button>
      {onSubmit ? (
        <Button variant="primary" size="xl" className="col-span-3" onClick={onSubmit}>
          OK
        </Button>
      ) : null}
    </div>
  );
}

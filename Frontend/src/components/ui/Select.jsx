import { useCallback, useEffect, useId, useRef, useState } from 'react';

const ChevronIcon = ({ open }) => (
  <svg
    className={`w-4 h-4 text-gray-500 shrink-0 transition-transform duration-150 ${
      open ? 'rotate-180' : ''
    }`}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden="true"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

/**
 * Accessible custom select matching app input-field / menu styling.
 * onChange receives a synthetic event with e.target.value (native <select> shape).
 *
 * @param {{ value: string|number, onChange: Function, options: Array<{value:string|number,label:string}>, disabled?: boolean, className?: string, id?: string, 'aria-label'?: string, name?: string, placement?: 'top'|'bottom' }} props
 */
export default function Select({
  value,
  onChange,
  options = [],
  disabled = false,
  className = '',
  id,
  name,
  placement = 'bottom',
  'aria-label': ariaLabel,
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const rootRef = useRef(null);
  const listRef = useRef(null);
  const autoId = useId();
  const listboxId = `${autoId}-listbox`;
  const triggerId = id || `${autoId}-trigger`;

  const selectedIndex = options.findIndex(
    (opt) => String(opt.value) === String(value)
  );
  const selected =
    selectedIndex >= 0 ? options[selectedIndex] : options[0] || null;

  const close = useCallback(() => {
    setOpen(false);
    setHighlight(-1);
  }, []);

  const emitChange = useCallback(
    (nextValue) => {
      if (typeof onChange !== 'function') return;
      onChange({
        target: { value: nextValue, name: name || undefined },
        currentTarget: { value: nextValue, name: name || undefined },
      });
    },
    [onChange, name]
  );

  const selectOption = useCallback(
    (opt) => {
      if (disabled || !opt) return;
      emitChange(opt.value);
      close();
    },
    [disabled, emitChange, close]
  );

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        close();
      }
    };

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    setHighlight(selectedIndex >= 0 ? selectedIndex : 0);
  }, [open, selectedIndex]);

  useEffect(() => {
    if (!open || highlight < 0 || !listRef.current) return;
    const el = listRef.current.children[highlight];
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [open, highlight]);

  const onTriggerKeyDown = (e) => {
    if (disabled) return;

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        if (highlight >= 0 && options[highlight]) {
          selectOption(options[highlight]);
        }
        return;
      }
      if (e.key === 'ArrowDown') {
        setHighlight((i) => Math.min((i < 0 ? selectedIndex : i) + 1, options.length - 1));
      }
      if (e.key === 'ArrowUp') {
        setHighlight((i) => Math.max((i < 0 ? selectedIndex : i) - 1, 0));
      }
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      close();
    }
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        id={triggerId}
        name={name}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-label={ariaLabel}
        onClick={() => {
          if (disabled) return;
          setOpen((v) => !v);
        }}
        onKeyDown={onTriggerKeyDown}
        className={`input-field flex items-center justify-between gap-2 text-left cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
          open ? 'border-black ring-1 ring-black' : ''
        }`}
      >
        <span className="truncate min-w-0">
          {selected ? selected.label : 'Select…'}
        </span>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-labelledby={triggerId}
          tabIndex={-1}
          className={`absolute z-50 w-full min-w-[8rem] max-h-56 overflow-y-auto overflow-x-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg ${
            placement === 'top' ? 'bottom-full mb-1.5' : 'mt-1.5'
          }`}
        >
          {options.map((opt, index) => {
            const isSelected = String(opt.value) === String(value);
            const isHighlighted = index === highlight;
            return (
              <li
                key={String(opt.value)}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setHighlight(index)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectOption(opt)}
                className={`px-3 py-2 text-sm cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-gray-100 font-semibold text-gray-900'
                    : isHighlighted
                      ? 'bg-gray-50 text-gray-900'
                      : 'text-gray-700'
                }`}
              >
                {opt.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

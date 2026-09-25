import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

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
 * When `onSearchChange` is provided with `searchable`, filtering is left to the parent
 * (server-side / async search). Otherwise options are filtered locally by label.
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
  searchable = false,
  searchPlaceholder = 'Search…',
  onSearchChange,
  searchLoading = false,
  'aria-label': ariaLabel,
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [query, setQuery] = useState('');
  const rootRef = useRef(null);
  const listRef = useRef(null);
  const searchRef = useRef(null);
  const autoId = useId();
  const listboxId = `${autoId}-listbox`;
  const triggerId = id || `${autoId}-trigger`;
  const searchId = `${autoId}-search`;
  const asyncSearch = searchable && typeof onSearchChange === 'function';

  const selectedInAll = useMemo(
    () => options.find((opt) => String(opt.value) === String(value)) || null,
    [options, value]
  );

  const displayedOptions = useMemo(() => {
    if (asyncSearch || !searchable || !query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter((opt) =>
      String(opt.label ?? '').toLowerCase().includes(q)
    );
  }, [options, searchable, query, asyncSearch]);

  const close = useCallback(() => {
    setOpen(false);
    setHighlight(-1);
    setQuery('');
    if (asyncSearch) onSearchChange('');
  }, [asyncSearch, onSearchChange]);

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
    const selectedFilteredIndex = displayedOptions.findIndex(
      (opt) => String(opt.value) === String(value)
    );
    setHighlight(selectedFilteredIndex >= 0 ? selectedFilteredIndex : 0);
  }, [open, value, displayedOptions]);

  useEffect(() => {
    if (!open || !searchable) return;
    const t = requestAnimationFrame(() => {
      searchRef.current?.focus();
    });
    return () => cancelAnimationFrame(t);
  }, [open, searchable]);

  useEffect(() => {
    if (!open || highlight < 0 || !listRef.current) return;
    const el = listRef.current.children[highlight];
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [open, highlight]);

  const moveHighlight = (delta) => {
    if (displayedOptions.length === 0) {
      setHighlight(-1);
      return;
    }
    setHighlight((i) => {
      const start = i < 0 ? 0 : i;
      const next = start + delta;
      if (next < 0) return 0;
      if (next >= displayedOptions.length) return displayedOptions.length - 1;
      return next;
    });
  };

  const onListKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveHighlight(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveHighlight(-1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlight >= 0 && displayedOptions[highlight]) {
        selectOption(displayedOptions[highlight]);
      }
    }
  };

  const onTriggerKeyDown = (e) => {
    if (disabled) return;

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        if (highlight >= 0 && displayedOptions[highlight]) {
          selectOption(displayedOptions[highlight]);
        }
        return;
      }
      if (e.key === 'ArrowDown') moveHighlight(1);
      if (e.key === 'ArrowUp') moveHighlight(-1);
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      close();
    }
  };

  const handleSearchChange = (e) => {
    const next = e.target.value;
    setQuery(next);
    if (asyncSearch) onSearchChange(next);
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
          if (open) close();
          else setOpen(true);
        }}
        onKeyDown={onTriggerKeyDown}
        className={`input-field flex items-center justify-between gap-2 text-left cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
          open ? 'border-black ring-1 ring-black' : ''
        }`}
      >
        <span className="truncate min-w-0">
          {selectedInAll ? selectedInAll.label : 'Select…'}
        </span>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div
          className={`absolute z-50 w-full min-w-[8rem] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg ${
            placement === 'top' ? 'bottom-full mb-1.5' : 'mt-1.5'
          }`}
        >
          {searchable && (
            <div className="border-b border-gray-100 p-1.5">
              <input
                ref={searchRef}
                id={searchId}
                type="text"
                value={query}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                autoComplete="off"
                onChange={handleSearchChange}
                onKeyDown={onListKeyDown}
                onMouseDown={(e) => e.stopPropagation()}
                className="input-field w-full text-sm py-1.5 px-2"
              />
            </div>
          )}
          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-labelledby={triggerId}
            tabIndex={-1}
            className="max-h-56 overflow-y-auto overflow-x-hidden py-1"
          >
            {searchLoading ? (
              <li className="px-3 py-2 text-sm text-gray-500">Searching…</li>
            ) : displayedOptions.length === 0 ? (
              <li className="px-3 py-2 text-sm text-gray-500">No matches</li>
            ) : (
              displayedOptions.map((opt, index) => {
                const isSelected = String(opt.value) === String(value);
                const isHighlighted = index === highlight;
                return (
                  <li
                    key={String(opt.value)}
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setHighlight(index)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      selectOption(opt);
                    }}
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
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

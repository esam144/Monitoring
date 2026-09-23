/**
 * Shared page shell — consistent spacing without double-padding with the app main.
 */
export default function PageShell({ children, className = '' }) {
  return (
    <div className={`w-full max-w-[1600px] mx-auto space-y-5 sm:space-y-6 ${className}`}>
      {children}
    </div>
  );
}

export function PageHeader({ title, description, actions }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-gray-200 pb-4">
      <div className="min-w-0">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>
      ) : null}
    </div>
  );
}

export function SectionTitle({ title, description, actions }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-900">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-sm text-gray-500">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}

export function AlertBanner({ tone = 'error', children }) {
  const styles =
    tone === 'success'
      ? 'text-emerald-800 bg-emerald-50 border-emerald-100'
      : tone === 'warning'
        ? 'text-amber-800 bg-amber-50 border-amber-100'
        : 'text-red-800 bg-red-50 border-red-100';
  return (
    <div className={`text-sm font-medium border rounded-xl px-3.5 py-2.5 ${styles}`}>
      {children}
    </div>
  );
}

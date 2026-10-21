import { useEffect, useRef } from 'react';

function focusField(id: string) {
  const element = document.getElementById(id);
  if (!element) return;
  const target = element.matches('input, select, textarea')
    ? element
    : element.querySelector<HTMLElement>('input:checked, input, select, textarea');
  element.scrollIntoView({ block: 'center' });
  (target ?? element).focus();
}

/** Listed in form order. Focus moves here on submit; each item jumps to its field. */
export function ErrorSummary<F extends string>({
  errors,
  order,
  idFor,
}: {
  errors: Partial<Record<F, string>>;
  order: F[];
  idFor: (field: F) => string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);

  const fields = order.filter((field) => errors[field]);
  if (fields.length === 0) return null;

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      aria-labelledby="error-summary-title"
      className="mb-8 rounded-md border-2 border-danger bg-surface px-5 py-4"
    >
      <h2 id="error-summary-title" className="text-lg font-semibold text-danger">
        {fields.length === 1 ? 'One thing to fix before saving' : `${fields.length} things to fix before saving`}
      </h2>
      <ul className="mt-2 space-y-1">
        {fields.map((field) => (
          <li key={field}>
            <a
              href={`#${idFor(field)}`}
              onClick={(event) => {
                event.preventDefault();
                focusField(idFor(field));
              }}
              className="inline-block py-1 font-medium text-danger underline underline-offset-2"
            >
              {errors[field]}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

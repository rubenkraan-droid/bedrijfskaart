import type { ReactNode } from 'react';

/** Bouwstenen voor de beheerformulieren. Geen eigen toestand, dus servercode. */

const INVOER =
  'border-rand focus:border-groen-700 min-h-11 w-full rounded-md border bg-white px-3 text-sm outline-none';

export function Veld({
  naam,
  label,
  waarde,
  type = 'text',
  verplicht,
  plaatshouder,
  hint,
}: {
  naam: string;
  label: string;
  waarde?: string | number | null;
  type?: 'text' | 'email' | 'url' | 'number' | 'date' | 'tel';
  verplicht?: boolean;
  plaatshouder?: string;
  hint?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-sm font-medium">
        {label}
        {!verplicht && <span className="text-inkt-zacht font-normal"> (optioneel)</span>}
      </span>
      <input
        name={naam}
        type={type}
        required={verplicht}
        defaultValue={waarde ?? ''}
        placeholder={plaatshouder}
        className={INVOER}
      />
      {hint && <span className="text-inkt-zacht block text-xs">{hint}</span>}
    </label>
  );
}

export function Tekstvak({
  naam,
  label,
  waarde,
  regels = 3,
  plaatshouder,
}: {
  naam: string;
  label: string;
  waarde?: string | null;
  regels?: number;
  plaatshouder?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-sm font-medium">
        {label}
        <span className="text-inkt-zacht font-normal"> (optioneel)</span>
      </span>
      <textarea
        name={naam}
        rows={regels}
        defaultValue={waarde ?? ''}
        placeholder={plaatshouder}
        className="border-rand focus:border-groen-700 w-full rounded-md border bg-white px-3 py-2 text-sm outline-none"
      />
    </label>
  );
}

export function Keuze({
  naam,
  label,
  waarde,
  opties,
  verplicht,
}: {
  naam: string;
  label: string;
  waarde?: string | null;
  opties: Array<{ waarde: string; label: string }>;
  verplicht?: boolean;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-sm font-medium">{label}</span>
      <select
        name={naam}
        required={verplicht}
        defaultValue={waarde ?? opties[0]?.waarde}
        className={INVOER}
      >
        {opties.map((o) => (
          <option key={o.waarde} value={o.waarde}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Sectie({
  titel,
  toelichting,
  children,
  acties,
}: {
  titel: string;
  toelichting?: string;
  children: ReactNode;
  acties?: ReactNode;
}) {
  return (
    <section className="border-rand bg-paneel rounded-lg border">
      <div className="border-rand flex flex-wrap items-start justify-between gap-3 border-b px-5 py-3.5">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight">{titel}</h2>
          {toelichting && (
            <p className="text-inkt-zacht mt-0.5 text-sm">{toelichting}</p>
          )}
        </div>
        {acties}
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

export function Leeg({ tekst }: { tekst: string }) {
  return (
    <p className="border-rand text-inkt-zacht rounded-md border border-dashed px-4 py-5 text-center text-sm">
      {tekst}
    </p>
  );
}

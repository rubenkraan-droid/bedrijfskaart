'use client';

import { useActionState, useEffect, useRef, type ReactNode } from 'react';
import type { Uitkomst } from '@/lib/acties';

type Actie = (vorige: Uitkomst | null, data: FormData) => Promise<Uitkomst>;

/**
 * Formulier rond een wijziging, met de melding of de fout eronder.
 *
 * De site is statisch, dus er is geen server die de pagina opnieuw opbouwt.
 * Daarom roept het formulier na een geslaagde wijziging naAfloop aan, zodat de
 * pagina de bijgewerkte gegevens zelf ophaalt.
 */
export default function Formulier({
  actie,
  knop,
  children,
  stil,
  klasse,
  naAfloop,
  leegNaAfloop,
}: {
  actie: Actie;
  knop: string;
  children: ReactNode;
  /** Verberg de geluktmelding, handig in lange lijsten. */
  stil?: boolean;
  klasse?: string;
  /** Wordt aangeroepen na een geslaagde wijziging. */
  naAfloop?: () => void;
  /** Maak de velden leeg na een geslaagde wijziging, voor toevoegformulieren. */
  leegNaAfloop?: boolean;
}) {
  const [uitkomst, verzend, bezig] = useActionState(actie, null);
  const formulier = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (uitkomst?.ok) {
      naAfloop?.();
      if (leegNaAfloop) formulier.current?.reset();
    }
    // Alleen reageren op een nieuwe uitkomst.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uitkomst]);

  return (
    <form ref={formulier} action={verzend} className={klasse ?? 'space-y-3'}>
      {children}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={bezig}
          className="bg-groen-700 hover:bg-groen-800 flex min-h-11 items-center rounded-md px-4 text-sm font-medium text-white transition-colors disabled:opacity-50"
        >
          {bezig ? 'Bezig...' : knop}
        </button>

        {uitkomst && !uitkomst.ok && (
          <p role="alert" className="text-sm text-red-700">
            {uitkomst.fout}
          </p>
        )}
        {uitkomst?.ok && !stil && uitkomst.melding && (
          <p role="status" className="text-groen-700 text-sm">
            {uitkomst.melding}
          </p>
        )}
      </div>
    </form>
  );
}

/**
 * Compacte verwijderknop voor een regel in een lijst. Vraagt eerst om een
 * bevestiging, want verwijderen werkt door op alles wat eraan hangt.
 */
export function VerwijderKnop({
  actie,
  velden,
  bevestiging,
  label = 'Verwijderen',
  naAfloop,
}: {
  actie: Actie;
  /** Verborgen velden, bijvoorbeeld { id, entiteit_id }. */
  velden: Record<string, string>;
  bevestiging: string;
  label?: string;
  naAfloop?: () => void;
}) {
  const [uitkomst, verzend, bezig] = useActionState(actie, null);

  useEffect(() => {
    if (uitkomst?.ok) naAfloop?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uitkomst]);

  return (
    <form
      action={verzend}
      onSubmit={(e) => {
        if (!window.confirm(bevestiging)) e.preventDefault();
      }}
      className="shrink-0"
    >
      {Object.entries(velden).map(([naam, waarde]) => (
        <input key={naam} type="hidden" name={naam} value={waarde} />
      ))}
      <button
        type="submit"
        disabled={bezig}
        title={uitkomst && !uitkomst.ok ? uitkomst.fout : label}
        className="flex min-h-11 items-center rounded-md px-2.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
      >
        {bezig ? '...' : label}
      </button>
      {uitkomst && !uitkomst.ok && (
        <span role="alert" className="sr-only">
          {uitkomst.fout}
        </span>
      )}
    </form>
  );
}

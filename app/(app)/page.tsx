'use client';

import Werkblad from '@/components/Werkblad';
import { useGebruiker } from '@/lib/auth';
import { ofFout, useGegevens } from '@/lib/gegevens';
import { supabaseBrowser } from '@/lib/supabase/client';
import type { Entiteit, Relatie } from '@/lib/types';

/**
 * De kaart.
 *
 * De gegevens worden hier in de browser opgehaald met de sessie van de
 * gebruiker. Row Level Security filtert mee: onderdelen zonder toegang komen
 * niet in het antwoord, en een relatielijn alleen als beide uiteinden zichtbaar
 * zijn. Er is dus geen server nodig om dit af te schermen.
 */
export default function KaartPagina() {
  const ik = useGebruiker();

  const { data, bezig, fout } = useGegevens(`kaart-${ik?.gebruikerId ?? ''}`, async () => {
    const db = supabaseBrowser();
    const [entiteiten, relaties] = await Promise.all([
      ofFout<Entiteit[]>(db.from('kaart_entiteiten').select('*').order('naam')),
      ofFout<Relatie[]>(db.from('kaart_relaties').select('*')),
    ]);
    return { entiteiten, relaties };
  });

  if (!ik) return null;

  if (fout) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="max-w-md text-center">
          <h1 className="text-lg font-semibold">De kaart kon niet geladen worden</h1>
          <p className="text-inkt-zacht mt-2 text-sm">{fout}</p>
        </div>
      </main>
    );
  }

  if (bezig || !data) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <p className="text-inkt-zacht text-sm">Bezig met laden...</p>
      </main>
    );
  }

  return (
    <Werkblad
      entiteiten={data.entiteiten}
      relaties={data.relaties}
      isBeheerder={ik.isBeheerder}
      naam={ik.naam}
      email={ik.email}
    />
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Gegevens ophalen uit de database, met een laadstand en een foutmelding.
 *
 * De uitkomst wordt bewaard met de sleutel waar die bij hoort. Zolang de
 * bewaarde sleutel niet overeenkomt met de gevraagde, geldt het geheel als
 * "bezig". Zo hoeft er in het effect niets synchroon leeggemaakt te worden en
 * blijven er geen oude gegevens van een vorig onderdeel in beeld staan.
 *
 * Alle aanroepen gaan via de sessie van de gebruiker, dus door Row Level
 * Security heen: wat iemand niet mag zien, komt hier niet uit.
 */
export function useGegevens<T>(sleutel: string, haal: () => Promise<T>) {
  const [teller, setTeller] = useState(0);
  const [stand, setStand] = useState<{
    sleutel: string;
    data: T | null;
    fout: string | null;
  }>({ sleutel: '', data: null, fout: null });

  const volledigeSleutel = `${sleutel}#${teller}`;

  useEffect(() => {
    let afgebroken = false;

    haal()
      .then((data) => {
        if (!afgebroken) setStand({ sleutel: volledigeSleutel, data, fout: null });
      })
      .catch((e: unknown) => {
        if (!afgebroken) {
          setStand({
            sleutel: volledigeSleutel,
            data: null,
            fout: e instanceof Error ? e.message : 'Ophalen mislukt.',
          });
        }
      });

    return () => {
      afgebroken = true;
    };
    // haal is bij elke render een nieuwe functie; de sleutel bepaalt wanneer er
    // opnieuw opgehaald moet worden.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volledigeSleutel]);

  const actueel = stand.sleutel === volledigeSleutel;
  const herlaad = useCallback(() => setTeller((t) => t + 1), []);

  return {
    data: actueel ? stand.data : null,
    bezig: !actueel,
    fout: actueel ? stand.fout : null,
    herlaad,
  };
}

/** Gooit een fout als de database er een teruggeeft, zodat useGegevens die toont. */
export async function ofFout<T>(
  belofte: PromiseLike<{ data: T | null; error: { message: string } | null }>
): Promise<T> {
  const { data, error } = await belofte;
  if (error) throw new Error(error.message);
  return (data ?? []) as T;
}

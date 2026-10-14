'use client';

import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { supabaseBrowser } from './supabase/client';
import type { Rol } from './types';

/**
 * Wie er is ingelogd, en met welke rol.
 *
 * De site is statisch: er is geen server die eerst even kijkt wie je bent. Dat
 * gebeurt hier in de browser. Het is gemak, geen beveiliging. De echte grens
 * ligt in Row Level Security in de database: wie geen toegang heeft tot een
 * onderdeel, krijgt dat ook niet als hij de API rechtstreeks aanroept.
 */

export type Aangemeld = {
  gebruikerId: string;
  email: string;
  naam: string | null;
  rol: Rol;
  isBeheerder: boolean;
};

type Stand =
  | { status: 'laden' }
  | { status: 'uitgelogd' }
  | { status: 'ingelogd'; gebruiker: Aangemeld };

const Context = createContext<{
  stand: Stand;
  uitloggen: () => Promise<void>;
  ververs: () => Promise<void>;
}>({
  stand: { status: 'laden' },
  uitloggen: async () => {},
  ververs: async () => {},
});

export function useAanmelding() {
  return useContext(Context);
}

/** De ingelogde gebruiker, of null zolang er niemand (bekend) is. */
export function useGebruiker(): Aangemeld | null {
  const { stand } = useAanmelding();
  return stand.status === 'ingelogd' ? stand.gebruiker : null;
}

async function haalGebruiker(): Promise<Stand> {
  const db = supabaseBrowser();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { status: 'uitgelogd' };

  const { data } = await db
    .from('kaart_gebruikers')
    .select('rol, naam, email')
    .eq('gebruiker_id', user.id)
    .maybeSingle();

  const rol = (data?.rol ?? 'lezer') as Rol;
  return {
    status: 'ingelogd',
    gebruiker: {
      gebruikerId: user.id,
      email: (data?.email as string | undefined) ?? user.email ?? '',
      naam: (data?.naam as string | null | undefined) ?? null,
      rol,
      isBeheerder: rol === 'beheerder',
    },
  };
}

export function AanmeldingProvider({ children }: { children: ReactNode }) {
  const [stand, setStand] = useState<Stand>({ status: 'laden' });

  useEffect(() => {
    let afgebroken = false;
    const db = supabaseBrowser();

    void haalGebruiker().then((nieuw) => {
      if (!afgebroken) setStand(nieuw);
    });

    // Supabase laat het weten bij in- en uitloggen en bij het verversen van de
    // sessie. Dat is een systeem buiten React, dus een abonnement hoort hier.
    const { data: abonnement } = db.auth.onAuthStateChange((gebeurtenis: string) => {
      if (gebeurtenis === 'SIGNED_OUT') {
        if (!afgebroken) setStand({ status: 'uitgelogd' });
        return;
      }
      void haalGebruiker().then((nieuw) => {
        if (!afgebroken) setStand(nieuw);
      });
    });

    return () => {
      afgebroken = true;
      abonnement.subscription.unsubscribe();
    };
  }, []);

  const uitloggen = useCallback(async () => {
    await supabaseBrowser().auth.signOut();
    setStand({ status: 'uitgelogd' });
  }, []);

  const ververs = useCallback(async () => {
    setStand(await haalGebruiker());
  }, []);

  return (
    <Context.Provider value={{ stand, uitloggen, ververs }}>{children}</Context.Provider>
  );
}

/**
 * Houdt de pagina tegen zolang er niemand is ingelogd, en stuurt die persoon
 * naar het inlogscherm.
 */
export function Beveiligd({
  children,
  alleenBeheerder,
}: {
  children: ReactNode;
  alleenBeheerder?: boolean;
}) {
  const { stand } = useAanmelding();
  const router = useRouter();

  useEffect(() => {
    if (stand.status === 'uitgelogd') {
      // De router werkt met paden zonder basePath, maar window.location heeft
      // die er juist wel bij. Staat de site in een submap, dan moet die er hier
      // af, anders komt hij er bij het terugsturen een tweede keer bij.
      const basis = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
      const volledig = window.location.pathname + window.location.search;
      const hier =
        basis && volledig.startsWith(basis) ? volledig.slice(basis.length) || '/' : volledig;

      const naar =
        hier === '/' ? '/inloggen/' : `/inloggen/?verder=${encodeURIComponent(hier)}`;
      router.replace(naar);
    }
  }, [stand.status, router]);

  if (stand.status === 'laden') return <Wacht />;
  if (stand.status === 'uitgelogd') return <Wacht />;

  if (alleenBeheerder && !stand.gebruiker.isBeheerder) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="max-w-sm text-center">
          <h1 className="text-lg font-semibold tracking-tight">Alleen voor beheerders</h1>
          <p className="text-inkt-zacht mt-2 text-sm leading-relaxed">
            Dit scherm is bedoeld voor beheerders. Vraag er een om de wijziging te
            doen die je nodig hebt.
          </p>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}

function Wacht() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <p className="text-inkt-zacht text-sm">Bezig met laden...</p>
    </main>
  );
}

'use client';

import { useCallback, useSyncExternalStore } from 'react';
import type { Soort } from '@/lib/types';

/**
 * Welke soorten onderdelen iemand op de kaart wil zien.
 *
 * Dit is een voorkeur van die ene persoon in die ene browser, geen instelling
 * voor iedereen. Hij staat daarom in localStorage en niet in de database: zet jij
 * de personen en holdings uit om alleen de actieve bedrijven te zien, dan
 * verandert er niets voor je collega's.
 *
 * localStorage is een systeem buiten React. useSyncExternalStore is daarvoor de
 * aangewezen manier: de pagina wordt vooraf gebouwd zonder die voorkeur, en de
 * browser vult hem aan zodra hij hem kent, zonder dat de twee uit de pas lopen.
 */

const SLEUTEL = 'bedrijfskaart.verborgen-soorten';

/** Vaste lege verzameling, zodat de vooraf gebouwde pagina stabiel blijft. */
const LEEG: ReadonlySet<Soort> = new Set();

let huidig: ReadonlySet<Soort> = LEEG;
let gelezen = false;
const luisteraars = new Set<() => void>();

function lees(): ReadonlySet<Soort> {
  try {
    const ruw = window.localStorage.getItem(SLEUTEL);
    if (!ruw) return LEEG;
    const lijst = JSON.parse(ruw) as unknown;
    if (!Array.isArray(lijst)) return LEEG;
    const soorten = lijst.filter((s): s is Soort => typeof s === 'string');
    return soorten.length > 0 ? new Set(soorten) : LEEG;
  } catch {
    // Privevenster of geblokkeerde opslag: dan toon je gewoon alles.
    return LEEG;
  }
}

function momentopname(): ReadonlySet<Soort> {
  if (!gelezen) {
    huidig = lees();
    gelezen = true;
  }
  return huidig;
}

function momentopnameServer(): ReadonlySet<Soort> {
  return LEEG;
}

function abonneer(melden: () => void) {
  luisteraars.add(melden);
  return () => {
    luisteraars.delete(melden);
  };
}

function zet(nieuw: ReadonlySet<Soort>) {
  huidig = nieuw;
  gelezen = true;
  try {
    window.localStorage.setItem(SLEUTEL, JSON.stringify([...nieuw]));
  } catch {
    // Niet kunnen onthouden is vervelend, maar geen reden om te stoppen.
  }
  for (const melden of luisteraars) melden();
}

export function useSoortFilter() {
  const verborgen = useSyncExternalStore(
    abonneer,
    momentopname,
    momentopnameServer
  );

  const wissel = useCallback((soort: Soort) => {
    const nieuw = new Set(momentopname());
    if (nieuw.has(soort)) nieuw.delete(soort);
    else nieuw.add(soort);
    zet(nieuw);
  }, []);

  const toonAlles = useCallback(() => zet(LEEG), []);

  return { verborgen, wissel, toonAlles };
}

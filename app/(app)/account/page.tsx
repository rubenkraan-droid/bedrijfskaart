'use client';

import Link from 'next/link';
import Kop from '@/components/Kop';
import { Sectie } from '@/components/beheer/velden';
import { useGebruiker } from '@/lib/auth';
import WachtwoordFormulier from './WachtwoordFormulier';

export default function Account() {
  const ik = useGebruiker();
  if (!ik) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Kop naam={ik.naam} email={ik.email} isBeheerder={ik.isBeheerder} />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:px-6">
          <div>
            <Link
              href="/"
              className="text-inkt-zacht hover:text-groen-800 text-sm underline underline-offset-4"
            >
              Terug naar de kaart
            </Link>
            <h1 className="mt-2 text-xl font-semibold tracking-tight">Mijn account</h1>
          </div>

          <Sectie titel="Gegevens">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-inkt-zacht text-xs">E-mailadres</dt>
                <dd className="font-medium">{ik.email}</dd>
              </div>
              <div>
                <dt className="text-inkt-zacht text-xs">Naam</dt>
                <dd className="font-medium">{ik.naam ?? 'Niet ingevuld'}</dd>
              </div>
              <div>
                <dt className="text-inkt-zacht text-xs">Rol</dt>
                <dd className="font-medium">{ik.isBeheerder ? 'Beheerder' : 'Lezer'}</dd>
              </div>
            </dl>
          </Sectie>

          <Sectie
            titel="Wachtwoord wijzigen"
            toelichting="Heb je je wachtwoord van een beheerder gekregen? Zet er dan hier je eigen voor in de plaats."
          >
            <WachtwoordFormulier />
          </Sectie>
        </div>
      </div>
    </div>
  );
}

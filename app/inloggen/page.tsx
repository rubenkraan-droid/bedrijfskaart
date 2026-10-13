'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import InlogFormulier from './InlogFormulier';

export default function InloggenPagina() {
  return (
    <main className="flex flex-1 items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <div className="bg-groen-700 mb-4 flex h-10 w-10 items-center justify-center rounded-md">
            <span className="text-sm font-semibold text-white">BK</span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Bedrijfskaart</h1>
          <p className="text-inkt-zacht mt-1 text-sm">
            Interne kaart van de bedrijfsstructuur.
          </p>
        </div>

        <div className="border-rand bg-paneel rounded-lg border p-6">
          <Suspense fallback={<p className="text-inkt-zacht text-sm">Bezig met laden...</p>}>
            <Inlog />
          </Suspense>
        </div>
      </div>
    </main>
  );
}

function Inlog() {
  const ruw = useSearchParams().get('verder');
  const verder = ruw && ruw.startsWith('/') ? ruw : undefined;
  return <InlogFormulier verder={verder} />;
}

'use client';

import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';

export default function WachtwoordFormulier() {
  const [nieuw, setNieuw] = useState('');
  const [herhaal, setHerhaal] = useState('');
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [gelukt, setGelukt] = useState(false);

  async function verstuur(e: React.FormEvent) {
    e.preventDefault();
    setFout(null);
    setGelukt(false);

    if (nieuw.length < 10) {
      setFout('Kies een wachtwoord van minstens 10 tekens.');
      return;
    }
    if (nieuw !== herhaal) {
      setFout('De twee wachtwoorden zijn niet gelijk.');
      return;
    }

    setBezig(true);
    const { error } = await supabaseBrowser().auth.updateUser({ password: nieuw });
    setBezig(false);

    if (error) {
      setFout(`Wijzigen mislukt: ${error.message}`);
      return;
    }
    setNieuw('');
    setHerhaal('');
    setGelukt(true);
  }

  return (
    <form onSubmit={verstuur} className="max-w-sm space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="nieuw" className="block text-sm font-medium">
          Nieuw wachtwoord
        </label>
        <input
          id="nieuw"
          type="password"
          required
          autoComplete="new-password"
          value={nieuw}
          onChange={(e) => setNieuw(e.target.value)}
          className="border-rand focus:border-groen-700 min-h-11 w-full rounded-md border bg-white px-3 text-base outline-none"
        />
        <span className="text-inkt-zacht block text-xs">Minstens 10 tekens.</span>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="herhaal" className="block text-sm font-medium">
          Nog een keer
        </label>
        <input
          id="herhaal"
          type="password"
          required
          autoComplete="new-password"
          value={herhaal}
          onChange={(e) => setHerhaal(e.target.value)}
          className="border-rand focus:border-groen-700 min-h-11 w-full rounded-md border bg-white px-3 text-base outline-none"
        />
      </div>

      {fout && (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {fout}
        </p>
      )}
      {gelukt && (
        <p
          role="status"
          className="border-groen-100 bg-groen-50 text-groen-800 rounded-md border px-3 py-2 text-sm"
        >
          Je wachtwoord is gewijzigd. De volgende keer log je hiermee in.
        </p>
      )}

      <button
        type="submit"
        disabled={bezig}
        className="bg-groen-700 hover:bg-groen-800 min-h-11 rounded-md px-4 text-sm font-medium text-white transition-colors disabled:opacity-50"
      >
        {bezig ? 'Bezig...' : 'Wachtwoord wijzigen'}
      </button>
    </form>
  );
}

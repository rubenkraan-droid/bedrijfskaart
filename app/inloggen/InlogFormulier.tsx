'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';

export default function InlogFormulier({ verder }: { verder?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [wachtwoord, setWachtwoord] = useState('');
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  async function verstuur(e: React.FormEvent) {
    e.preventDefault();
    setFout(null);
    setBezig(true);

    const { error } = await supabaseBrowser().auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: wachtwoord,
    });

    if (error) {
      setBezig(false);
      setFout(
        error.message.toLowerCase().includes('invalid login credentials')
          ? 'Dit e-mailadres of wachtwoord klopt niet.'
          : `Inloggen mislukt: ${error.message}`
      );
      return;
    }

    // De AanmeldingProvider krijgt van Supabase te horen dat er is ingelogd en
    // haalt de rol op; daarna mag de beveiligde pagina getoond worden.
    router.replace(verder ?? '/');
  }

  return (
    <form onSubmit={verstuur} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="email" className="block text-sm font-medium">
          E-mailadres
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="username"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="naam@bedrijf.nl"
          className="border-rand focus:border-groen-700 min-h-11 w-full rounded-md border bg-white px-3 text-base outline-none"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="wachtwoord" className="block text-sm font-medium">
          Wachtwoord
        </label>
        <input
          id="wachtwoord"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          value={wachtwoord}
          onChange={(e) => setWachtwoord(e.target.value)}
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

      <button
        type="submit"
        disabled={bezig || email.trim() === '' || wachtwoord === ''}
        className="bg-groen-700 hover:bg-groen-800 min-h-11 w-full rounded-md text-base font-medium text-white transition-colors disabled:opacity-50"
      >
        {bezig ? 'Bezig...' : 'Inloggen'}
      </button>

      <p className="text-inkt-zacht text-xs leading-relaxed">
        Geen account of wachtwoord kwijt? Vraag een beheerder om je toe te voegen of
        je wachtwoord opnieuw te zetten.
      </p>
    </form>
  );
}

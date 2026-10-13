/**
 * Een wachtwoord vragen in de terminal zonder het op het scherm te tonen.
 *
 * Staat apart zodat het los te testen is. Een eerdere versie probeerde readline
 * het zwijgen op te leggen; dat werkte niet en zette het wachtwoord gewoon op
 * het scherm.
 */

import { stdin, stdout } from 'node:process';

/**
 * Vraagt iets zonder het op het scherm te tonen.
 *
 * Dit gebeurt met de ruwe stand van de invoer: de terminal echoot dan zelf niets
 * meer, en dit script schrijft de getypte tekens bewust niet weg. Een eerdere
 * versie probeerde readline het zwijgen op te leggen, maar dat werkte niet en
 * zette het wachtwoord gewoon op het scherm.
 */
export function vraagStil(vraag: string): Promise<string> {
  if (!stdin.isTTY) {
    throw new Error(
      'Dit script wil het wachtwoord in een echte terminal vragen, zodat het niet ' +
        'op het scherm komt. Draai het rechtstreeks in Terminal, niet via een pijp.'
    );
  }

  return new Promise<string>((klaar, mislukt) => {
    stdout.write(vraag);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let getypt = '';

    const stop = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off('data', opInvoer);
    };

    function opInvoer(brok: string) {
      for (const teken of brok) {
        switch (teken) {
          case '\r':
          case '\n':
          case '\u0004': // ctrl-d
            stop();
            stdout.write('\n');
            klaar(getypt);
            return;
          case '\u0003': // ctrl-c
            stop();
            stdout.write('\n');
            mislukt(new Error('Afgebroken.'));
            return;
          case '\u007f': // backspace
          case '\b':
            getypt = getypt.slice(0, -1);
            break;
          default:
            // Stuurtekens negeren, de rest bewaren zonder iets te tonen.
            if (teken >= ' ') getypt += teken;
        }
      }
    }

    stdin.on('data', opInvoer);
  });
}


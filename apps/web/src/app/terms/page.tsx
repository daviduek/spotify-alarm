import type { Metadata } from 'next';

import type { Locale } from '../../lib/i18n';
import { getLocale } from '../../lib/i18n/server';

const TITLE: Record<Locale, string> = { en: 'Terms of Use', es: 'Términos de Uso' };

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: TITLE[locale] };
}

function TermsEn() {
  return (
    <article className="legal">
      <h1>Terms of Use</h1>
      <p>Last updated: September 2026 · Wake is pre-release software in technical validation.</p>

      <h2>Use at your own risk</h2>
      <p>
        Wake is designed so that the system alarm rings even when music services are unavailable, but no software can guarantee that a phone will wake you.
        Do not rely on a pre-release build for anything critical. Keep a second alarm for important commitments while Wake is in beta.
      </p>

      <h2>Third-party services</h2>
      <p>
        Spotify is a trademark of Spotify AB. Wake is an independent application that uses Spotify&apos;s public developer APIs under Spotify&apos;s Developer
        Terms. A Spotify Premium account may be required for remote playback. Spotify integration may be disabled at any time if platform terms change.
      </p>

      <h2>Your content</h2>
      <p>Recordings you create remain yours and remain on your device. You are responsible for the content you record.</p>

      <h2>Open source</h2>
      <p>
        The source code is available at <a href="https://github.com/daviduek/spotify-alarm">github.com/daviduek/spotify-alarm</a> under the licence stated in
        the repository.
      </p>

      <h2>Liability</h2>
      <p>To the maximum extent permitted by law, Wake is provided &quot;as is&quot; without warranties of any kind, and its authors are not liable for missed alarms or any consequential damages.</p>
    </article>
  );
}

function TermsEs() {
  return (
    <article className="legal">
      <h1>Términos de Uso</h1>
      <p>Última actualización: septiembre de 2026 · Wake es software en fase previa al lanzamiento, en validación técnica.</p>

      <h2>Uso bajo tu propio riesgo</h2>
      <p>
        Wake está diseñada para que la alarma del sistema suene incluso cuando los servicios de música no están disponibles, pero ningún software puede garantizar que un teléfono te despierte.
        No dependas de una versión previa al lanzamiento para nada crítico. Mantén una segunda alarma para compromisos importantes mientras Wake esté en beta.
      </p>

      <h2>Servicios de terceros</h2>
      <p>
        Spotify es una marca registrada de Spotify AB. Wake es una aplicación independiente que usa las APIs públicas para desarrolladores de Spotify bajo los Términos para
        Desarrolladores de Spotify. Puede requerirse una cuenta de Spotify Premium para la reproducción remota. La integración con Spotify puede deshabilitarse en cualquier momento si los términos de la plataforma cambian.
      </p>

      <h2>Tu contenido</h2>
      <p>Las grabaciones que creas siguen siendo tuyas y permanecen en tu dispositivo. Eres responsable del contenido que grabas.</p>

      <h2>Código abierto</h2>
      <p>
        El código fuente está disponible en <a href="https://github.com/daviduek/spotify-alarm">github.com/daviduek/spotify-alarm</a> bajo la licencia indicada en
        el repositorio.
      </p>

      <h2>Responsabilidad</h2>
      <p>En la máxima medida permitida por la ley, Wake se proporciona &quot;tal cual&quot;, sin garantías de ningún tipo, y sus autores no son responsables por alarmas que no suenen ni por ningún daño consecuente.</p>
    </article>
  );
}

export default async function TermsPage() {
  const locale = await getLocale();
  return locale === 'es' ? <TermsEs /> : <TermsEn />;
}

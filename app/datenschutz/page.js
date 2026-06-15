import Link from "next/link";
import { Shield } from "lucide-react";

export const metadata = {
  title: "Datenschutz – Ascend",
};

export default function DatenschutzPage() {
  return (
    <article className="animate-fade-up card-elevated border-t-2 border-t-accent p-8 md:p-10">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent/15">
          <Shield size={20} className="text-accent" strokeWidth={2.5} />
        </div>
        <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text">
          Datenschutzerklärung
        </h1>
      </div>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-text-muted">
        <section>
          <h2 className="mb-3 text-base font-bold uppercase tracking-tight text-text">
            1. Verantwortlicher
          </h2>
          <p>
            [DEIN NAME]
            <br />
            [DEINE ADRESSE]
            <br />
            [DEINE EMAIL]
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-bold uppercase tracking-tight text-text">
            2. Welche Daten wir erheben
          </h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>E-Mail-Adresse (für Login)</li>
            <li>Trainingsdaten (Distanz, Pace, Herzfrequenz, Befinden)</li>
            <li>Standort (Stadt und Koordinaten für Wetterintegration)</li>
            <li>Körperfettanteil und Alter (für Trainingsberechnung)</li>
            <li>Chat-Nachrichten mit dem Coach</li>
            <li>Nutzungsverhalten in der App</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-base font-bold uppercase tracking-tight text-text">
            3. Zweck der Datenverarbeitung
          </h2>
          <p className="mb-3">Wir verarbeiten deine Daten ausschließlich um:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Personalisierte Trainingspläne zu erstellen</li>
            <li>Den KI-Coach mit deinem Kontext zu versorgen</li>
            <li>Wetterdaten für deinen Standort abzurufen</li>
            <li>Deine Trainingshistorie zu speichern</li>
          </ul>
          <p className="mt-3">
            Rechtsgrundlage: Art. 6 Abs. 1 lit. a DSGVO (Einwilligung) und Art. 6
            Abs. 1 lit. b DSGVO (Vertragserfüllung)
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-bold uppercase tracking-tight text-text">
            4. Drittanbieter
          </h2>

          <div className="space-y-5">
            <div>
              <h3 className="mb-2 font-semibold text-text">
                Supabase (Datenbank &amp; Authentifizierung)
              </h3>
              <p>
                Supabase Inc., 970 Trestle Glen Rd, Oakland, CA 94610, USA
                <br />
                Server: EU-West (Frankfurt)
                <br />
                Deine Daten werden auf EU-Servern gespeichert.
                <br />
                Datenschutz:{" "}
                <Link
                  href="https://supabase.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline hover:text-accent-hover"
                >
                  https://supabase.com/privacy
                </Link>
              </p>
            </div>

            <div>
              <h3 className="mb-2 font-semibold text-text">Groq (KI-Verarbeitung)</h3>
              <p>
                Groq Inc., USA
                <br />
                Deine Chat-Nachrichten und Trainingsdaten werden zur
                KI-Verarbeitung an Groq übermittelt.
                <br />
                Datenschutz:{" "}
                <Link
                  href="https://groq.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline hover:text-accent-hover"
                >
                  https://groq.com/privacy
                </Link>
              </p>
            </div>

            <div>
              <h3 className="mb-2 font-semibold text-text">
                Google (Wetter &amp; KI-Fallback)
              </h3>
              <p>
                Google LLC, 1600 Amphitheatre Parkway, Mountain View, CA 94043, USA
                <br />
                Genutzt für: Gemini AI API, Open-Meteo Wetterdaten
                <br />
                Datenschutz:{" "}
                <Link
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline hover:text-accent-hover"
                >
                  https://policies.google.com/privacy
                </Link>
              </p>
            </div>

            <div>
              <h3 className="mb-2 font-semibold text-text">Vercel (Hosting)</h3>
              <p>
                Vercel Inc., 340 S Lemon Ave #4133, Walnut, CA 91789, USA
                <br />
                Unser Hosting-Anbieter.
                <br />
                Datenschutz:{" "}
                <Link
                  href="https://vercel.com/legal/privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline hover:text-accent-hover"
                >
                  https://vercel.com/legal/privacy-policy
                </Link>
              </p>
            </div>

            <div>
              <h3 className="mb-2 font-semibold text-text">Open-Meteo (Wetter)</h3>
              <p>
                Open-Meteo, Schweiz
                <br />
                Kostenloser Wetterdienst, keine personenbezogenen Daten werden
                übermittelt außer Koordinaten.
                <br />
                Datenschutz:{" "}
                <Link
                  href="https://open-meteo.com/en/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline hover:text-accent-hover"
                >
                  https://open-meteo.com/en/terms
                </Link>
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-base font-bold uppercase tracking-tight text-text">
            5. Cookies und lokale Speicherung
          </h2>
          <p className="mb-3">Wir verwenden:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Session Cookies: für dein Login (technisch notwendig)</li>
            <li>localStorage: für App-Einstellungen wie Sprache</li>
          </ul>
          <p className="mt-3">Keine Tracking- oder Werbe-Cookies.</p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-bold uppercase tracking-tight text-text">
            6. Deine Rechte (DSGVO)
          </h2>
          <p className="mb-3">Du hast das Recht auf:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Auskunft über deine gespeicherten Daten (Art. 15)</li>
            <li>Berichtigung falscher Daten (Art. 16)</li>
            <li>Löschung deiner Daten (Art. 17)</li>
            <li>Einschränkung der Verarbeitung (Art. 18)</li>
            <li>Datenübertragbarkeit (Art. 20)</li>
            <li>Widerspruch gegen die Verarbeitung (Art. 21)</li>
          </ul>
          <p className="mt-3">Für alle Anfragen: [DEINE EMAIL]</p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-bold uppercase tracking-tight text-text">
            7. Datenlöschung
          </h2>
          <p className="mb-3">Du kannst alle deine Daten jederzeit löschen:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>In der App unter Einstellungen → &quot;Alle Daten löschen&quot;</li>
            <li>Per E-Mail an [DEINE EMAIL]</li>
          </ul>
          <p className="mt-3">
            Daten werden innerhalb von 30 Tagen vollständig gelöscht.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-bold uppercase tracking-tight text-text">
            8. Minderjährige
          </h2>
          <p>
            Ascend richtet sich ausschließlich an Personen ab 18 Jahren.
            Minderjährige dürfen Ascend nicht nutzen.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-bold uppercase tracking-tight text-text">
            9. Änderungen
          </h2>
          <p>
            Wir behalten uns vor diese Datenschutzerklärung anzupassen. Die
            aktuelle Version ist immer unter ascend.vercel.app/datenschutz
            verfügbar.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-bold uppercase tracking-tight text-text">
            10. Beschwerderecht
          </h2>
          <p>
            Du hast das Recht eine Beschwerde bei der zuständigen
            Datenschutzbehörde einzureichen.
            <br />
            Deutschland: Bundesbeauftragter für den Datenschutz
            <br />
            <Link
              href="https://www.bfdi.bund.de"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline hover:text-accent-hover"
            >
              https://www.bfdi.bund.de
            </Link>
          </p>
        </section>

        <p className="border-t border-border pt-6 text-xs font-semibold uppercase tracking-widest text-accent">
          Stand: Juni 2026
        </p>
      </div>
    </article>
  );
}

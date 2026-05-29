# PaceMind

KI-Laufcoach Web-App mit Next.js, Tailwind CSS, Supabase Auth und Groq (`llama-3.3-70b-versatile`).

## Features

- **Account-System** – Registrierung & Login mit Supabase Auth (E-Mail + Passwort)
- **Einwilligung** – Datenschutz & Mindestalter (18+) beim ersten Login
- **Coach-Chat** – KI mit Kontext aus den letzten 5 Läufen des Nutzers
- **Läufe tracken** – Pro Nutzer in Supabase (Distanz, Pace, HF, Befinden, Notizen)
- **Coach-Wissen** – Anpassbar in `lib/coach-knowledge.js`
- **Logout** – Abmelden im Header

## Setup

### 1. Abhängigkeiten

```bash
npm install
```

### 2. Umgebungsvariablen

```bash
cp .env.local.example .env.local
```

Eintragen:

- `GROQ_API_KEY` – [Groq Console](https://console.groq.com/keys)
- `NEXT_PUBLIC_SUPABASE_URL` – Supabase Projekt-URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` – Supabase Anon Key

### 3. Supabase Datenbank

1. Projekt auf [supabase.com](https://supabase.com) anlegen
2. Unter **SQL Editor** den Inhalt von `supabase/schema.sql` ausführen (bestehende DB: zusätzlich `migration-onboarding.sql`)
3. Unter **Authentication → URL Configuration** die Site URL setzen (z. B. `http://localhost:3000`)
4. Optional: E-Mail-Bestätigung unter **Authentication → Providers → Email** deaktivieren für schnelleres lokales Testen

### 4. Dev-Server

```bash
npm run dev
```

App: [http://localhost:3000](http://localhost:3000) → Weiterleitung zu Login oder Chat

## Routen

| Route | Beschreibung |
|-------|----------------|
| `/login` | Anmelden |
| `/register` | Registrieren |
| `/consent` | Einwilligungsdialog (erstes Login) |
| `/onboarding` | Profil-Onboarding (einmalig) |
| `/chat` | Coach-Chat (nach Onboarding) |
| `/laeufe` | Läufe eintragen & verwalten |

Nicht eingeloggte Nutzer werden zu `/login` weitergeleitet.

## Coach-Wissen

Bearbeite `lib/coach-knowledge.js` – die KI nutzt diesen Text als Systemgrundlage.

## Datenmodell

**profiles**: `id`, `privacy_accepted_at`, `age_confirmed_at`, `created_at`

**runs**: `id`, `user_id`, `distanz_km`, `pace`, `herzfrequenz` (Ø bpm), `herzfrequenz_max` (max bpm), `befinden`, `notizen`, `created_at`

Row Level Security: Jeder Nutzer sieht nur eigene Daten.

# Red ma Kärntnerisch! – Online Deployment (Variante B)

Ziel: Website online + **gemeinsamer Community‑Korpus** (alle sehen die Einträge von allen) + **keine API‑Keys im Browser**.

## Was in diesem ZIP bereits geändert wurde
- `index.html` ist angelegt (Kopie von `prototyp1.html`), damit Hosting-Plattformen automatisch die Startseite finden.
- `/api/*` Server-Funktionen sind ergänzt:
  - `/api/chat` (LLM‑Proxy)
  - `/api/stt` (Whisper STT‑Proxy)
  - `/api/tts` (ElevenLabs TTS‑Proxy)
  - `/api/corpus` (Community‑Korpus via Supabase)
- Frontend wurde umgebaut:
  - Dialekt‑Chat/Übersetzer nutzt automatisch `/api/chat` (ohne Key im Browser).
  - Audio nutzt `/api/stt` + `/api/tts` (ohne Keys im Browser).
  - Community‑Korpus speichert/liest online über `/api/corpus`.
  - Fallback: Wenn du die Seite lokal öffnest (ohne Server), läuft der Korpus weiterhin rein lokal im Browser.

---

## Schritt‑für‑Schritt: Online stellen (Vercel + Supabase)

### 1) Supabase Projekt erstellen
1. Supabase öffnen → neues Projekt erstellen.
2. In Supabase → **SQL Editor** → neues SQL Script ausführen.
3. Dafür die Datei `supabase_schema.sql` aus diesem Projekt kopieren und ausführen.

### 2) Code zu GitHub hochladen
1. Neues Repo auf GitHub erstellen (public oder private).
2. Dieses Projekt (Ordnerinhalt) ins Repo pushen.

### 3) Vercel Deployment
1. Vercel öffnen → **New Project** → GitHub Repo auswählen.
2. Framework: **Other** (kein Build nötig).
3. Deploy klicken.

### 4) Environment Variables in Vercel setzen
Vercel → Project → Settings → Environment Variables:

**Pflicht:**
- `OPENAI_API_KEY` = dein OpenAI API Key (für Chat + Whisper)
- `ELEVENLABS_API_KEY` = dein ElevenLabs API Key
- `SUPABASE_URL` = Supabase Project URL (z.B. `https://xxxxx.supabase.co`)
- `SUPABASE_SERVICE_ROLE_KEY` = Supabase Service Role Key (wichtig: nur serverseitig!)

**Optional:**
- `ELEVENLABS_VOICE_ID` = Default Voice ID (sonst wird Rachel verwendet)
- `ELEVENLABS_ALLOWED_VOICES` = Komma‑Liste erlaubter Voice IDs (z.B. `id1,id2`)
- `ELEVENLABS_MODEL_ID` = z.B. `eleven_multilingual_v2`
- `CORPUS_ADMIN_TOKEN` = Token für „Löschen“ im Korpus (wenn du das wirklich nutzen willst)

Nach dem Setzen: **Redeploy** (Deployments → Redeploy).

### 5) Link teilen
Nach dem Deploy bekommst du eine Vercel‑URL (z.B. `https://dein-projekt.vercel.app`).
Die kannst du einfach jedem schicken.

---

## Admin‑Löschen im Korpus (optional)
- Wenn du `CORPUS_ADMIN_TOKEN` in Vercel gesetzt hast, kannst du im Browser (Admin‑Modus) beim ersten Löschen ein Token eingeben.
- Das Token wird **nur in deinem Browser** gespeichert (`localStorage`) und als Header an `/api/corpus` gesendet.

Wenn du kein Token setzt, können Einträge nicht über die UI gelöscht werden (sicherer).

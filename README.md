# Dienstplan-App

Kleine lokale Web-App fuer zwei Bereiche:

- Mitarbeiter tragen ihre Verfuegbarkeit fuer den kommenden Monat ein.
- Du erstellst den Dienstplan im Admin-Bereich und veroeffentlichst ihn.

## Starten

```powershell
node app\server.js
```

Danach im Browser oeffnen:

```text
http://localhost:4173
```

Im selben Netzwerk koennen Mitarbeiter die App ueber die IP-Adresse des Rechners aufrufen, auf dem der Server laeuft, zum Beispiel:

```text
http://192.168.178.20:4173
```

## Admin

Die voreingestellte Admin-PIN ist:

```text
1234
```

Die PIN kannst du im Bereich `Planung > Einstellungen` aendern.

## Daten

Lokal werden alle Eintraege in `app/data.json` gespeichert. Online kann die App Supabase als Datenbank verwenden. Sobald `SUPABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY` gesetzt sind, speichert der Server automatisch dort.

## Online veroeffentlichen

### Kostenlos mit Vercel + Supabase

Vercel hostet die App. Supabase speichert die Daten. Fuer deine Dienstplan-App reicht der kostenlose Start normalerweise aus.

1. Bei Supabase ein Projekt erstellen.
2. In Supabase den SQL Editor oeffnen und den Inhalt aus `supabase-schema.sql` ausfuehren.
3. Bei Vercel ein neues Projekt erstellen.
4. Die Dateien aus diesem Ordner hochladen oder ueber Git importieren.
5. Diese Umgebungsvariablen in Vercel setzen:

```text
SUPABASE_URL=https://dein-projekt.supabase.co
SUPABASE_SERVICE_ROLE_KEY=dein-service-role-key
SUPABASE_TABLE=app_state
STATE_KEY=dienstplan
```

Danach bekommst du von Vercel einen Internet-Link, zum Beispiel `https://dienstplan.vercel.app`. Den koennen Mitarbeiter zuhause am Handy oeffnen.

Wichtig: Online sollte Supabase gesetzt sein. Ohne Supabase kann Vercel Daten nicht dauerhaft speichern.

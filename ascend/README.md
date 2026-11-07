# Ascend

Aplicație web de dezvoltare personală gamificată. Îți creezi un personaj, îți setezi sarcini cu puncte și le bifezi zilnic. Punctele devin **credite** pe care le aloci obiectivelor reale (ex. un laptop de 6.000 lei), iar sarcinile cresc **nivelul pe 8 atribute** (Sănătate, Intelect, Creativitate, Disciplină, Finanțe, Relații, Ordine, Carieră).

## Pornire

```bash
cd ascend
npm install
npm run dev        # http://localhost:5173
```

Alte comenzi: `npm test` (teste pentru logica jocului), `npm run build` (versiunea de producție în `dist/`).

## Funcționalități

| Zonă | Ce face |
|---|---|
| **Cont** | Înregistrare și autentificare (parole cu hash PBKDF2). Fiecare cont are datele lui separate. |
| **Personaj** | Nume, avatar, nivel general cu titluri (Începător → Legendă), radar al atributelor, hartă de activitate, 17 realizări. |
| **Sarcini** | Puncte, 1–3 atribute (principalul primește 100% XP, celelalte 50%), frecvență: zile fixe / de N ori pe săptămână / o singură dată. Arhivare, filtrare pe atribute. |
| **Azi** | Lista zilei, bifare cu animație și anulare în aceeași zi, progres zilnic, serie, credite, obiectivul principal. |
| **Lista specială și provocări** | Sarcinile marcate cu ★ pot fi alese **aleatoriu** ca provocare. Provocarea apare la o oră aleatorie din zi, e „sigilată” până o dezvălui și are **24h** termen. Bifată în acest interval dă **×5 puncte și XP**. Frecvența, multiplicatorul și durata se pot regla din Setări. |
| **Serie** | +1% credite pe zi consecutivă (maxim +30%). Zilele libere alese nu întrerup seria. |
| **Obiective** | Trei moduri: *Cumpărături*, *Dezvoltare* (la achiziție dă XP în atributul ales), *Răsfăț*. Prețul e în lei și se convertește în credite după cursul setat. |
| **Anti-impuls** | Obiectivele de cumpărături intră 48h **în reflecție** înainte să primească credite. Fiecare obiectiv arată **costul în muncă** (zile și sarcini echivalente). Achiziția cere o confirmare conștientă, iar după cumpărare o poți evalua (1–5 stele). |
| **Date** | Export și import JSON pentru backup, resetare completă, temă întunecată sau luminoasă. |

## Arhitectură

```
src/
  domain/      logica jocului (pură, testată): tipuri, niveluri, serii, provocări, obiective
  services/    autentificare + persistență (interfețe care pot fi înlocuite cu un backend)
  state/       store React: stare, salvare automată, notificări de nivel și realizări
  ui/          componente reutilizabile (modal, bare, inel, radar, toast-uri)
  views/       ecrane: Autentificare, Configurare, Azi, Sarcini, Obiective, Personaj, Setări
```

## Limitări actuale și pași următori

- **Datele stau local în browser** (localStorage). Pentru sincronizare între telefon și calculator, următorul pas este un backend (ex. Supabase). `services/auth.ts` și `services/storage.ts` au deja interfețe (`AuthService`, `Repository`) pentru această înlocuire.
- Notificări push când apare o provocare (PWA + service worker).
- Statistici lunare și rapoarte săptămânale.

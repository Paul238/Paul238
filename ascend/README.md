# Ascend

Aplicație de dezvoltare personală gamificată: personaj cu 8 atribute, sarcini cu puncte, provocări aleatorii ×5, credite pentru obiective reale (ex. un laptop de 6.000 lei) cu perioadă de reflecție.

Rulează pe laptopul tău cu **Docker**: un server web **Apache + PHP 8.3** și o bază de date **MariaDB**. Datele se sincronizează între laptop și telefon.

```
ascend/
├─ 1-instalare.cmd      prima instalare (dublu-click)
├─ pornire.cmd          pornește aplicația și deschide browserul
├─ oprire.cmd           oprește aplicația (datele rămân)
├─ backup.cmd           salvează baza de date în backups\
├─ actualizare.cmd      backup + ultima versiune + reconstruire
├─ docker-compose.yml   serviciile: app (Apache+PHP), db (MariaDB), phpmyadmin (opțional)
├─ .env.example         model de configurare (parole, porturi)
├─ frontend/            interfața (React + TypeScript + Vite)
├─ api/                 serverul PHP: autentificare, salvarea datelor, migrații SQL
├─ docker/app/          Dockerfile, configurare Apache și PHP
├─ scripts/             scripturile PowerShell folosite de fișierele .cmd
└─ backups/             copiile bazei de date (create de backup.cmd)
```

## Instalare pe Windows (folder pe D:)

### 1. Programe necesare (o singură dată)
1. **Docker Desktop**: https://www.docker.com/products/docker-desktop/ — la instalare lasă bifat *Use WSL 2*. Repornește calculatorul dacă ți se cere.
2. **Git for Windows**: https://git-scm.com/download/win (ca să poți descărca și actualiza codul).
3. Opțional, ca Docker să-și țină datele tot pe D: — Docker Desktop → *Settings → Resources → Advanced → Disk image location* → `D:\Docker`.
4. Ca aplicația să pornească singură odată cu Windows — Docker Desktop → *Settings → General* → bifează *Start Docker Desktop when you sign in*.

### 2. Descarcă proiectul pe D:
Deschide **PowerShell** și rulează:

```powershell
git clone -b claude/gallant-shannon-wd1or3 https://github.com/paul238/paul238.git D:\Paul238
```

Aplicația va fi în `D:\Paul238\ascend`. După ce branch-ul este unit în `main`, parametrul `-b ...` nu mai este necesar.

### 3. Instalează și pornește
1. Pornește **Docker Desktop** și așteaptă până scrie *Engine running*.
2. În `D:\Paul238\ascend`, dă **click dreapta pe `1-instalare.cmd` → Run as administrator** (administratorul e necesar doar pentru regula de firewall care permite accesul de pe telefon).
3. Prima instalare durează câteva minute. La final se deschide http://localhost:8080 și scriptul afișează adresa pentru telefon.

Scriptul generează automat fișierul `.env` cu parole aleatorii pentru baza de date. **Păstrează-l** și nu-l modifica după prima pornire: baza de date folosește parolele stabilite la creare.

### 4. Folosire zilnică
| Acțiune | Ce rulezi |
|---|---|
| Pornește aplicația | `pornire.cmd` (sau nimic, dacă Docker pornește cu Windows: containerele repornesc singure) |
| Oprește | `oprire.cmd` |
| Backup | `backup.cmd` → fișier `.sql` în `backups\` (se păstrează ultimele 30) |
| Restaurare | `powershell -ExecutionPolicy Bypass -File scripts\restore.ps1 -File backups\ascend_....sql` |
| Actualizare manuală | `actualizare.cmd` |
| Actualizare automată | `actualizare-automata-pornire.cmd` (o singură dată) |
| Administrare bază de date | `docker compose --profile tools up -d` → http://localhost:8081 (phpMyAdmin) |
| Jurnale (în caz de probleme) | `docker compose logs -f app` |

### Actualizare automată („deploy” fără PowerShell)
Dă **o singură dată** dublu-click pe `actualizare-automata-pornire.cmd`. Se creează în Windows sarcina programată *Ascend Auto-Update*, care la fiecare 5 minute (și la logare) verifică dacă există o versiune nouă pe GitHub. Dacă există, face backup, o descarcă și reconstruiește aplicația — fără nicio comandă din partea ta.

- În aplicație apare „Versiune nouă instalată · Reîncarcă”; versiunea curentă se vede în *Setări → Cont și date*.
- Jurnalul actualizărilor: `backups\auto-update.log`.
- Oprire: `actualizare-automata-oprire.cmd`.
- Condiții: Docker Desktop instalat, Git cu acces la repository (prima dată poate cere logarea în GitHub), laptopul pornit și tu logat în Windows.

### 5. Pe telefon
Telefonul și laptopul trebuie să fie în **aceeași rețea Wi-Fi**. Deschide adresa afișată de script, de forma `http://192.168.x.x:8080`. Din meniul browserului alege *Adaugă pe ecranul de pornire* și o vei folosi ca pe o aplicație.

Dacă nu se încarcă:
- rețeaua Wi-Fi trebuie să fie setată în Windows ca **Private**;
- regula de firewall se adaugă rulând `1-instalare.cmd` ca administrator.

> Nu expune portul direct pe internet. Pentru acces din afara casei, varianta sigură este o rețea privată de tip VPN (de exemplu Tailscale). O putem configura ulterior.

### 6. După ce ți-ai creat contul
Ca nimeni altcineva din rețea să nu-și poată face cont, pune în `.env` linia `ALLOW_REGISTRATION=false`, apoi rulează `pornire.cmd`.

## Ce găsești în aplicație

- **Drumul zilei**: un drumeț merge de acasă la tabăra de seară; fiecare etapă bifată ajunge în rucsac. Sus, desfășurătorul zilei în ordinea orelor.
- **Repere cu oră** (trezire, ajuns la program, culcare) și **mese** cu calorii și macronutrienți; scor de nutriție seara.
- **Personaj** cu 8 atribute, **vârfuri** (obiective în lei, cu timp de gândire), **provocări surpriză**, **serie cu scuturi**.
- Cercetarea UX din spatele designului: [docs/ux-research.md](docs/ux-research.md).

## Cum funcționează în spate

- **app**: imaginea construiește interfața (Node) și o servește cu Apache. Rutele `/api/*` ajung la `api/public/index.php`.
- **API (PHP, fără framework)**:

  | Rută | Ce face |
  |---|---|
  | `GET /api/health` | starea serverului |
  | `POST /api/auth/register` | creare cont |
  | `POST /api/auth/login` | autentificare |
  | `POST /api/auth/logout` | deconectare |
  | `GET /api/auth/me` | utilizatorul curent |
  | `POST /api/auth/password` | schimbarea parolei |
  | `GET /api/state` | citirea datelor |
  | `PUT /api/state` | salvarea datelor |

- **Securitate**:
  - parolele sunt salvate cu `password_hash` (bcrypt);
  - sesiunea este un cookie `HttpOnly` cu `SameSite=Lax`, iar serverul păstrează doar hash-ul tokenului;
  - cererile care modifică date au protecție CSRF (header obligatoriu);
  - după prea multe încercări eșuate, autentificarea se blochează temporar;
  - interogările SQL sunt pregătite (prepared statements).
- **Date**: fiecare utilizator are un document JSON în tabelul `user_state`, cu un număr de **revizie**. Dacă salvezi de pe telefon și apoi de pe laptop cu date mai vechi, serverul refuză suprascrierea (409), iar aplicația încarcă automat versiunea cea mai nouă. Aplicația preia modificările de pe celelalte dispozitive când revii în tab și la fiecare 30 de secunde.
- **Migrații**: fișierele `api/migrations/*.sql` se aplică automat la pornirea containerului.
- **Offline**: dacă serverul nu răspunde, apare indicatorul *Offline*, iar modificările se trimit automat când serverul revine.

## Dezvoltare

```bash
cd frontend
npm install
npm run dev     # http://localhost:5173, cererile /api merg la serverul Docker de pe :8080
npm test        # testele logicii de joc
npm run check   # tipuri + teste + build (la fel ca în CI)
```

Fără serverul Docker, interfața funcționează în **mod local**: datele se salvează doar în browser.

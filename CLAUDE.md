# Instrucțiuni pentru Claude

## Proiecte
- `ascend/` — aplicația Ascend (frontend React/Vite în `ascend/frontend`, API PHP în `ascend/api`, Docker în `ascend/docker` și `ascend/docker-compose.yml`). Detalii în `ascend/README.md`.
- `optimizare-pc.ps1` — script Windows separat.

## „deploy”
Aplicația rulează pe laptopul utilizatorului (Windows, `D:\Paul238\ascend`) cu Docker. Laptopul are o sarcină programată
(„Ascend Auto-Update”, pornită cu `ascend/actualizare-automata-pornire.cmd`) care la fiecare 5 minute face `git fetch`
pe branch-ul urmărit și, dacă există commit-uri noi: backup → `git pull --ff-only` → `docker compose up -d --build`.

Când utilizatorul scrie **„deploy”**:
1. Rulează verificările: `cd ascend/frontend && npm run check` (tipuri + teste + build) și `php -l` pe fișierele modificate din `ascend/api`.
2. Dacă trec, fă commit cu un mesaj descriptiv și `git push -u origin <branch-ul curent de lucru>`.
3. Spune-i utilizatorului că laptopul preia versiunea în maximum ~5 minute, că în aplicație va apărea „Versiune nouă instalată · Reîncarcă”
   și că jurnalul este în `D:\Paul238\ascend\backups\auto-update.log`.
4. Nu face niciodată push cu verificări picate. Nu rescrie istoria (fără force-push), ca `git pull --ff-only` de pe laptop să meargă.
5. Migrațiile de bază de date se adaugă ca fișiere noi în `ascend/api/migrations/` (nu se modifică cele existente); rulează automat la pornire.

## Convenții
- Texte pentru utilizator în limba română, cu diacritice (excepție: scripturile `.ps1`, fără diacritice, pentru PowerShell 5.1).
- Logica jocului e în `ascend/frontend/src/domain` și e acoperită de teste (`vitest`); adaugă teste pentru reguli noi.

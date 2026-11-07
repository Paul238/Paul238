# Paul238

- [`ascend/`](ascend/) — **Ascend**: aplicație de dezvoltare personală gamificată (sarcini, atribute, credite, obiective), cu server Docker (Apache + PHP + MariaDB). Instalarea pe Windows este descrisă în [ascend/README.md](ascend/README.md).
- `optimizare-pc.ps1` — script de optimizare Windows (detalii mai jos).

---

# Optimizare PC Windows

Scriptul `optimizare-pc.ps1` face o optimizare sigura (fara „tweak-uri” riscante):

1. Creeaza un punct de restaurare
2. Sterge fisierele temporare, cache-ul si goleste Cosul de gunoi
3. Curata componentele vechi Windows Update
4. Activeaza planul de alimentare High Performance
5. Optimizeaza discurile (TRIM pe SSD, defrag pe HDD)
6. Goleste cache-ul DNS
7. Opreste reclamele/sugestiile din Windows
8. Jocuri: Game Mode, opreste Xbox Game DVR, GPU scheduling, fara accelerare mouse, placa video dedicata pentru Fortnite si LoL
9. (optional `-Complet`) Repara fisierele de sistem cu DISM + SFC
10. Afiseaza programele de la pornire, starea discurilor/RAM-ului si ce procese consuma cel mai mult RAM

## Cum il rulezi

1. Descarca `optimizare-pc.ps1`
2. Start → scrie `PowerShell` → click dreapta → **Run as administrator**
3. Mergi in folderul cu scriptul (ex: `cd $HOME\Downloads`) si ruleaza:

```powershell
Set-ExecutionPolicy -Scope Process Bypass -Force
.\optimizare-pc.ps1
```

Pentru varianta completa (dureaza mai mult): `.\optimizare-pc.ps1 -Complet`

La final, da restart. Daca ceva nu iti place: Panou de control → Recuperare → Restaurare sistem.

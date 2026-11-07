# Ascend — cercetare UX/DX și îmbunătățiri

Data: noiembrie 2026 · Scop: aplicația să fie ușor de pornit și de folosit zilnic, fără să pară un panou de administrare.

## 1. Ce spune cercetarea

| # | Constatare | Sursa | Ce înseamnă pentru Ascend |
|---|---|---|---|
| 1 | Onboarding scurt (2–4 ecrane), o singură „primă reușită”, pașii în plus amânați; valori implicite sigure. | [Designstudio](https://www.designstudiouiux.com/blog/mobile-app-onboarding-best-practices/), [Screensdesign](https://screensdesign.com/articles/habit-tracker-app-onboarding-examples/), [Alldaystech](https://alldaystech.com/guides/mobile-development/mobile-app-onboarding-ux-patterns-activation-retention), [Lovable](https://lovable.dev/guides/how-to-build-a-habit-tracker-app) | O singură configurare, cu pași opționali „Sari peste” și valori bune implicite. |
| 2 | Tutorialele nu cresc reușita (91% cu tutorial vs 94% fără); ajutorul contextual, la momentul potrivit, e preferat. | [Nielsen Norman Group](https://www.nngroup.com/articles/mobile-tutorials/), [Shopify](https://www.shopify.com/partners/blog/mobile-app-onboarding) | Fără tur ghidat; un singur indiciu în context (balonul drumețului), care dispare după prima bifă. |
| 3 | Seriile care pedepsesc o zi ratată sunt principala cauză de abandon; mecanismele de „recuperare” reduc anxietatea. | [Yu-kai Chou](https://yukaichou.com/gamification-analysis/recovery-first-streak-design/), [The Decision Lab](https://thedecisionlab.com/fr-CA/insights/consumer-insights/streak-creep-the-perils-of-too-much-gamification), [Lovable](https://lovable.dev/guides/how-to-build-a-habit-tracker-app) | Scuturi de serie automate (1 la 7 zile, maxim 2) + zile libere. |
| 4 | La jurnalul alimentar, frecarea (timpul de introducere) duce la abandon; scurtături: recente, frecvente, copierea mesei, cantitatea ținută minte. | [OpenNutriTracker](https://github.com/simonoppowa/OpenNutriTracker/issues/458), [openvalens](https://github.com/nip10/openvalens/issues/271), [healthtracker](https://github.com/NevinJulian/healthtracker/issues/348), [Intake](https://www.intakenutrition.io/blog/fastest-ways-to-log-food-less-friction) | „Repetă masa de data trecută”, alimente recente dintr-o atingere, cantitatea ultimă propusă automat. |
| 5 | „Anulează” după acțiune e preferabil confirmărilor pentru acțiuni reversibile; confirmarea doar pentru cele ireversibile. | [LogRocket](https://blog.logrocket.com/ux-design/ux-reversible-actions-framework/), [UI/UX Atlas](https://uiux-atlas.pages.dev/lessons/interaction-design/error-prevention-undo-and-recovery-design), [Eleken](https://eleken.co/blog-posts/snackbar-ui) | Notificare cu buton „Anulează” după fiecare bifă; resetarea totală are confirmare + copie automată. |
| 6 | Setări: grupuri mici cu titluri, limbaj simplu, se arată starea curentă, cele frecvente sus. | [Android](https://developer.android.com/design/ui/mobile/guides/patterns/settings), [Toptal](https://www.toptal.com/designers/ux/settings-ux), [UXCel](https://uxcel.com/lessons/mobile-settings-745) | 6 secțiuni cu meniu și starea fiecăreia; formulări în propoziții („Vreau să mă trezesc până la…”). |
| 7 | „Juice”: feedback generos și rapid la acțiunile repetate; recompensează fapta, nu doar rezultatul. | [notbor.ing](https://notbor.ing/words/the-most-satisfying-checkbox), [Brad Woods](https://garden.bradwoods.io/notes/design/juice) | Drumețul merge, ridică etapa, rucsacul pulsează; particule; recompense scurte (<1 s). |
| 8 | Recapitularea de seară e un gol în multe aplicații; trebuie să fie scurtă și fără vinovăție. | [DEV](https://dev.to/muhammad_aamiryameen_4c0/why-i-built-the-evening-reflection-feature-before-the-morning-planner-349f), [Mindcrate](https://mindcrate.vercel.app/best-end-of-day-review-habits-for-better-long-term-memory-cfe257) | Tabăra de seară = rezumatul zilei (etape, credite, XP, repere, nutriție), cu „Încheie ziua”. |
| 9 | Ținte de atingere: minimum 24×24 px (WCAG 2.5.8 AA), recomandat 44 px (AAA / Apple). | [Deque](https://dequeuniversity.com/resources/wcag-2.2), [GOV.UK](https://alphagov.github.io/wcag-primer/sc/2.5.8.html) | Butoane ≥ 40–44 px, focus vizibil, respectarea „reduce motion”. |
| 10 | Selectorul de oră nativ e preferat; scurtăturile „Acum” / presetări ajută. | [SAP Fiori](https://www.sap.com/design-system/fiori-design-web/v1-120/ui-elements/time-picker/usage), [Eleken](https://www.eleken.co/blog-posts/time-picker-ux) | Câmp nativ + butoane „Acum”, −15, −5, +5, +15 min, „Fix la țintă”. |

> Notă: majoritatea surselor sunt ghiduri de practică, nu studii controlate. Singurul rezultat măsurat direct este studiul NN/g despre tutoriale.

## 2. Audit — ce încurca înainte

1. **Două configurări separate** (personaj → apoi panoul „Configurează-ți ziua”), cu un tabel de 8 rânduri × 7 câmpuri (oră, regulă, toleranță, L–V, puncte).
2. **Setări într-o singură listă lungă**, cu termeni tehnici („multiplicator”, „cooldown”).
3. **Seria se rupea la o singură zi ratată.**
4. **Notarea mesei** cerea căutare și grame de fiecare dată, chiar pentru același mic dejun.
5. **Greșelile se reparau doar redeschizând etapa.**
6. **Editorul de sarcini** afișa toate câmpurile deodată; atributele trebuiau alese manual.
7. **Lipsea un final al zilei**; nutriția se încheia dintr-un ecran separat.
8. **Grafică**: munți plați, etichete greu de citit pe cer luminos, fundal static.

## 3. Ce s-a schimbat

| Zonă | Înainte | Acum |
|---|---|---|
| Prima configurare | 3 pași + configurare separată a zilei | 5 pași scurți: Tu (cu drumețul tău) → Ziua ta → Obiceiuri → Nutriție (opțional) → Primul vârf (opțional); estimare „X zile de muncă” |
| Ziua ta | Tabel cu 56 de câmpuri | Carduri în propoziții; toleranța și punctele sub „Avansat” |
| Setări | O listă | 6 secțiuni cu meniu + starea curentă; „Ziua mea” listează reperele cu editare rapidă |
| Serie | Se rupea la o zi ratată | Scuturi automate (🛡 în bara de sus) + zile libere |
| Mese | Căutare de fiecare dată | Repetă masa, recente dintr-o atingere, cantitatea ținută minte |
| Greșeli | Redeschizi etapa | „Anulează” direct din notificare |
| Repere cu oră | Doar câmpul de oră | + Acum / −15 / −5 / +5 / +15 / Fix la țintă |
| Editor | Toate câmpurile | Titlul primul, atribute sugerate din titlu, opțiuni rare ascunse |
| Seara | — | Tabăra de seară = rezumatul zilei; se deschide singur când ai strâns tot |
| Ajutor | — | Balonul drumețului la prima utilizare |
| Grafică | Munți plați | Degradeuri, zăpadă, ceață, păsări ziua, licurici noaptea, iarbă și flori pe drum, etichete lizibile, insigna „Următoarea” |
| Accesibilitate | Butoane mici | Ținte ≥ 40 px, focus vizibil, „reduce motion” respectat |

## 4. DX (experiența de dezvoltare)

- `npm run check` = tipuri + teste + build, într-o singură comandă.
- GitHub Actions (`.github/workflows/ascend-ci.yml`): la fiecare push rulează verificarea interfeței, sintaxa PHP și validarea Docker Compose.
- Teste noi: scuturi de serie, sugestii de atribute (28 de teste în total).
- `npm run dev` folosește automat serverul Docker prin proxy (sau modul local, dacă serverul nu rulează).

## 5. Pași următori recomandați

1. **Notificări** (PWA + HTTPS local, de ex. prin Tailscale) pentru provocări și reperele de dimineață.
2. **Scanare de cod de bare** pentru alimente (Open Food Facts), ca notarea să fie și mai rapidă.
3. **Personalizarea drumețului** (căciulă, rucsac, culori) deblocată cu niveluri: o recompensă care nu costă credite.
4. **Statistici săptămânale** („săptămâna ta pe drum”) și o reflecție opțională de o propoziție seara.
5. **Măsurare**: reținerea în zilele 1, 7 și 30 și timpul mediu de notare a unei mese, ca deciziile viitoare să se bazeze pe date proprii.

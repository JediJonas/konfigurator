# Konfiguratorn

Webbapp där man bygger objekt av platta delar i 3D och får ett tillverkningsunderlag: ritning i skala 1:1, packning, materialåtgång och byggordning. Första domänen är pepparkakshus. Hela kravbilden står i `docs/SPEC.md`; läs den innan större ändringar.

## Kommandon

- `npm run dev` startar utvecklingsservern.
- `npm test` kör Vitest (geometri, domänlogik, export).
- `npm run e2e` bygger appen och kör Playwright-flödena, även axe mot WCAG 2.2 AA. I molnet: använd den förinstallerade Chromium och installera inte Playwright igen.
- `npm run typecheck` och `npm run lint` ska gå igenom utan fel före varje PR.
- `npm run build` bygger den statiska webbplatsen till `dist/`.

## Principer

1. **Allt man ser i 3D går att tillverka.** 3D-vyn och exporten läser bara `Part[]` från flödet `Design → delar`. De räknar aldrig egna mått.
2. **Millimeter överallt internt.** Typen `Mm` är ett tal i millimeter. Andra enheter finns bara i gränssnittet och vid export (PDF räknar om mm till sina egna enheter på ett ställe).
3. **Kärnan är generell.** `src/core` innehåller inga domänord (inte "deg", "glasyr", "pepparkaka", "gingerbread"). Bygg pepparkaksdomänen först och flytta bara upp det som uppenbart är generellt. Inga abstraktioner för domäner som inte finns.
4. **Beroenderegeln:** `core` importerar varken från `domains`, `app`, React eller three.js. `domains` importerar bara från `core`. ESLint kontrollerar det.
5. **Kärnans geometri är ren TypeScript** och testas fristående med Vitest. Logik skrivs som rena funktioner; React-komponenterna bara visar.
6. **Parametrar beskrivs med Zod.** Samma schema ger typer, validering och formulär, så att en ny objekttyp inte kräver ny UI-kod.
7. **Regler är data i domänpaketet**, inte kod i gränssnittet.
8. **Sparade designer har en schemaversion** (`Design.version`). Ändras formatet skrivs en migrering och ett test för den.
9. **Lätt DDD.** Koden använder samma begrepp som begreppstabellen i `docs/SPEC.md` avsnitt 3 (`Domain`, `ObjectType`, `Instance`, `Socket`, `Part` …), så att specen och koden talar samma språk. Kärnan och varje domänpaket är skilda kontexter som bara möts via kärnans typer. Domänlogiken är ren kod utan React och three.js. Inga tunga mönster: inga aggregat, domänhändelser eller servicelager. `ProjectStore` är det enda repositoryt.
10. **Svenska i gränssnittet.** Texter kommer från domänens `strings.sv.ts` och kärnans textfil, aldrig hårdkodade i komponenter. Kod, typnamn och identifierare är på engelska; kommentarer och dokumentation på svenska.

## Datamodellens beslut

Beslut om de öppna frågorna i `docs/SPEC.md` avsnitt 18:

- **Bottenplatta:** ingen. Huset står på ett fat. Roten (`gb.plate`) ger bara kopplingspunkten `ground` och inga delar till ritningen.
- **Tjocklek:** varje `Part` bär sin tjocklek, och en `Instance` kan ha en egen `thickness` som åsidosätter designens material. Gränssnittet visar bara en tjocklek för hela designen tills vidare.
- **Vinklar:** `Attachment.rotationDegrees` är en fri vinkel i grader, men regler och gränssnitt tillåter bara räta vinklar (0, 90, 180, 270) tills vidare.
- **Domäner:** samma app för alla domäner. `Design.domain` avgör vilket domänpaket som används. En startsida med val byggs först när det finns en andra domän.

## Kopplingar och regler (fas 2)

- Objekt fäster i kopplingspunkter (`Socket`). Punktens `bounds` är ytan det som fästs måste rymmas inom, sett vinkelrätt mot punkten. En objekttyp kan ange `mountMatrix` för hur den sitter i punkten, t.ex. en tillbyggnad som står upprätt med bakre änden mot väggen.
- Påverkan (`Modifier`) ger områden i objektets egna koordinater; flödet fäller ner dem i måldelens plan. En öppning som skulle dela en del läggs inte på och blir ett fel.
- Regelmotorn (`core/rules`) läser reglerna som data från domänen och ger fel och varningar. Samma kontroll används i panelen, när nya objekt föreslås och för att stoppa ritningen.
- Nya objekt snäpper mitt i kopplingspunkten i den största storleken som klarar reglerna. Läget längs väggen snäpper till 5 mm och stannar där objektet ryms.
- Öppningen i värdens vägg är 10 mm mindre än tillbyggnadens insida mot långväggarna och taket (ägarens val), så att tillbyggnaden har en kant att fästas mot. Nertill går den till golvet.
- Tillbyggnadens väggar står minst 10 mm från väggens hörn och taket minst 10 mm under huvudhusets takfot (långvägg) eller takets undersida (gavel) (ägarens val, `WALL_EDGE_MARGIN_MM`). Det gäller förslag, mått och läge, och huvudhusets mått begränsas på samma sätt av tillbyggnaden. Takutsprången får gå förbi hörnet. Taket under takfoten gäller tills vinkelrännorna finns (fas 3).
- En ny tillbyggnad tar högst 60 % av väggens längd, så att det finns plats att flytta den. Fältet för läget går bara att ändra så långt den kan flyttas.
- En ny tillbyggnad föreslås 60 % av väggens längd (ägarens val). Ryms inte det blir den så bred som marginalen till hörnen tillåter. Vägghöjden föreslås 60 % av väggens höjd i hörnet, och 10 mm under den när 60 % är lägre än minsta höjden (ägarens val), så att tillbyggnader på varandras gavlar trappas ner. Ryms inte taket räknas högsta vägghöjden ut direkt ur kopplingspunktens överkant och tillbyggnadens kontur (`extensionProposal.ts`).

- Fält i parameterschemat kan ha `groupKey` (visas under en egen rubrik, hopfälld från början) och `isInherited` (ett nytt objekt av samma typ får förälderns värde). Taket (taktyp, taklutning och takutsprången) är en sådan grupp och ärvs nedåt (ägarens val).

## Ritningen

- **Hörnregeln för stumfog** (ägarens val): en vägg med sned överkant går hela vägen ut, och väggar med rak överkant kortas med 2 × tjockleken och står mellan. Då följer den sneda väggen takets undersida ut till hörnet och inget hål syns under taket.
  - Sadeltak: gavlarna går ut. Pulpettak: sidorna går ut.
  - Valmat och platt tak: alla överkanter är raka, och de längsta väggarna går ut.
  - Tillbyggnad: väggarna går stumt mot värdens vägg. Regeln gäller i de yttre hörnen.
  - Regeln hör till domänens fog (`JointStyle`), inte till varje objekttyp, när fler taktyper byggs.

- `core/export` gör en SVG per sida i millimeter (översikt först, sedan delarna). Appen gör PDF av dem med jsPDF och svg2pdf, som laddas först när någon laddar ner.
- Delar med samma form ritas en gång med "skär N st". Delar större än en sida delas i bitar med 10 mm överlappning, streckade skarvlinjer och kryss.
- Varje sida har en 10 cm kontrollinjal. Kontrollera skalan genom att mäta den efter ändringar i exporten.

## Mappar

Se `docs/SPEC.md` avsnitt 14. Kort:

- `src/core/` modell, geometri, flöde (Design → delar), layout och export.
- `src/domains/gingerbread/` objekttyper, material, texter.
- `src/app/` tillstånd, React-komponenter och 3D-vy.
- `tests/` Vitest-tester, speglar mappstrukturen i `src/`.

## Gränssnitt i mobilen

- Dator: 3D-vyn i mitten, inställningspanel till höger. Mobil och iPad: 3D-vyn i helskärm, panelen nerifrån. Tryckytor minst 44 × 44 pt.
- Knappar längst ner följer mönstret med `--bottom-gap` (`max(1rem, env(safe-area-inset-bottom))`, och bara `env(safe-area-inset-bottom)` i Safari på stående iPhone där Safari själv lämnar cirka 17 px). Skriv `env(safe-area-inset-bottom)` bara i `--bottom-gap`. Placera mot `100dvh`, aldrig `100vh`. Ingen `position: fixed` för huvudknappar.
- Uppmätt på iPhone 14, iOS 26, Safari: innerHeight = dvh = 699, vh = lvh = 739 på 390 × 844. Gissa inte; mät på riktig iPhone innan avstånd ändras.
- Kontrollerat i appen 2026-11-24 med `?matt` (iPhone, Safari, stående, verktygsfältet nertill): `--bottom-gap` = 0, sista knappen slutar vid 699 = innerHeight, och avståndet till verktygsfältet är cirka 18 px (Safaris eget mellanrum). Det ligger inom målet 16–18 px, så ingen ändring behövdes.

## Kodstil

- Namn säger vad saken är eller gör; funktioner börjar med ett verb, sanningsvärden med `is`, `has` eller `can`.
- Tal med betydelse får namngivna konstanter med enhet, t.ex. `PRINT_OVERLAP_MM = 10`.
- Filer under cirka 400 rader, en uppgift per fil, mappar efter vad de gör (inga `utils/`).
- Varje ny regel och varje rättad bugg får ett test.
- Leverera via PR mot `main`. Skriv "ägaren" i stället för namn i PR-texter, commits och kommentarer.

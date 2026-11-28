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

- Objekt fäster i kopplingspunkter (`Socket`). Punktens `bounds` är ytan det som fästs måste rymmas inom, sett vinkelrätt mot punkten. `topBounds` är ytan som objektets topp (`socketTopOutline`) får nå upp i när den får gå högre, t.ex. ett tak som läggs ovanpå värdens tak. En objekttyp kan ange `mountMatrix` för hur den sitter i punkten, t.ex. en tillbyggnad som står upprätt med bakre änden mot väggen.
- Påverkan (`Modifier`) ger områden i objektets egna koordinater; flödet fäller ner dem i måldelens plan. En öppning som skulle dela en del läggs inte på och blir ett fel.
- Regelmotorn (`core/rules`) läser reglerna som data från domänen och ger fel och varningar. Samma kontroll används i panelen, när nya objekt föreslås och för att stoppa ritningen.
- Nya objekt snäpper mitt i kopplingspunkten i den största storleken som klarar reglerna. Läget längs väggen snäpper till 5 mm och stannar där objektet ryms.
- Öppningen i värdens vägg är 10 mm mindre än tillbyggnadens insida mot långväggarna och taket (ägarens val), så att tillbyggnaden har en kant att fästas mot. Den lämnar också minst 10 mm av värdens vägg under väggens överkant, så att en hög tillbyggnad inte delar väggen. Nertill går den till golvet.
- En tillbyggnad får vara lika bred som väggen den sitter på och gå ända ut till hörnen (ägarens val, t.ex. för en kyrka med torn och långhus). Dess väggar är högst lika höga som värdens vägg. Taket får gå upp till värdens tak sett rakt mot väggen, så att nockarna kan ligga på samma höjd; vinkelrännan lägger det ovanpå. Går den utanför väggen blir den en sektion bredvid (se nedan). Takutsprången får gå förbi hörnet.
- En ny tillbyggnad tar högst 60 % av väggens längd, så att det finns plats att flytta den. Fältet för läget går bara att ändra så långt den kan flyttas.
- En ny tillbyggnad föreslås 60 % av väggens längd (ägarens val). Är 60 % smalare än minsta bredden föreslås minsta bredden, om väggen rymmer den. Vägghöjden föreslås 60 % av väggens höjd i hörnet, och 10 mm under den när 60 % är lägre än minsta höjden (ägarens val), så att tillbyggnader på varandras gavlar trappas ner. Ryms det inte räknas högsta vägghöjden ut direkt ur kopplingspunktens överkant och tak (`bounds`, `topBounds`) och tillbyggnadens kontur (`extensionProposal.ts`). En tornspira ärvs inte av en tillbyggnad; den får sadeltak.

- Fält i parameterschemat kan ha `groupKey` (visas under en egen rubrik, hopfälld från början), `isInherited` (ett nytt objekt får förälderns värde när föräldern är av samma typ, annars värdet från det senast skapade objektet av samma typ på föräldern, och finns inget där på närmaste förälder uppåt som har ett) och `visibleWhen` (visas bara för vissa värden på ett annat fält). Taket (taktyp, lutningar, takutsprången och kantens höjd) är en sådan grupp och ärvs nedåt (ägarens val). Panelen visar bara fälten för vald taktyp.

## Tak och vinkelrännor (fas 3)

- Taktyper: sadeltak, pulpettak, valmat tak, mansardtak, platt tak med kant, tornspira med 4 och 8 sidor (`objects/roof/`).
- Varje tak är plana takytor (`RoofLayout`): plan som höjd över golvet, och varje plan blir en del där det är lägst (`core/geometry/heightPlanes.ts`). Väggarnas överkant följer det lägsta av planen. Allt räknas med formler, inga sökningar.
- **Vrid taket 90°** (`isRoofTurned`, i takgruppen, bara för tak med lutning): taket räknas med bredd och längd bytta och vrids runt mitten (`roof/turnedLayout.ts`), så att t.ex. sadeltakets nock går tvärs över huset. Väggarna följer takets undersida som förut, och ritningen kallar de sneda väggarna gavlar. På en tillbyggnad slutar en takyta som faller mot värden med ovansidans kant mot värdens vägg; annars förlängs taket in över värden som vanligt. En ny tillbyggnad ärver inte vridningen, så att den får vinkelränna.
- Pulpettaket lutar längs huset och är högst bak, så att en tillbyggnad blir ett skjul mot värden. Mansardtaket har gavlar (brutet sadeltak). Den 4-sidiga spiran vilar på väggarna; den 8-sidiga står på en takskiva som täcker hörnen. Tornspira kan bara stå på fatet (regel `allowedParamValues`).
- **Vinkelrännor, snickarmetoden** (`interactions/valleys.ts`, samverkan i flödet efter påverkan): huvudhusets tak förblir helt. Tillbyggnadens tak förlängs in över värden (`VALLEY_REACH_MM`) och klipps där undersidan möter värdens takovansida. Ligger taket helt under värdens takutsprång går det in till väggen. Tillbyggnadens väggar och takkanter kapas där de skulle gå upp i värdens takutsprång. Går tillbyggnadens takutsprång förbi värdens hörn slutar det förlängda taket vid värdens vägg, så att det inte går in längs huset under eller bredvid värdens tak. En takyta som stiger in mot värden (pulpettak) blir aldrig ränna utan slutar vid värdens vägg, annars skulle den gå upp genom värdens tak. Värdens takskivor räknas med sina ändytor (vinkelräta mot skivan) utom vid takfoten, och skåran där två skivor möts i ett brott räknas som fylld, så att rännan inte får hack vid t.ex. mansardtakets brytlinje. Det fungerar mot alla taktyper.
- `subtractRegions` tar bort områdena ett i taget, eftersom klippbiblioteket kan tappa hela formen när många områden tas bort på en gång. Klarar biblioteket inte hörn som nästan sammanfaller prövas ett grövre rutnät (`SNAP_GRIDS_MM`), även för snitt och överlappsarea.
- **Takutsprång vid takfoten** mäts längs lutningen till takfallets ovansida (`roof/eaveFit.ts`), så 0 mm går jäms med väggens utsida. Takfallet står vinkelrätt mot sin yta, så ovansidans kant ligger tjockleken · sin(lutning) längre ut än undersidan. Räcker utsprånget inte till det slutar takfoten ovanpå väggen och taket flyttas in; väggarna behåller sin höjd och går aldrig under den (`wallProfileAlong`).
- Regelkontrollen i förslag och fält (`listViolations`) räknar inte samverkan, eftersom den oftast bara ändrar delar. Möten som samverkan inte kan lösa anger den med `listConflicts`, och de blir fel i samma kontroll.

## Sektioner bredvid varandra

- Ägarens val, t.ex. för en borg med fyra höga torn och låga block emellan, eller ett hus med ett torn som fortsätter upp ovanför taket. En sektion kan stå på fatet bredvid en annan sektions vägg (kopplingspunkten `wall-beside`), även bredvid en tillbyggnads vägg, t.ex. ett torn vid ett block som sitter på ett annat torn. Den har alla sina väggar, kan inte vridas och får vara högre och bredare än väggen. Den får flyttas så långt man vill längs väggen, så länge dess bakre gavel har minst en tjocklek kontakt med väggen (ägarens val). En tillbyggnad som flyttas förbi hörnet blir då en sektion bredvid.
- **En knapp, måtten avgör** (ägarens val): panelen har bara "Lägg till sektion". En vägg har två kopplingspunkter med samma del (`ownerPartId`), först den för tillbyggnad och sedan den bredvid. Ett objekt sitter i den första där det klarar reglerna (`core/rules/socketChoice.ts`), vid förslag, när ett mått eller ett val ändras (även förälderns mått) och när läget flyttas. Ryms sektionen på väggen blir den tillbyggnad, annars står den bredvid. Klarar den inget av dem sitter den kvar och felet visas. Vid ett val i takgruppen prövas först att rätta lutningen utan att byta sätt, så att t.ex. ett pulpettak på långväggen blir ett skjul som förut.
- Fältens gränser, även läget längs väggen, hoppar över korta glapp där inget av sätten går (`MAX_GAP_STEPS` = 8 steg). Glappen följer med gränserna (`OffsetRange.gaps`): − och + hoppar över dem, och ett värde som skrivs in i ett glapp visas som fel och används inte, så att fältet bara ger värden som går att bygga. Läget prövas ut till halva väggen plus halva sektionen (`measureOffsetReach`).
- Fältet för läget längs väggen visar kopplingspunktens u med omvänt tecken (`app/ui/shownOffset.ts`), så att plus flyttar åt höger och minus åt vänster sett utifrån mot väggen (ägarens val). Det gäller även fönster och dörrar.
- **Prestanda:** fältens gränser räknas i en web worker (`app/rules/rangeWorker.ts`), så att 3D-vyn och fälten svarar direkt när man scrollar ett mått. Medan de räknas gäller de senast kända gränserna, fältet som ändrades sist räknas först och en ny ändring avbryter den förra för samma objekt (`createLatestRequests`). Ett fönster och sektionen det sitter på är öppna samtidigt, så en ny begäran för den ena får inte avbryta den andra. Knapparna under en vägg (+ Sektion, + Fönster, + Dörr) prövar förslagen i en egen worker (`app/rules/proposalWorker.ts`, `useWallProposals`), eftersom förslagen tog cirka 0,3 s per ändring i panelen; tills de är kända går knapparna att trycka på, och ett tryck prövar förslaget igen. Regelkontrollen i sökningarna minns de senaste 2000 designerna efter innehåll (`core/rules/ruleCheck.ts`), så att samma design inte prövas två gånger.
- En sektion på fatet med sina tillbyggnader är en byggnad (`interactions/buildings.ts`). Samverkan mellan byggnader (`interactions/neighbors.ts`) körs efter vinkelrännorna:
  - **Gemensam vägg** (`sharedWalls.ts`): den högre väggen behålls och den lägre får ett hål så stort som den högre väggen. Hålet slutar en tjocklek innanför den högres hörn där den lägre väggen fortsätter förbi, så att den högres väggar står mot något. Täcks den lägre väggens hörn förlängs väggen som stod mellan ut till hörnet. Blir den lägre väggen flera bitar får bitarna id:n som `S1/side-right~2`.
  - **Tak mot väggar** (`neighborRoofs.ts`): tak som når in i en annan byggnads stomme (innanför väggarna och under takets ovansida) kapas, t.ex. husets takutsprång där tornet står. Kapningen räknas genom hela delens tjocklek (`regionThroughPart`), så att en del som går in genom stommens sida och ut genom taket också kapas.
  - **Takutsprång som korsar varandra** utanför båda byggnaderna, t.ex. vid ett hörn: byggnaden med lägre vägghöjd (vid lika den senare) lägger sitt utsprång under. Det kapas där det går genom det andra takets skivor och vidare ut till kanten, så att det inte blir hål. Därför finns inget glapp strax över husets vägghöjd (ägarens önskan).
  - **Tak mot tak** som ändå går in i varandra efter kapningen är ett fel (`rule.roofsMeet`), t.ex. en tornspira som går upp genom husets takutsprång. Där passar en tillbyggnad, som får en vinkelränna.
- Sektioner på fatet får stå vägg i vägg: `noOverlap` räknar bara väggarna för dem, men takutsprången för tillbyggnader.
- Förslaget prövar tillbyggnad först. Förslag för en sektion bredvid används när ingen tillbyggnad ryms: de tar 60 % av väggens längd och är lika djup som bred. Bredvid ett lågt hus blir den ett torn, 1,6 × väggens höjd i hörnet; bredvid ett torn (väggen högre än lång) ett block, 0,6 × höjden, med sadeltak i stället för tornspira. Går den första höjden inte prövas den andra.

## Fönster och dörrar (fas 4)

- Fönster (`gb.window`) och dörr (`gb.door`) fäster i väggytan (`wall-surface`) och sitter i väggens plan (`objects/openings/`). Läget längs väggen är kopplingspunktens u; fönstrets höjd över golvet är en parameter.
- Fönstret är ett hål i väggen: fyrkantigt, bågformat (rundbåge), runt eller halvmåne. Runt är alltid en cirkel och halvmånen en halvcirkel med rak underkant; båda har bara Bredd och höjden räknas ur den (ägarens val). Runda fönster har inga luckor. Med spröjs (kors) skärs fyra rutor och spröjsen blir kvar av väggen. Spröjs är av från början (ägarens val). Fönsterluckor är två egna delar, varsin halva av fönstret uppslagen mot väggens utsida.
- Dörren är en öppning från golvet, fyrkantig eller bågformad. Fältet Typ (ägarens val): Enkeldörr har ett dörrblad med samma form, alltid med gångjärnet till vänster, Dubbeldörrar två blad som är varsin halva, och Öppning inget blad. Det hette Öppning och inte Valv, eftersom ett valv är välvt. Bladen står alltid 30° öppna utåt (`OPEN_ANGLE_DEGREES`, inget fält). Gamla sparade dörrar blir enkeldörrar (`domains/gingerbread/migrateParams.ts`, domänversion 3).
- Regeln `onSolidPart` (`core/rules/surfaceRules.ts`) läser objekttypens `surfaceAreas`: minst 15 mm hel vägg runt öppningen (`OPENING_MARGIN_MM`, SPEC avsnitt 5) och vägg bakom luckorna. Den prövas på de färdiga delarna, så ett hål där en tillbyggnad eller en sektion bredvid möter väggen räknas, och en vägg som saknas ger fel. Två objekts täckta ytor (öppning och luckor) får inte överlappa. `maxCountPerSocket`: en dörr per vägg.
- `listViolations` räknar med samverkan som har `affectsSurfaces` (gemensamma väggar) när designen har sådana objekt; vinkelrännorna hoppas över där eftersom de är dyra.
- Förslag: storleken räknas från väggens höjd vid hörnen. Fönster och dörrar behåller hellre storleken och flyttas från mitten (`prefersSizeOverCenter`), så att ett andra fönster blir lika stort som det första. Ett nytt fönster ärver alla värden från det senast skapade fönstret på samma sektion, även på en annan vägg. Har sektionen inga fönster ärvs de från närmaste föräldrasektion uppåt som har, så att en tillbyggnad får lika stora fönster som huset (ägarens val). Ryms fönstret inte bredvid en dörr eller ett annat fönster prövas samma storlek högre eller lägre på väggen (var 10 mm, närmast först), t.ex. ovanför dörren, innan det blir mindre (ägarens val). Ryms inte storleken behålls form, spröjs och luckor och storleken räknas från väggen. Ett förslag får inte ge nya fel på andra objekt, t.ex. en tillbyggnad över ett fönster.
- Dörrens överkant föreslås i samma höjd som fönstrens överkant (ägarens önskan, `openingProposal.ts`): en ny dörr slutar där sektionens senaste fönster slutar, eller annars där det fönster som skulle föreslås på väggen slutar. Ett första fönster på en sektion som har en dörr slutar i dörrens överkant. Fönster i takkupor rättar sig inte efter dörrar. Objekttypen hittar det andra objektet med `findRelated` i `paramCandidates` (samma sökning som arvet).

- Panelen har bara sektioner och Inställningar på toppnivån (ägarens val). Under en sektion står Tak och väggarna, numrerade runt huset från framgaveln: Vägg 1–4, en tillbyggnad Vägg 1–3 (`socket.wallN`). Vägghöjd står överst i sektionen, eftersom den gäller alla väggar (ägarens val). Varje vägg har sin Längd (kopplingspunktens `partParams`: långväggen ändrar sektionens längd, gaveln dess bredd, så motstående väggar delar längd), sina fönster och dörrar och knapparna + Sektion, + Fönster och + Dörr, utan rubrik. Det finns ingen grupp Mått. En sektion som sitter på en annan har "Sitter på …" och läget längs väggen överst, alltid synligt, och "Ta bort" sist. "Ta bort" ligger i det utfällda objektet, inte på raden. "Ta bort" bekräftas med knappar i panelen, som "Börja om" (ägarens val, `app/ui/ConfirmAction.tsx`), och panelen rullar så att knapparna syns (`revealInPanel`). En sak är utfälld i taget: en sektion, inuti den Tak eller en vägg, och inuti väggen ett fönster eller en dörr (`app/ui/SectionSettings.tsx`, `WallSettings.tsx`, `panelWalls.ts`). Fel på fönster och dörrar visas på väggen när den är stängd och på sektionen när den är stängd. Ett tryck på en vägg i 3D-vyn öppnar sektionen och väggen; ett tryck på ett fönster, en dörr, en lucka eller ett dörrblad öppnar objektet och dess vägg; hålen har osynliga ytor att trycka på (`app/three/pickAreas.ts`). Väggen eller fönstret som är öppet visas markerat i 3D, fönstret före väggen. Ett tryck på taket öppnar sektionen och fäller ut Tak och markerar taket: takets delar bär `paramGroupKey` (`app/ui/selectionHighlight.ts`). Efter ett tryck i 3D-vyn rullar panelen så att rubriken för väggen, taket, fönstret eller dörren står överst, och likaså för ett nytt objekt (sektion, fönster, dörr) (`app/ui/scrollToHeading.ts`); bara panelens egen rullyta flyttas, aldrig arket i mobilen.

## Takkupor (fas 6)

- Varje takfall med lutning har en kopplingspunkt `roof-surface` (`objects/roof/roofSockets.ts`) på ovansidan: origo mitt på takfoten, u vågrätt längs takfoten och v uppför takfallet. Takfallet heter efter väggen det lutar ner mot, t.ex. "Takfall mot Vägg 2", och "Nedre/Övre takfall" på mansardtak. Platt tak och tornspiror har inga. Punkterna bär `paramGroupKey` (taket), så panelen visar dem under Tak och ett tryck på taket öppnar Tak som förut.
- Takkupan (`gb.dormer`, `objects/dormer/`) är en liten tillbyggnad med sadeltak eller pulpettak som står upprätt på takfallet. Väggarna och taket räknas med sektionens kod; väggarna kapas mot takets ovansida längs utsidan och kupans tak klipps i vinkelrännor mot husets tak med samma kod som tillbyggnaderna (`interactions/dormers.ts`). Mått: Avstånd från takfoten (längs lutningen till framväggens utsida), Bredd och Vägghöjd (framväggen vid hörnen); djupet räknas ut. Kupans tak (lutning, utsprång) är en egen grupp, "Kupans tak", och ärvs från förra kupan men inte från huset (ägarens val).
- Pulpettaket lutar ut från huset och slutar där det möter husets tak, ovanpå det. Det måste vara flackare än husets tak (`rule.dormerRoofTooSteep`); väljer man pulpettak sänks lutningen av sig själv.
- Framväggen har en kopplingspunkt `dormer-wall` (`dormerSockets.ts`) där bara fönster fäster. Ett fönster där behöver 5 mm hel vägg runt sig (`DORMER_OPENING_MARGIN_MM`, ägarens val), eftersom framväggen är låg. En ny kupa får ett fönster direkt om det ryms (`ObjectType.startsWith`, `core/rules/addProposedChild.ts`), ärvt från husets fönster men så stort som framväggen rymmer.
- Husets takfall får ett hål 10 mm innanför kupans väggar och under dess tak (`DORMER_HOLE_INSET_MM`).
- Regler: kupan behöver 15 mm helt tak runt sig, ska ligga under nocken och får inte ta samma yta som en annan kupa (`onSolidPart`). Ett annat objekts delar som går in i kupans kropp, t.ex. en tillbyggnads tak på samma takfall, är ett fel (`rule.dormerMeetsRoof`, `listConflicts`).
- Panelen: under Tak står kuporna, listan Takfall och två korta knappar, + Takkupa och + Skorsten, som lägger till på valt takfall (ägarens val). Ett tryck på taket i 3D-vyn väljer takfallet man tryckte på och markerar bara det (`selectedGroupSocket`, `findGroupSocketOwning`); innan något är valt gäller det första, t.ex. takfallet mot Vägg 2 (`findChosenGroupSocket`). Listan gör samma val med tangentbord och står kvar när annat väljs. Platt tak och tornspiror markeras hela. I en kupa står dess fönster och + Fönster (`isShownUnderParent`: ett objekt i en fältgrupp visas under föräldern fast det bär något; ett öppet fönster i kupan håller kupan och Tak utfällda, `listOpenChain`). Knapparnas namn för skärmläsare säger takfallet: "Lägg till takkupa på takfall mot vägg 2". Fältet heter "Läge längs taket" (domänens text `offset.roof-surface`).
- Ritningen ger en smal del lika mycket plats som etiketten (`measureLabelWidth`), så att namnen på små delar inte går in i varandra.

## Skorsten

- Skorstenen (`gb.chimney`, `objects/chimney/`) står upprätt på ett takfall (`roof-surface`), som takkupan (`objects/roofMount.ts`). Fyra sidor: sidorna har nederkanten snedskuren mot takplanet (SPEC avsnitt 8) och går hela vägen ut; fram- och baksidan står mellan dem. Varje sida når ner till takytan vid sin nedre yta, så att ingen glipa syns. Den tar inget hål i taket.
- Mått: Avstånd från takfoten (längs lutningen till framsidans utsida), Bredd (längs takfoten), Djup (vågrätt in mot nocken) och Höjd över taket, mätt på baksidan där taket är högst, så att varje höjd går att bygga. Måtten ärvs från förra skorstenen på huset.
- Regler: 5 mm helt tak runt sig (`CHIMNEY_MARGIN_MM`), under nocken och inte på samma yta som en kupa (`onSolidPart`). Den står bara ovanför väggarna, aldrig på takutsprången (ägarens val, `rule.chimneyOverWalls`): sett uppifrån ska foten ligga inom väggarnas ytterkant (`hostWallPlan`). Ett annat objekts delar som går in i skorstenen, t.ex. en kupas takutsprång, är ett fel (`rule.chimneyMeetsRoof`, `interactions/chimneys.ts`).
- **Mot väggen** (ägarens val): skorstenen kan också stå på fatet mot en vägg (`wall-surface`, `chimneyOnWall.ts`) och gå upp förbi takutsprånget, som får ett urtag där den går upp (`interactions/chimneys.ts`). Höjden över taket räknas då från det högsta av taket sett rakt mot väggen (`topBounds`). Den får flyttas längs väggen men inte förbi hörnen (ägarens val, `withinSocketBounds` med `wallChimneyBase`), och får inte täcka fönster eller dörrar (`onSolidPart`).
- Avstånd från takfoten 0 betyder mot väggen. Takfallet och väggen under takfoten är alternativ för varandra (`Socket.alternativePartIds`, `listAlternativeSockets`), så sätts avståndet till 0 flyttar skorstenen ner till väggen, och ökas det flyttar den upp på takfallet igen om den ryms där. Alternativen prövas i objekttypens `attachesTo`-ordning; ett nytt objekt prövas först i punkten man tryckte på. Under varje vägg finns också "+ Skorsten".
- Förslaget ställer baksidan strax nedanför nocken. Panelen visar skorstenarna under Tak, med knappen "+ Skorsten" för valt takfall. Texten när inget ryms kan anges per objekttyp (`cannotAdd.gb.chimney`) före sorten av kopplingspunkt.

## 3D-vyn

- Huset med alla tillbyggnader, sektioner och takutsprång står alltid mitt på fatet (ägarens önskan). 3D-vyn flyttar delarna så att mitten av rutan runt dem sett uppifrån hamnar i fatets mitt (`app/three/plateCentering.ts`). Ritningen och regelkontrollen räknar som förut; bara vyn flyttar.

## Lagring

- Det öppna huset sparas av sig självt (`app/storage/`), 0,4 s efter senaste ändringen och direkt när sidan göms, via `ProjectStore` i webbläsarens lokala lagring. Vid start öppnas det senast sparade; går det inte att migrera (`core/model/migrateDesign.ts`) eller räkna börjar appen med mallen. "Börja om" under Inställningar ersätter huset med mallen efter en bekräftelse i panelen, och autosparet skriver över det sparade (ägarens önskan).

## Ångra och Gör om

- Knapparna Ångra och Gör om står bredvid Centrera i 3D-vyns hörn, med ikon och text som Centrera (`app/ui/HistoryButtons.tsx`). På dator ångrar Ctrl/Cmd+Z och Skift+Ctrl/Cmd+Z eller Ctrl+Y gör om, utom i ett textfält där webbläsaren ångrar det man skriver.
- Historiken (`app/state/designHistory.ts`) gäller bara medan sidan är öppen, högst 100 steg. Ändringar av samma fält på samma objekt som kommer tätare än 1 s blir ett steg (`MERGE_WINDOW_MS`), så att snabba tryck på − och + ångras med ett tryck. Börja om går att ångra; att öppna det sparade huset vid start tömmer historiken.

## Ritningen

- **Hörnregeln för stumfog** (ägarens val): en vägg med sned överkant går hela vägen ut, och väggar med rak överkant kortas med 2 × tjockleken och står mellan. Då följer den sneda väggen takets undersida ut till hörnet och inget hål syns under taket.
  - Sadeltak: gavlarna går ut. Pulpettak: sidorna går ut.
  - Mansardtak: gavlarna går ut.
  - Valmat tak, platt tak och tornspiror: alla överkanter är raka, och de längsta väggarna går ut. Är de lika långa (kvadratiskt torn) går gavlarna ut.
  - Kanten runt ett platt tak följer samma regel.
  - Tillbyggnad: väggarna går stumt mot värdens vägg. Regeln gäller i de yttre hörnen.
  - Regeln hör till domänens fog (`JointStyle`, `buttJoint` i `joints.ts`), inte till varje taktyp: en vägg räknas som sned när takets undersida lutar längs den.

- `core/export` gör en SVG per sida i millimeter (översikt först, sedan delarna). Appen gör PDF av dem med jsPDF och svg2pdf, som laddas först när någon laddar ner.
- Delar med samma form ritas en gång med "skär N st", oavsett var konturen börjar. En del som är spegelvänd mot en annan, t.ex. tillbyggnadens takhalvor efter rännan, ritas också en gång med "varav N spegelvänd". Delar större än en sida delas i bitar med 10 mm överlappning, streckade skarvlinjer och kryss.
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

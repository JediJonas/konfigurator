# Byggkonfiguratorn – projektunderlag

Första domänen: **pepparkakshus**.

## 1. Vision

En webbaserad 3D-konfigurator för objekt som byggs av **platta delar**. Man kombinerar byggobjekt i 3D, och appen tar fram ett tillverkningsunderlag: ritning i skala 1:1, delar packade på skivor eller plåtar, materialåtgång och byggordning. Allt man ser i 3D ska gå att tillverka: underlaget räknas fram från exakt samma delar som 3D-modellen.

Vi börjar med pepparkakshus. Kärnan ska ändå vara fri från pepparkaksbegrepp, så att andra domäner kan läggas till senare som egna **domänpaket**, till exempel papphus, fågelholkar, dockskåp i laserskuren plywood eller julkrubbor.

Hobbyprojekt. Ska fungera bra på dator, mobil och iPad. Ingen server behövs: allt körs i webbläsaren.

## 2. Avgränsning av det generella

- Kärnan hanterar objekt byggda av **platta delar med en materialtjocklek**. Det är den gemensamma nämnaren för alla tänkta domäner och håller kärnan konkret.
- Fria former (svarvat, gjutet, 3D-utskrivet) ligger utanför.
- **Arbetsregel:** bygg pepparkaksdomänen färdigt först. Flytta bara upp något i kärnan när det uppenbart är generellt. Kärnan får inte innehålla ord som "deg", "glasyr" eller "pepparkaka". Generella delar som ännu bara används av en domän är okej, men vi bygger inga abstraktioner för domäner som inte finns.

## 3. Begrepp

| Begrepp | Kod | Betydelse |
|---|---|---|
| Domänpaket | `Domain` | Samling objekttyper, material, regler, mallar och texter för ett användningsområde. |
| Objekttyp | `ObjectType` | En sorts byggobjekt, t.ex. sektion, fönster, skorsten. Definierar parametrar, kopplingspunkter, delar och påverkan. |
| Objekt | `Instance` | Ett placerat objekt med egna parametervärden. |
| Parametrar | `ParamSchema` | Typade inställningar (mått, vinklar, val) som också driver formulären i UI:t. |
| Kopplingspunkt | `Socket` | Ställe på ett objekt där andra objekt kan fästa: en yta, en kant eller en punkt. Har en **kopplingstyp**, t.ex. `wall-surface`, `roof-surface`, `wall-edge`, `ground`. |
| Koppling | `Attachment` | Att ett objekt sitter i en kopplingspunkt på ett annat, med position och rotation i punktens eget koordinatsystem. |
| Kopplingsregel | `Rule` | Vad som får och inte får kombineras (se avsnitt 5). |
| Påverkan | `Modifier` | Hur ett objekt ändrar andra objekts delar: tar upp hål, klipper, tar bort eller förlänger. |
| Samverkan | `InteractionResolver` | Logik för två objekt som möts som jämlikar, t.ex. två sektioner vars tak bildar en vinkelränna. |
| Del | `Part` | En platt bit: kontur, hål, tjocklek, placering i 3D, markeringar. |
| Material | `Material` | Tjocklek, skiv- eller plåtmått, skärspalt, densitet och färg/textur i 3D. |
| Fog | `JointStyle` | Hur delar möts: stumfog (pepparkaka med glasyr), flikar (papp), fingerskarv (plywood). Påverkar delarnas kanter. |
| Exportformat | `Exporter` | PDF i 1:1, SVG, senare DXF för laserskärare. |
| Mall | `Preset` | Färdig design att utgå från. |

## 4. Datamodell (skiss)

```ts
type Mm = number;

interface Design {
  version: number;              // schemaversion, för migrering av sparade och delade designer
  domain: string;               // 'gingerbread'
  domainVersion: number;
  material: { id: string; thickness: Mm };
  root: Instance;               // t.ex. "tomt" eller "fat" som allt står på
}

interface Instance {
  id: string;
  type: string;                 // objekttypens id, t.ex. 'gb.section', 'gb.window'
  params: Record<string, unknown>;     // valideras mot objekttypens ParamSchema
  attachment?: {
    socketId: string;           // kopplingspunkt på föräldern
    u: Mm; v: Mm;               // position i kopplingspunktens plan
    rotation: number;
  };
  children: Instance[];         // monteringsträd
}

interface ObjectType<P = Record<string, unknown>> {
  id: string;
  label: string;                // via domänens texter
  params: ParamSchema<P>;
  sockets(inst: Instance, ctx: Ctx): Socket[];      // vad andra kan fästa i
  attachesTo: SocketKind[];                         // vad detta objekt kan fästa i
  parts(inst: Instance, ctx: Ctx): Part[];
  modifiers?(inst: Instance, ctx: Ctx): Modifier[]; // påverkan på förälder eller grannar
  rules?: Rule[];
  buildStep?(inst: Instance, ctx: Ctx): number;
}

interface Socket {
  id: string;
  kind: SocketKind;             // 'wall-surface' | 'roof-surface' | 'wall-edge' | 'ground' | …
  frame: Frame3;                // eget koordinatsystem (u, v, normal)
  bounds: Vec2[];               // tillåten yta i (u, v)
  ownerPartId: string;          // vilken del som påverkas av t.ex. hål
}

type Modifier =
  | { kind: 'cutout'; targetPartId: string; polygon: Vec2[] }
  | { kind: 'clipByPlane'; targetPartId: string; plane: Plane }
  | { kind: 'removeRegion'; targetPartId: string; polygon: Vec2[] }
  | { kind: 'remove'; targetPartId: string };

interface Part {
  id: string;                   // stabilt, t.ex. "S1/vagg-fram"
  sourceInstanceId: string;
  label: string;
  outline: Vec2[];              // mm
  holes: Vec2[][];
  thickness: Mm;
  transform: Matrix4Like;
  mirroredPairOf?: string;
  marks?: Mark[];               // t.ex. karamellfönster, vikmarkering
  buildStep: number;
}

interface Domain {
  id: string;
  objectTypes: ObjectType[];
  rules: Rule[];                // regler som gäller hela designen
  interactions: InteractionResolver[];
  materials: Material[];
  jointStyles: JointStyle[];
  presets: Preset[];
  strings: Record<string, string>;
  estimates?: (parts: Part[], material: Material) => Estimate[];  // t.ex. degmängd
}
```

**Monteringsträd:** varje objekt har en förälder (det det sitter på). Det ger enkel ångra-historik, borttagning (barn följer med) och tydlig byggordning. Relationer mellan objekt som inte är förälder och barn, som två sektioner som möts, hanteras av samverkansregler i stället för korsreferenser i trädet.

## 5. Kopplingsregler

Reglerna är data i domänpaketet, inte kod i UI:t. Samma regler används för att:
- visa vilka objekt som går att lägga till på den markerade ytan
- gråa ut otillåtna val, med en förklaring
- validera inlästa och delade designer

| Regeltyp | Exempel (pepparkakshus) |
|---|---|
| `attachesTo` | Fönster fäster på `wall-surface`; skorsten på `roof-surface`; sektion på `ground`, `wall-surface` (som tillbyggnad) eller `wall-beside` (bredvid en vägg, med gemensam vägg). |
| `requires` | Trappa kräver en dörr på samma vägg. Fönsterlucka kräver ett fönster som förälder. |
| `excludes` | Takkupa går inte på platt tak eller tornspira. |
| `maxCount` | Högst en dörr per vägg. |
| `minClearance` | Minst 15 mm material mellan hål och mot kanter. |
| `noOverlap` | Objekt i samma kopplingspunkt får inte överlappa. |
| `paramConstraint` | Tillbyggnadens vägghöjd får inte vara högre än huvudhusets. |

Två nivåer:
- **Fel**: kombinationen kan inte tillverkas, och appen förhindrar den.
- **Varning**: kombinationen går att tillverka men är riskabel, t.ex. en hög och tunn vägg. Appen visar varningen men låter användaren fortsätta.

## 6. Flödet

```
Design (JSON)
   │  validera mot regler
   ▼
Objekttyper ger delar ──► påverkan (hål, klippning) ──► samverkan (vinkelrännor m.m.) ──► fogar
   │
   ▼
Delar (platta polygoner i mm + placering i 3D)
   ├──► 3D-vy (extrudera till materialtjockleken)
   ├──► export (PDF 1:1, SVG, senare DXF)
   ├──► packning på skivor/plåtar
   ├──► byggordning och byggguide
   └──► uppskattningar (domänens, t.ex. degmängd)
```

- Kärnans geometri är ren TypeScript utan beroende till React eller three.js, och testas fristående.
- Alla mått internt i **millimeter**.
- 3D-vyn och exporten räknar aldrig egna mått; de läser bara delar.

## 7. Kärnans geometri (generell)

- Polygoner i 2D med hål; klippning (union, differens, snitt).
- Plan i 3D: skärning mellan plan, klippning av en 3D-polygon mot ett plan, utfällning av en plan 3D-polygon till 2D.
- Kopplingspunkternas koordinatsystem (u, v, normal) för placering och snäppning.
- Fogar: justering av kanter efter tjocklek och fogtyp (förkortning vid stumfog; flikar och fingrar läggs till senare).
- Packning av delar på rektangulära skivor.
- Sidindelning för utskrift med skarvmärken.

## 8. Domänpaketet Pepparkakshus

### Material och fog
- Material: pepparkaksdeg, standardtjocklek 4 mm, plåt 400 × 300 mm, densitet för degmängd, brun textur i 3D.
- Fog: stumfog. Två motstående väggar går hela vägen ut, de andra två kortas med 2 × tjockleken. Glipor täcks med glasyr.

### Objekttyper i första versionen
- **Sektion:** golvyta, vägghöjd, tak. Kopplingspunkter: fyra väggytor, takytor och väggkanter. Kan fästa på marken eller mot en väggyta på en annan sektion (tillbyggnad). Ger öppning i värdens vägg (`removeRegion`) och har ingen egen vägg mot värden.
- **Sektion bredvid:** en sektion som står på fatet mot en annan sektions vägg (`wall-beside`) och får vara högre och bredare än väggen, t.ex. ett torn bredvid ett hus eller en borg med höga torn och låga block emellan. Där väggarna står mot varandra behålls den högre väggen och den lägre får ett hål. Tak som når in i den andra sektionen kapas mot dess väggar, och där takutsprången korsar varandra läggs den lägre byggnadens utsprång under. Tak som ändå går in i varandra blir ett fel; där passar en tillbyggnad med vinkelränna. Sektionen får flyttas längs väggen så länge den har kontakt med den. Det finns en knapp, "Lägg till sektion": ryms sektionen på väggen blir den tillbyggnad, annars står den bredvid, och den byter av sig själv när måtten ändras.
- **Tak** (som parameter på sektionen): sadeltak, pulpettak, valmat tak, mansardtak, platt tak med kant, tornspira (4- eller 8-sidig).
- **Fönster** (med eller utan spröjs), **fönsterlucka**, **fönsterbläck**, **dörr**, **trappa**, **farstukvist/veranda** med pelare, **takkupa**, **skorsten**, **balkong**, **LED-hål**, **karamellfönster** (markering).

### Samverkan: vinkelrännor
- Tak från två sektioner som möts klipps längs skärningslinjen mellan takplanen. Fungerar även när tillbyggnaden har samma vägghöjd som huvudhuset.
- **Snickarmetoden:** huvudhusets tak förblir helt. Tillbyggnadens takytor klipps längs rännan och placeras ovanpå huvudtaket, alltså förskjutna med materialtjockleken.
- Klarar olika lutningar, olika bredder (rännorna möter huvudtaket under nocken) och lika bredd (korstak med nockar på samma höjd).
- Asymmetriska takbitar ritas som spegelvända par.

### Samverkan: sektioner bredvid varandra
- En sektion på fatet och dess tillbyggnader är en byggnad. Mellan byggnader finns inga vinkelrännor.
- **Gemensam vägg:** där två byggnaders väggar står mot varandra behålls den högre väggen. Den lägre får ett hål så stort som den högre väggen, utom en tjocklek innanför den högres hörn där den lägre väggen fortsätter förbi. Försvinner den lägre väggens hörn förlängs väggen som stod mot den ut till hörnet.
- Tak, takutsprång och takkanter som når in i en annan byggnads stomme (innanför väggarna och under taket) kapas.
- Takutsprång som korsar varandra utanför båda byggnaderna: den lägre byggnadens utsprång läggs under och kapas ut till kanten.
- Tak från två byggnader som ändå går in i varandra är ett fel.

### Specialfall
- **Skorsten:** nederkanten snedskärs mot takplanet den står på.
- **Takkupa:** en liten sektion på en takyta; tar upp hål i takbiten och har egna väggar och tak som klipps mot huvudtaket.

### Uppskattning
- Degmängd i gram och antal satser av ett grundrecept, inklusive spill.

### Framtida funktioner (inte nu, men arkitekturen ska tillåta dem)
- Dekorläge: glasyrlinjer, godis och snö i 3D. Dekoration är objekttyper som inte ger några delar till underlaget.
- Fristående objekt: gran, snögubbe, brevlåda, vedtrave, staket med grind, uthus (fäster på `ground`).
- Export av bild (PNG).

## 9. Ritning och utskrift

- SVG i skala 1:1 genereras från delar, sedan PDF med jsPDF och svg2pdf.
- Delar som är större än en sida delas över flera sidor med skarvmärken och en överlappning på 10 mm.
- Varje del: nummer, namn, "skär N st", eventuellt "spegelvänd", markeringar.
- Varje sida: en 10 cm-kontrollinjal och texten "Skriv ut i faktisk storlek / 100 %".
- Första sidan: översiktsbild, dellista, packningsplan, uppskattningar, varningar och byggordning.
- Pappersformat: A4 som standard, A3 som val.
- Exportformaten är utbytbara moduler, så att SVG eller DXF för laserskärning kan läggas till för andra domäner.

## 10. Packning

- Skivans eller plåtens mått kommer från materialet och kan ändras av användaren, liksom kantmarginal och avstånd mellan delar.
- En enkel packningsalgoritm (t.ex. "bottom-left" på omslutande rektanglar, rotation 0° och 90°) räcker till en början.
- Resultat: antal skivor/plåtar och en bild per skiva.

## 11. Byggordning

- Domänen anger ordningen per objekttyp. För pepparkakshus: bottenplatta → väggar per sektion → anslutningar → tak (huvudhus först) → skorsten, kupor och övriga detaljer.
- Byggguide i appen: steg för steg, där 3D-vyn visar vilka delar som läggs till i varje steg.

## 12. Gränssnitt

- **Dator:** 3D-vyn i mitten, inställningspanel till höger, verktygsfält överst.
- **Mobil och iPad:** 3D-vyn i helskärm, inställningar i en panel som dras upp nerifrån. Stora tryckytor (minst 44 × 44 pt). Respektera safe area-marginalerna på iPhone.
- **Interaktion:** tryck på en yta för att markera dess kopplingspunkt. Panelen visar bara de objekttyper som reglerna tillåter där; otillåtna visas utgråade med förklaring. Nya objekt snäpper på plats i kopplingspunkten. Två fingrar för att rotera och zooma.
- **Lägen:** Bygg → Detaljer → Underlag (förhandsvisning av ritning, packning och byggordning).
- **Formulär:** genereras från objekttypens parametrar, så att nya objekttyper inte kräver ny UI-kod.
- **Språk:** svenska. Texterna kommer från domänpaketet och kärnans textfil.
- **Tillgänglighet:** allt som går att göra i 3D-vyn ska också gå att göra via panelen, t.ex. genom att välja objekt och kopplingspunkt i listor.

## 13. Teknik

- **Språk:** TypeScript (strict).
- **Bygg:** Vite.
- **UI:** React.
- **3D:** three.js via React Three Fiber och drei.
- **Tillstånd:** Zustand, med historik för ångra/gör om (t.ex. zundo).
- **Geometri 2D:** egen kod för polygoner. Vid behov ett bibliotek för polygonklippning (t.ex. `polygon-clipping` eller `clipper2`).
- **Validering av parametrar:** t.ex. Zod, så att samma schema ger typer, validering och formulär.
- **PDF:** jsPDF och svg2pdf.js.
- **Tester:** Vitest för geometri, regler och domänlogik. Playwright för ett fåtal flöden från början till slut.
- **Lagring:** IndexedDB (t.ex. via idb-keyval eller Dexie) för sparade projekt; hela designen komprimerad i URL:en (t.ex. lz-string) för delning. Se avsnitt 15.
- **Framtid:** Supabase för synk mellan enheter (se avsnitt 15).
- **Driftsättning:** statisk webbplats (GitHub Pages, Netlify eller liknande).

## 14. Projektstruktur (förslag)

```
src/
  core/
    model/         Design, Instance, ObjectType, Socket, Rule, Part
    geometry/      polygoner, plan, klippning, utfällning, fogar
    rules/         regelmotor och validering
    pipeline/      Design → delar
    layout/        packning, sidindelning
    export/        PDF, SVG (senare DXF)
  domains/
    gingerbread/
      objects/     en fil per objekttyp
      interactions/  t.ex. vinkelrännor
      rules.ts
      materials.ts
      presets/
      strings.sv.ts
  app/
    state/         store, historik
    storage/       ProjectStore: lokal version (senare Supabase), URL-delning, export/import
    ui/            React-komponenter, genererade formulär
    three/         3D-vy
tests/
```

**Beroenderegel:** `core` får inte importera från `domains` eller `app`. `domains` får importera från `core`. En enkel lintregel kontrollerar det.

## 15. Lagring av projekt

### Nu: lokalt, ingen server
- Flera namngivna projekt sparas i webbläsarens IndexedDB, med en liten förhandsbild och senast ändrad.
- Autospar av det öppna projektet.
- Export och import som `.json`-fil (säkerhetskopia, flytt mellan enheter för hand).
- Delning via länk med hela designen i URL:en.

### Lagringsgränssnitt
All lagring går via ett gränssnitt, så att en serverlösning kan läggas till utan att resten av appen ändras:

```ts
interface ProjectStore {
  list(): Promise<ProjectMeta[]>;
  load(id: string): Promise<Project>;
  save(project: Project): Promise<void>;
  remove(id: string): Promise<void>;
}

interface ProjectMeta {
  id: string;
  name: string;
  domain: string;
  thumbnail?: string;     // liten bild som data-URL
  updatedAt: string;      // ISO 8601
}

interface Project extends ProjectMeta {
  design: Design;         // innehåller schemaversion för migrering
}
```

### Framtid: Supabase (inte i fas 1)
Syftet är att kunna börja på en enhet och fortsätta på en annan.
- Inloggning med inloggningslänk via mejl (Supabase Auth). Inloggning är frivillig; lokal lagring förblir standard.
- En tabell `projects`: `id`, `user_id`, `name`, `domain`, `design (jsonb)`, `thumbnail`, `updated_at`.
- Radnivåsäkerhet (RLS): användare ser och ändrar bara sina egna projekt.
- Synk: senast ändrad vinner, med en varning om samma projekt ändrats på två enheter.
- Kontrollera gratisnivåns villkor (inaktiva projekt kan pausas), eftersom appen mest används under en kort säsong.
- Senare möjligheter: korta delningslänkar, ett galleri med publicerade hus.

## 16. Utvecklingsordning

Varje fas ska ge något som går att prova på riktigt.

1. **Grund:** projektuppsättning, kärnans modell och flöde i minimal form, objekttypen sektion med sadeltak, 3D-vy och PDF i 1:1. *Klart när en utskriven ritning ger bitar som går att sätta ihop till ett hus.*
2. **Kopplingar och regler:** kopplingspunkter, snäppning, regelmotor, tillbyggnader med öppning i gemensam vägg.
3. **Tak:** alla taktyper och samverkan för vinkelrännor, även vid samma vägghöjd.
4. **Detaljer, del 1:** fönster, dörr, fönsterluckor, skorsten.
5. **Underlag fullt ut:** packning, degmängd, byggordning, varningar.
6. **Detaljer, del 2:** trappa, veranda, takkupa, balkong, LED-hål, karamellfönster.
7. **Finputs:** mallar, ångra/gör om, sparade projekt lokalt (ProjectStore), export/import, delning via länk, byggguide i 3D.
8. **Framtid:**
   - dekor och fristående objekt
   - synk mellan enheter med Supabase (avsnitt 15)
   - en andra domän, som prövar att kärnan verkligen är generell. Ett papphus med flikar är en bra kandidat.

## 17. Kvalitet och tester

- Kärnan testas med enhetstester: klippning, utfällning, plan-skärningar, fogjustering.
- Regelmotorn testas med tabeller över tillåtna och otillåtna kombinationer.
- Egenskapstest: delar som delar en kant ska ha lika långa kanter (inom 0,5 mm).
- Rännornas läge testas för kända fall (lika lutning ger 45° sett uppifrån).
- En testsida i utvecklingsläge som visar alla delar för domänens mallar.
- Kontrollera skalan genom att mäta PDF:ens kontrollinjal.
- Sparade designer har en schemaversion, med test för migrering från äldre versioner.

## 18. Öppna frågor

- Ska bottenplattan vara en egen del på ritningen, eller antas huset stå på ett fat?
- Ska tjockleken kunna skilja mellan objekttyper (t.ex. tunnare luckor)?
- Behövs stöd för icke-rätvinkliga kopplingar (t.ex. 45°), eller räcker räta vinklar?
- Ska man kunna byta domän i samma app (startsida med val), eller blir varje domän en egen sida?

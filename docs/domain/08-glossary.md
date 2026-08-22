# 8 · Glossary

## 8.1 · Abbreviations that appear in the MTO

The ones found **in this file** of 15 rows:

| Abbrev. | Meaning | Where | Example |
|---|---|---|---|
| `LG` | *length* — marks that the preceding number is the length | rows 1, 5, 12 | `7/8" X 130 LG` |
| `W/` | *with* — introduces the elements of the set | rows 1, 5 | `W/2 HEX. NUT` |
| `W/2` | *with 2* — with explicit multiplicity | rows 1, 5 | `W/2 HEX. NUT 7/8"` |
| `c/w` | *complete with* — equivalent to `W/` | row 8 | `c/w NUT AND WASHER` |
| `with` | plain English | rows 2, 4, 7 | `with NUT DIN934` |
| `con` | Spanish for "with" | rows 3, 6, 9 | `con tuerca y arandela` |
| `HEX.` | *hexagonal* | rows 1, 8 | `HEX. NUT`, `HEX BOLT` |
| `GR` | *grade* — ASTM grade | rows 1, 5, 12 | `GR B7`, `GR 2H` |
| `ZN` | zinc → `CINCADO` (zinc-plated) | row 8 | `8.8, ZN` |
| `uds` | *units* (Spanish, `UD` column) | all | `40 uds` |
| `DIN` | German standard | 8 rows | `DIN 931` |
| `ASTM` | American material standard | rows 1, 5, 12 | `ASTM A193` |
| `M` | metric | 12 rows | `M20`, `M16x60` |
| `"` | inch | rows 1, 5, 12 | `7/8"` |

## 8.2 · Abbreviations NOT present here but that will show up

A real MTO carries these. They deserve a place in the recognizer before they show up in the
blind set:

**Elements and structure**
| Abbrev. | Meaning |
|---|---|
| `EA` | *each* — unit (equivalent to `uds`) |
| `PCS`, `PZ` | *pieces* |
| `SET`, `CJTO` | assembly/set — **careful: this changes the quantity arithmetic** |
| `QTY`, `CANT` | quantity |
| `NPS`, `DN` | *Nominal Pipe Size* / *Diámetro Nominal* — pipe size, not fastener size |
| `SCH`, `SCH 40` | *schedule* — pipe wall thickness. If it appears, the row is probably not a fastener (`P-9`) |
| `REQD` | *required* |
| `ASSY` | *assembly* |
| `TYP` | *typical* |
| `NTS` | *not to scale* |

**Fasteners**
| Abbrev. | Meaning |
|---|---|
| `HH`, `HHCS` | *Hex Head (Cap Screw)* — hex-head bolt |
| `SHCS` | *Socket Head Cap Screw* — cylindrical Allen-head bolt (DIN 912) |
| `FHCS` | *Flat Head Cap Screw* — countersunk Allen head (DIN 7991) |
| `CSK` | *countersunk* |
| `THD`, `THR` | *thread(ed)* |
| `TR`, `ATR` | *Threaded Rod*, *All Thread Rod* |
| `UNC` / `UNF` | unified coarse / fine thread (imperial) |
| `TPI` | *threads per inch* |
| `RH` / `LH` | *right hand* / *left hand* — right-hand / left-hand thread |
| `FT` / `PT` | *full thread* / *partial thread* |
| `HDG`, `HDZ` | *Hot Dip Galvanized* |
| `ZP`, `EZ` | *Zinc Plated*, *Electro-Zinc* |
| `YZP` | *Yellow Zinc Plated* → `BICROMATADO` (yellow chromate) |
| `BL`, `BO` | *Black*, *Black Oxide* → `PAVONADO` (black oxide finish) |
| `SS` | *Stainless Steel* |
| `CS` | *Carbon Steel* |
| `AS` | *Alloy Steel* |
| `PLAIN`, `SC` | uncoated (*self colour*) — **this is not a finish** |
| `cl.` | *class* (strength class) |
| `A/F` | *across flats* — wrench size |

## 8.3 · EN ↔ ES vocabulary

**The five types** (the ones that must be recognized no matter what):

| English | Spanish | → Catalog |
|---|---|---|
| bolt, screw, hex bolt, cap screw, machine screw | tornillo, perno | `TORNILLO` (bolt) |
| nut, hex nut, heavy hex nut, lock nut, nyloc | tuerca, tuerca autoblocante, contratuerca | `TUERCA` (nut) |
| washer, plain washer, flat washer, hardened washer | arandela, arandela plana, arandela endurecida | `ARANDELA` (washer) |
| stud, stud bolt, double end stud | espárrago, esparrago (no accent), perno prisionero | `ESPARRAGO` (stud) |
| threaded rod, all thread rod, rod | varilla roscada, barra roscada, tija | `VARILLA ROSCADA` (threaded rod) |

**Attributes and parts**

| English | Spanish |
|---|---|
| length | longitud, largo |
| size, diameter | medida, medida nominal, diámetro |
| grade, property class, class | calidad, grado, clase de resistencia |
| standard, specification | norma, especificación |
| finish, coating, plating | acabado, recubrimiento, tratamiento |
| material | material |
| quantity | cantidad |
| thread, pitch | rosca, paso |
| head | cabeza |
| shank | vástago, caña |
| partial thread / full thread | rosca parcial / rosca total |
| hexagon socket | hexágono interior (Allen) |
| flange | brida |
| gasket | junta |
| torque, preload | par de apriete, precarga |
| stainless steel | acero inoxidable |
| carbon steel | acero al carbono |
| alloy steel | acero aleado |
| hot dip galvanized | galvanizado en caliente |
| zinc plated | cincado, zincado |
| black oxide | pavonado |
| phosphated | fosfatado |
| hardened | endurecido, templado |
| quenched and tempered | templado y revenido |

**Nut and bolt subtypes that the catalog collapses** (useful because they must be recognized in
order to discard the subtype, not to lose it):

| Text | Still maps to | Distinguished by |
|---|---|---|
| tornillo Allen, socket head, SHCS | `TORNILLO` (bolt) | DIN 912 / ISO 4762 |
| tornillo avellanado, countersunk, CSK | `TORNILLO` (bolt) | DIN 7991, DIN 963… |
| tornillo hexagonal, hex bolt | `TORNILLO` (bolt) | DIN 931 / 933 |
| prisionero, set screw, grub screw | `TORNILLO` (bolt) | DIN 913 / 916 |
| tuerca autoblocante, nyloc, lock nut | `TUERCA` (nut) | DIN 985 / 982 / 980 |
| tuerca almenada, castle nut | `TUERCA` (nut) | DIN 935 |
| tuerca baja, thin nut, jam nut | `TUERCA` (nut) | DIN 936 |
| tuerca con arandela, flange nut | `TUERCA` (nut) | DIN 6923 / EN 1661 |
| heavy hex nut | `TUERCA` (nut) | ASTM A194 |
| arandela ancha, arandela carrocería | `ARANDELA` (washer) | DIN 9021 / ISO 7093 |
| arandela endurecida, hardened washer | `ARANDELA` (washer) | ASTM F436 |

## 8.4 · Process and procurement terms

To understand the context the system fits into:

| Term | What it is |
|---|---|
| **MTO** | *Material Take-Off*. The list of materials extracted from the drawings |
| **BOM** | *Bill of Materials*. Already-normalized product structure |
| **RFQ** | *Request for Quotation*. Request for an offer sent to suppliers |
| **P&ID** | *Piping & Instrumentation Diagram*. The plant's functional schematic |
| **Isometric** | Shop drawing of a piping run |
| **Spool** | Prefabricated section of piping, the assembly unit |
| **SKU / reference** | The identifier of a purchasable material. The system's output |
| **Approval / qualification** | Approval of a supplier or material by the end client |
| **3.1 Certificate** | Material certificate per EN 10204: composition and tests for the specific
  heat/batch. Mandatory for pressure piping |
| **Heat/batch traceability** | Being able to trace a part back to the steel batch it came from |

The **3.1 certificate** explains why quality and standard cannot be invented: it's not just that it
looks bad on the order, it's that the supplier has to issue a certificate stating exactly that, and
the client's inspector is going to compare it against the drawing.

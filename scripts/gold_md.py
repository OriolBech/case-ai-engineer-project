# -*- coding: utf-8 -*-
import json
from collections import defaultdict
base='/Volumes/develop/obech/sapira/case_ai_engineer_project'
G=[json.loads(l) for l in open(base+'/data/gold/gold.jsonl',encoding='utf-8')]
import sys; sys.path.insert(0,base+'/src')
DESC={
1:'STUD BOLT 7/8" X 130 LG, ASTM A193, GR B7 W/2 HEX. NUT 7/8", ASTM A194, GR 2H, 2 WASHER 7/8", ASTM F436',
2:'BOLT DIN931 M20x90 with NUT DIN934 M20',
3:'Tornillo hexagonal DIN 933 M12 x 50 con tuerca y arandela',
4:'BOLT DIN933 M16x60 with NUT DIN934 and WASHER DIN125, 8.8, zinc plated',
5:'STUD BOLT 1" X 150 LG, ASTM A193, GR B7, W/ 2 NUT ASTM A194, GR 2H, 1 WASHER ASTM F436',
6:'Tornillo DIN 931 M16 x 80 con tuerca DIN 934, 8.8, zincado',
7:'BOLT DIN931 M12x60 A4-70 with NUT DIN934 M12 A4-80',
8:'HEX BOLT M16 x 70 c/w NUT AND WASHER, 8.8, ZN',
9:'Conjunto esparrago M20 x 200 DIN 975 con 2 tuercas DIN 934 y 2 arandelas DIN 125, 8.8, zincado',
10:'Tornillo hexagonal DIN 933 M10 x 40, 8.8, zincado',
11:'Tuerca hexagonal DIN 934 M16, A4-80',
12:'STUD BOLT 3/4" X 110 LG, ASTM A193, GR B7',
13:'Tuerca autoblocante DIN 985 M12, 8.8, zincada',
14:'Arandela plana DIN 125 M10, acero, zincada',
15:'Tornillo Allen cilindrico DIN 912 M10 x 40, 12.9, geomet'}
MARK={"extracted":"","table_normalized":"","exact_catalog":"","not_applicable":"",
      "extracted_uncatalogued":" ᵘ","extrapolated":" ᵉ","derived":" ᵈ","inferred":" ⁱ","absent":""}
def cell(a):
    v=a["value"]
    if v is None: return "—"
    s=str(v)+MARK.get(a["provenance"],"")
    return f"**{s}**" if a["certainty"]=="P" else s
ATTRS=["name","material","quality","measure","length","standard","finish"]
byrow=defaultdict(list)
for l in G: byrow[int(l["rowRef"])].append(l)

out=[]
out.append("""# Gold set · MTO de 15 filas

> Etiquetado a mano el 2026-08-21, **antes de que exista el pipeline**. 15 filas → **30 líneas de
> salida**. Formato máquina en `gold.jsonl`, estadísticas en `gold.stats.json`.

## Cómo leer las tablas

| Marca | Significado |
|---|---|
| `—` | El atributo **no está** en el MTO |
| `N/A` | No aplica: longitud en tuerca o arandela (§7) |
| **negrita** | Celda **dependiente de política** (P-1…P-9), no deducible de las reglas |
| ᵘ | Calidad marcada como tal pero fuera del catálogo (grados ASTM) |
| ᵉ | Extrapolado dentro del set |
| ᵈ | Material derivado de la calidad (P-3) |
| ⁱ | Inferido: unidad de longitud (P-4) o multiplicidad (P-2) |

Todo lo que no está en negrita se deduce de `reglas_tornilleria.md` o del enunciado. Es la parte
del gold sobre la que se calcula el KPI; las celdas en negrita se reportan aparte como análisis de
sensibilidad, porque un KPI que mezcla ambas no es defendible ante un cliente.

---
""")
for r in sorted(byrow):
    ls=byrow[r]
    nres=sum(1 for l in ls if l["status"]=="RESUELTA")
    out.append(f"## Fila {r} — {len(ls)} línea{'s' if len(ls)>1 else ''} · {nres} resuelta{'s' if nres!=1 else ''}, {len(ls)-nres} a revisión\n")
    out.append(f"```\n{DESC[r]}\n```\n")
    out.append("| | Nombre | Material | Calidad | Medida | Longitud | Norma | Acabado | Cant. | Estado |")
    out.append("|---|---|---|---|---|---|---|---|---|---|")
    for l in ls:
        a=l["attributes"]
        st="✅ RESUELTA" if l["status"]=="RESUELTA" else "⚠️ "+", ".join(l["reasons"])
        out.append("| `"+l["id"]+"` | "+" | ".join(cell(a[k]) for k in ATTRS)+" | "+cell(l["quantity"])+" | "+st+" |")
    notes=[l for l in ls if l.get("note")]
    if notes:
        out.append("")
        for l in notes: out.append(f"- `{l['id']}` — {l['note']}")
    out.append("")
open(base+'/data/gold/gold.md','w',encoding='utf-8').write("\n".join(out))
print("gold.md escrito,", len("\n".join(out).split("\n")), "lineas")

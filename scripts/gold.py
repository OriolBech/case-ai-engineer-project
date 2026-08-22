# -*- coding: utf-8 -*-
# Gold set del MTO de 15 filas. Etiquetado a mano, ANTES de que exista el pipeline.
# Cada celda: (valor, procedencia, certeza)  certeza: C=cierta  P=dependiente-de-politica
import json

def A(v,prov,cert="C"): return {"value":v,"provenance":prov,"certainty":cert}
AB  = A(None,"absent")                      # ausente en el MTO
EX  = lambda v: A(v,"extracted")            # tal cual aparece
TB  = lambda v: A(v,"table_normalized")     # via tabla del cliente
UC  = lambda v: A(v,"extracted_uncatalogued")# marcado como calidad, fuera de lista
XP  = lambda v: A(v,"extrapolated")         # medida dentro del set (regla escrita §2)
DV  = lambda v: A(v,"derived","P")          # material desde calidad (P-3)
IF  = lambda v: A(v,"inferred","P")         # multiplicidad no escrita (P-2) / longitud imperial sin unidad (P-4)
MD  = lambda v: A(v,"extracted")            # longitud en designacion metrica ISO (M20x90): la unidad
                                            # la fija la designacion, no es una politica
XPP = lambda v: A(v,"extrapolated","P")     # acabado en set (P-1)
NA  = A("N/A","not_applicable")             # tuerca/arandela: longitud no obligatoria (§7)

def L(i,row,role,name,mat,cal,med,lon,nor,aca,cant,status,reasons,note=""):
    return {"id":f"L{i:03d}","rowRef":str(row),"role":role,"status":status,
            "reasons":reasons,
            "attributes":{"name":name,"material":mat,"quality":cal,"measure":med,
                          "length":lon,"standard":nor,"finish":aca},
            "quantity":cant,"note":note}

R="RESUELTA"; V="REVISION_MANUAL"
G=[
# ---- Fila 1: espárrago + 2 tuercas + 2 arandelas, imperial, ASTM ------------
L(1,1,"principal",EX("ESPARRAGO"),DV("AC"),UC("GR B7"),EX('7/8"'),IF("130 mm"),EX("ASTM A193"),AB,A(40,"extracted"),R,[]),
L(2,1,"secondary",EX("TUERCA"),DV("AC"),UC("GR 2H"),EX('7/8"'),NA,EX("ASTM A194"),AB,A(80,"extracted"),R,[],
  "medida escrita para la tuerca ('HEX. NUT 7/8\"'), no extrapolada"),
L(3,1,"secondary",EX("ARANDELA"),AB,AB,EX('7/8"'),NA,EX("ASTM F436"),AB,A(80,"extracted"),V,["QUALITY_MISSING"],
  "el ejemplo de §2 emite la arandela con calidad '--'; el PDF dice que un elemento sin calidad va a revision. P-7: el sistema manda a revision, la persona decide"),
# ---- Fila 2 ----------------------------------------------------------------
L(4,2,"principal",EX("TORNILLO"),DV("INOX"),TB("A4-70"),EX("M20"),MD("90 mm"),TB("ISO 4014"),AB,A(160,"extracted"),R,[]),
L(5,2,"secondary",EX("TUERCA"),AB,AB,EX("M20"),NA,TB("ISO 4032"),AB,IF(160),V,["QUALITY_MISSING"],
  "el A4-70 de la columna MATERIAL es del principal: la fila 7 lo demuestra (tornillo A4-70 / tuerca A4-80). La calidad no se extrapola"),
# ---- Fila 3 ----------------------------------------------------------------
L(6,3,"principal",EX("TORNILLO"),DV("INOX"),TB("A2"),EX("M12"),MD("50 mm"),TB("ISO 4017"),AB,A(80,"extracted"),R,[]),
L(7,3,"secondary",EX("TUERCA"),AB,AB,XP("M12"),NA,AB,AB,IF(80),V,["QUALITY_MISSING","STANDARD_MISSING"]),
L(8,3,"secondary",EX("ARANDELA"),AB,AB,XP("M12"),NA,AB,AB,IF(80),V,["QUALITY_MISSING","STANDARD_MISSING"]),
# ---- Fila 4: acabado a nivel de fila (P-1) ---------------------------------
L(9,4,"principal",EX("TORNILLO"),DV("AC"),TB("8.8"),EX("M16"),MD("60 mm"),TB("ISO 4017"),TB("CINCADO"),A(100,"extracted"),R,[]),
L(10,4,"secondary",EX("TUERCA"),AB,AB,XP("M16"),NA,TB("ISO 4032"),XPP("CINCADO"),IF(100),V,["QUALITY_MISSING"],
  "robusto a la politica: si el 8.8 se extrapolara a la tuerca seria INCOHERENCIA (P-6) y tambien iria a revision"),
L(11,4,"secondary",EX("ARANDELA"),AB,AB,XP("M16"),NA,TB("ISO 7089"),XPP("CINCADO"),IF(100),V,["QUALITY_MISSING"]),
# ---- Fila 5: multiplicidades distintas por elemento ------------------------
L(12,5,"principal",EX("ESPARRAGO"),DV("AC"),UC("GR B7"),EX('1"'),IF("150 mm"),EX("ASTM A193"),AB,A(24,"extracted"),R,[]),
L(13,5,"secondary",EX("TUERCA"),DV("AC"),UC("GR 2H"),XP('1"'),NA,EX("ASTM A194"),AB,A(48,"extracted"),R,[],"'W/ 2 NUT' -> 24x2"),
L(14,5,"secondary",EX("ARANDELA"),AB,AB,XP('1"'),NA,EX("ASTM F436"),AB,A(24,"extracted"),V,["QUALITY_MISSING"],"'1 WASHER' -> 24x1"),
# ---- Fila 6 ----------------------------------------------------------------
L(15,6,"principal",EX("TORNILLO"),DV("AC"),TB("8.8"),EX("M16"),MD("80 mm"),TB("ISO 4014"),TB("CINCADO"),A(60,"extracted"),R,[]),
L(16,6,"secondary",EX("TUERCA"),AB,AB,XP("M16"),NA,TB("ISO 4032"),XPP("CINCADO"),IF(60),V,["QUALITY_MISSING"]),
# ---- Fila 7: LA fila clave. Cada elemento con su calidad -------------------
L(17,7,"principal",EX("TORNILLO"),DV("INOX"),TB("A4-70"),EX("M12"),MD("60 mm"),TB("ISO 4014"),AB,A(50,"extracted"),R,[]),
L(18,7,"secondary",EX("TUERCA"),DV("INOX"),TB("A4-80"),EX("M12"),NA,TB("ISO 4032"),AB,IF(50),R,[],
  "A4-80 (G4) en tuerca es coherente. Es la fila que prueba que la calidad NO se extrapola"),
# ---- Fila 8: sin norma en ningun elemento ----------------------------------
L(19,8,"principal",EX("TORNILLO"),DV("AC"),TB("8.8"),EX("M16"),MD("70 mm"),AB,TB("CINCADO"),A(75,"extracted"),V,["STANDARD_MISSING"],
  "unica linea que va a revision SOLO por falta de norma (P-5)"),
L(20,8,"secondary",EX("TUERCA"),AB,AB,XP("M16"),NA,AB,XPP("CINCADO"),IF(75),V,["QUALITY_MISSING","STANDARD_MISSING"]),
L(21,8,"secondary",EX("ARANDELA"),AB,AB,XP("M16"),NA,AB,XPP("CINCADO"),IF(75),V,["QUALITY_MISSING","STANDARD_MISSING"]),
# ---- Fila 9: DIN fuera de la tabla de equivalencias ------------------------
L(22,9,"principal",EX("ESPARRAGO"),DV("AC"),TB("8.8"),EX("M20"),MD("200 mm"),EX("DIN 975"),TB("CINCADO"),A(30,"extracted"),R,[],
  "DIN 975 no esta en la tabla de 25: se conserva tal cual (§8)"),
L(23,9,"secondary",EX("TUERCA"),AB,AB,XP("M20"),NA,TB("ISO 4032"),XPP("CINCADO"),A(60,"extracted"),V,["QUALITY_MISSING"]),
L(24,9,"secondary",EX("ARANDELA"),AB,AB,XP("M20"),NA,TB("ISO 7089"),XPP("CINCADO"),A(60,"extracted"),V,["QUALITY_MISSING"]),
# ---- Filas 10-15: elemento unico ------------------------------------------
L(25,10,"principal",EX("TORNILLO"),DV("AC"),TB("8.8"),EX("M10"),MD("40 mm"),TB("ISO 4017"),TB("CINCADO"),A(500,"extracted"),R,[]),
L(26,11,"principal",EX("TUERCA"),DV("INOX"),TB("A4-80"),EX("M16"),NA,TB("ISO 4032"),AB,A(200,"extracted"),R,[]),
L(27,12,"principal",EX("ESPARRAGO"),DV("AC"),UC("GR B7"),EX('3/4"'),IF("110 mm"),EX("ASTM A193"),AB,A(40,"extracted"),R,[],
  "no menciona tuercas -> UNA sola linea. Un set no se completa por convencion"),
L(28,13,"principal",EX("TUERCA"),DV("AC"),TB("8.8"),EX("M12"),NA,TB("ISO 10511"),TB("CINCADO"),A(300,"extracted"),V,["QUALITY_TYPE_INCOHERENCE"],
  "8.8 (G5) en tuerca. NUNCA convertir a 8 (G8): grupos distintos"),
L(29,14,"principal",EX("ARANDELA"),EX("AC"),AB,EX("M10"),NA,TB("ISO 7089"),TB("CINCADO"),A(250,"extracted"),V,["QUALITY_MISSING"],
  "unica fila del MTO con un material REAL escrito ('acero'). Y es justo la que no trae calidad"),
L(30,15,"principal",EX("TORNILLO"),DV("AC"),TB("12.9"),EX("M10"),MD("40 mm"),TB("ISO 4762"),TB("GEOMET"),A(120,"extracted"),R,[]),
]

# ---------- estadisticas ----------
ATTRS=["name","material","quality","measure","length","standard","finish"]
res=[l for l in G if l["status"]==R]; rev=[l for l in G if l["status"]==V]
cells=[(l["id"],k,l["attributes"][k]) for l in G for k in ATTRS]
pol=[c for c in cells if c[2]["certainty"]=="P"]
qpol=[l for l in G if l["quantity"]["certainty"]=="P"]
from collections import Counter
motivos=Counter(r for l in rev for r in l["reasons"])
qm=[l["id"] for l in rev if "QUALITY_MISSING" in l["reasons"]]
sec_qm=[l["id"] for l in rev if "QUALITY_MISSING" in l["reasons"] and l["role"]=="secondary"]

print(f"lineas: {len(G)}  de 15 filas")
print(f"RESUELTA {len(res)} ({100*len(res)/len(G):.0f}%)   REVISION {len(rev)} ({100*len(rev)/len(G):.0f}%)")
print(f"celdas de atributo: {len(cells)}  |  ciertas {len(cells)-len(pol)} ({100*(len(cells)-len(pol))/len(cells):.0f}%)  dependientes de politica {len(pol)} ({100*len(pol)/len(cells):.0f}%)")
print(f"celdas de cantidad dependientes de politica: {len(qpol)}/{len(G)}")
print("motivos:", dict(motivos))
print(f"QUALITY_MISSING: {len(qm)} lineas, de las cuales {len(sec_qm)} son elemento SECUNDARIO de un set")
print("lineas por fila:", dict(Counter(l['rowRef'] for l in G)))
print("politica por atributo:", dict(Counter(k for _,k,_ in pol)))

out="/Volumes/develop/obech/sapira/case_ai_engineer_project/data/gold"
with open(out+"/gold.jsonl","w",encoding="utf-8") as f:
    for l in G: f.write(json.dumps(l,ensure_ascii=False)+"\n")
json.dump({"lines":len(G),"resuelta":len(res),"revision":len(rev),
           "attr_cells":len(cells),"policy_cells":len(pol),
           "reasons":dict(motivos)}, open(out+"/gold.stats.json","w"), indent=2)

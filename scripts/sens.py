import json
G=[json.loads(l) for l in open('/Volumes/develop/obech/sapira/case_ai_engineer_project/data/gold/gold.jsonl',encoding='utf-8')]
R="RESUELTA"; V="REVISION_MANUAL"
base=sum(1 for l in G if l["status"]==R)
def pct(n): return f"{n}/30 ({100*n/30:.0f}%)"
print("base                     ", pct(base))
# P-4 = review : toda linea con longitud inferida va a revision
n=sum(1 for l in G if l["status"]==R and l["attributes"]["length"]["provenance"]=="inferred")
print("P-4 review (long. sin ud)", pct(base-n), f" -{n}")
# P-3 = off : material ausente, NO bloquea -> estado igual
print("P-3 off (material vacio) ", pct(base), "  sin cambio de estado, 17 celdas vacias")
# P-5 = resolve : deja de bloquear la norma ausente
n=sum(1 for l in G if l["status"]==V and l["reasons"]==["STANDARD_MISSING"])
print("P-5 resolve (sin norma)  ", pct(base+n), f" +{n}")
# P-6 = ignore : incoherencia calidad/tipo deja de bloquear
n=sum(1 for l in G if l["status"]==V and l["reasons"]==["QUALITY_TYPE_INCOHERENCE"])
print("P-6 ignore (8.8 en tuerca)", pct(base+n), f" +{n}")
# P-2 = review : multiplicidad no escrita bloquea
n=sum(1 for l in G if l["status"]==R and l["quantity"]["provenance"]=="inferred")
print("P-2 review (multiplicidad)", pct(base-n), f" -{n}")
# P-1 = principal_only : solo cambia celdas de acabado en lineas ya en revision
n=sum(1 for l in G if l["status"]==R and l["attributes"]["finish"]["provenance"]=="extrapolated")
print("P-1 principal_only       ", pct(base-n), f" -{n}  (el acabado extrapolado solo cae en lineas ya en revision)")

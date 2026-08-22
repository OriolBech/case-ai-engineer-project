# Inventario de catalogos desde reglas_tornilleria.md
NOMBRES = ["TORNILLO","TUERCA","ARANDELA","VARILLA ROSCADA","ESPARRAGO"]

GRUPOS = {
 "G1":["A2","A2-70","18-8","304"], "G2":["A2-80"],
 "G3":["A4","A4-70","316"],        "G4":["A4-80"],
 "G5":["8.8","GRADE 5","GRADO 5"], "G6":["10.9","GRADE 8","GRADO 8"],
 "G7":["12.9"], "G8":["8"], "G9":["10"],
 "G10":["100HV"],"G11":["140HV"],"G12":["160HV"],"G13":["200HV"],"G14":["300HV"],
}

DIN_TABLA = ["DIN 84","DIN 440","DIN 603","DIN 912","DIN 913","DIN 916","DIN 931","DIN 933",
 "DIN 934","DIN 935","DIN 936","DIN 960","DIN 961","DIN 963","DIN 965","DIN 980","DIN 982",
 "DIN 985","DIN 6923","DIN 7981 C-H","DIN 7982 C-H","DIN 7985","DIN 7991","DIN 9021","DIN 125"]

ACABADOS = {
 "GEOMET":["GEOMET"], "DACROMET":["DACROMET"],
 "GALVANIZADO EN CALIENTE":["GALVANIZADO EN CALIENTE","HOT DIP GALVANIZED","GALVA","HDG"],
 "CINCADO":["CINCADO","ZINCADO","ZN","ZP","ZINC PLATED"],
 "PAVONADO":["PAVONADO","BL","NEGRO"], "FOSFATADO":["FOSFATADO","PHOSPHATED"],
 "BICROMATADO":["BICROMATADO","YZP","YELLOW ZINC PLATED"],
}
FORMATOS_NORMA = ["DIN","DIN EN","ISO","ASME","ASTM","MSS SP"]

# Lo que ejercitan las 15 filas del MTO dado
u_nombres  = {"ESPARRAGO","TORNILLO","TUERCA","ARANDELA"}
u_calidad  = {"A2","A4-70","A4-80","8.8","12.9"}          # + GR B7 / GR 2H fuera de catalogo
u_din      = {"DIN 931","DIN 933","DIN 934","DIN 125","DIN 985","DIN 912"}  # + DIN 975 (fuera de tabla)
u_acabado  = {"CINCADO","GEOMET"}
u_formatos = {"DIN","ASTM"}
u_unidades = {"imperial puro","metrico puro"}
u_idiomas  = {"ES","EN"}

def pct(a,b): return f"{100*a/b:.0f}%"

print("=== NOMBRES ===")
print("usados", len(u_nombres),"/",len(NOMBRES), pct(len(u_nombres),len(NOMBRES)),
      "| huecos:", sorted(set(NOMBRES)-u_nombres))

vals = [v for g in GRUPOS.values() for v in g]
gr_tocados = {g for g,v in GRUPOS.items() if set(v)&u_calidad}
print("\n=== CALIDAD ===")
print("valores usados", len(u_calidad),"/",len(vals), pct(len(u_calidad),len(vals)))
print("grupos tocados", len(gr_tocados),"/",len(GRUPOS), pct(len(gr_tocados),len(GRUPOS)),
      "->", sorted(gr_tocados, key=lambda x:int(x[1:])))
print("grupos SIN TOCAR:", sorted(set(GRUPOS)-gr_tocados, key=lambda x:int(x[1:])))
print("valores SIN TOCAR:", sorted(set(vals)-u_calidad))
print("¿algun valor usado necesita la tabla de equivalencias?",
      [v for v in u_calidad if any(v in g and len(g)>1 and g[0]!=v for g in GRUPOS.values())] or "NINGUNO")

print("\n=== NORMAS ===")
print("equivalencias DIN usadas", len(u_din),"/",len(DIN_TABLA), pct(len(u_din),len(DIN_TABLA)))
print("SIN TOCAR:", sorted(set(DIN_TABLA)-u_din))
print("formatos sin tocar:", [f for f in FORMATOS_NORMA if f not in u_formatos])

ac_al = [a for v in ACABADOS.values() for a in v]
u_al  = {"ZINC PLATED","ZINCADO","ZN","GEOMET"}
print("\n=== ACABADO ===")
print("valores usados", len(u_acabado),"/",len(ACABADOS), pct(len(u_acabado),len(ACABADOS)),
      "| huecos:", sorted(set(ACABADOS)-u_acabado))
print("alias usados", len(u_al),"/",len(ac_al), "| alias SIN TOCAR:", sorted(set(ac_al)-u_al))

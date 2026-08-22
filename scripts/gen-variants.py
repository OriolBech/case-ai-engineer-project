# -*- coding: utf-8 -*-
"""
Genera variantes del MISMO MTO con formatos de fichero distintos.

Las 15 filas lógicas no cambian: lo que cambia es la forma del Excel, que es la dimensión que el
enunciado señala ("distintas columnas, distintos atributos, distintas abreviaturas, distinto
idioma") y la que el gold set no cubre en absoluto, porque es un único fichero.

Cada variante ataca una heurística concreta de src/pipeline/ingest.ts.
"""
import openpyxl, os, json

BASE = [
 (1,'STUD BOLT 7/8" X 130 LG, ASTM A193, GR B7 W/2 HEX. NUT 7/8", ASTM A194, GR 2H, 2 WASHER 7/8", ASTM F436','ASTM A193 GR B7/A194 GR 2H','7/8" X 130',40),
 (2,'BOLT DIN931 M20x90 with NUT DIN934 M20','A4-70','M20x90',160),
 (3,'Tornillo hexagonal DIN 933 M12 x 50 con tuerca y arandela','A2','M12x50',80),
 (4,'BOLT DIN933 M16x60 with NUT DIN934 and WASHER DIN125, 8.8, zinc plated','8.8','M16x60',100),
 (5,'STUD BOLT 1" X 150 LG, ASTM A193, GR B7, W/ 2 NUT ASTM A194, GR 2H, 1 WASHER ASTM F436','ASTM A193 GR B7','1" X 150',24),
 (6,'Tornillo DIN 931 M16 x 80 con tuerca DIN 934, 8.8, zincado','8.8','M16x80',60),
 (7,'BOLT DIN931 M12x60 A4-70 with NUT DIN934 M12 A4-80','A4-70','M12x60',50),
 (8,'HEX BOLT M16 x 70 c/w NUT AND WASHER, 8.8, ZN','8.8','M16x70',75),
 (9,'Conjunto esparrago M20 x 200 DIN 975 con 2 tuercas DIN 934 y 2 arandelas DIN 125, 8.8, zincado','8.8','M20x200',30),
 (10,'Tornillo hexagonal DIN 933 M10 x 40, 8.8, zincado','8.8','M10x40',500),
 (11,'Tuerca hexagonal DIN 934 M16, A4-80','A4-80','M16',200),
 (12,'STUD BOLT 3/4" X 110 LG, ASTM A193, GR B7','ASTM A193 GR B7','3/4" X 110',40),
 (13,'Tuerca autoblocante DIN 985 M12, 8.8, zincada','8.8','M12',300),
 (14,'Arandela plana DIN 125 M10, acero, zincada','acero','M10',250),
 (15,'Tornillo Allen cilindrico DIN 912 M10 x 40, 12.9, geomet','12.9','M10x40',120),
]
OUT='data/variants'
os.makedirs(OUT, exist_ok=True)
manifest=[]

def save(name, ataca, sheets, expect_qty=True):
    wb=openpyxl.Workbook()
    wb.remove(wb.active)
    for title, rows in sheets:
        ws=wb.create_sheet(title)
        for r in rows: ws.append(r)
    wb.save(f'{OUT}/{name}.xlsx')
    manifest.append({'file':f'{name}.xlsx','ataca':ataca,'expectQuantity':expect_qty})

# V1 control: idéntico al MTO dado
save('v01-control','ninguna (control)', [('MTO',
 [['MTO DE PRUEBA - SETS DE TORNILLERIA'],[],[],
  ['ITEM','DESCRIPCION','MATERIAL','MEDIDA','CANT.','UD']] +
 [[i,d,m,me,c,'uds'] for i,d,m,me,c in BASE])])

# V2 cabeceras en inglés y otro orden: la cantidad NO es la última columna numérica
save('v02-ingles-otro-orden','orden de columnas y detección de cantidad', [('Sheet1',
 [['ITEM','QTY','UNIT','DESCRIPTION','MATERIAL SPEC','SIZE','WEIGHT KG']] +
 [[i,c,'pcs',d,m,me,round(c*0.12,2)] for i,d,m,me,c in BASE])])

# V3 Q'TY (no encaja con mi regex) y sin columna ITEM
save("v03-qty-apostrofo","regex de cantidad (Q'TY) y ausencia de ITEM", [('MTO',
 [['DESCRIPTION',"Q'TY",'UOM','MATL']] +
 [[d,c,'EA',m] for i,d,m,me,c in BASE])], expect_qty=False)

# V4 sin columna de cantidad en absoluto
save('v04-sin-cantidad','ausencia total de cantidad', [('BOM',
 [['POS','DESCRIPCION','MATERIAL','MEDIDA']] +
 [[i,d,m,me] for i,d,m,me,c in BASE])], expect_qty=False)

# V5 descripción partida en dos columnas
save('v05-descripcion-partida','concatenación de todas las celdas de texto', [('MTO',
 [['ITEM','DESCRIPCION','OBSERVACIONES','MATERIAL','MEDIDA','CANT.','UD']] +
 [[i, d.split(',')[0], ','.join(d.split(',')[1:]).strip(), m, me, c,'uds'] for i,d,m,me,c in BASE])])

# V6 columnas de ruido de proyecto, cantidad en medio
save('v06-columnas-ruido','columnas irrelevantes y cantidad no final', [('MTO',
 [['PROYECTO','WBS','REV','ITEM','DESCRIPCION','CANTIDAD','UD','MATERIAL','MEDIDA','PESO']] +
 [['P-2291','2291-PIP-03','C',i,d,c,'uds',m,me,round(c*0.31,2)] for i,d,m,me,c in BASE])])

# V7 bloque de título largo y una columna en blanco por delante
save('v07-titulo-largo','detección de la fila de cabeceras', [('MTO',
 [['CLIENTE: EPC ASTURIANA S.A.'],['OBRA: PLANTA DE TRATAMIENTO'],
  ['DOC: 2291-MTO-TOR-012'],['REV: 12'],['FECHA: 2026-08-01'],[],[],
  [None,'ITEM','DESCRIPCION','MATERIAL','MEDIDA','CANT.','UD']] +
 [[None,i,d,m,me,c,'uds'] for i,d,m,me,c in BASE])])

# V8 los datos están en la SEGUNDA hoja; la primera es una portada
save('v08-segunda-hoja','selección de hoja', [
 ('PORTADA',[['MEMORIA DE MATERIALES'],['Rev 12'],['Ingeniería subcontratada']]),
 ('TORNILLERIA',[['ITEM','DESCRIPCION','MATERIAL','MEDIDA','CANT.','UD']] +
  [[i,d,m,me,c,'uds'] for i,d,m,me,c in BASE])])

# V9 tipos sucios: cantidades como texto con unidad pegada, números como cadena
save('v09-tipos-sucios','lectura de celdas con tipos inconsistentes', [('MTO',
 [['ITEM','DESCRIPCION','MATERIAL','MEDIDA','CANT.','UD']] +
 [[str(i),d,m,me,(f'{c}' if i%2 else f'{c},00'),'uds'] for i,d,m,me,c in BASE])])

# V10 cabeceras en francés (estudio externo)
save('v10-frances','cabeceras en otro idioma', [('Feuille1',
 [['REPÈRE','DÉSIGNATION','MATIÈRE','DIMENSION','QUANTITÉ','UNITÉ']] +
 [[i,d,m,me,c,'pcs'] for i,d,m,me,c in BASE])], expect_qty=False)

json.dump(manifest, open(f'{OUT}/manifest.json','w'), indent=2, ensure_ascii=False)
print(f'{len(manifest)} variantes en {OUT}/')
for m in manifest: print(f"  {m['file']:28} ataca: {m['ataca']}")

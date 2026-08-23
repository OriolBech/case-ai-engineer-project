# Normalización de tornillería desde MTOs · Oriol Bech

## 1. El problema, y el KPI que propongo

Un MTO trae hasta 20.000 filas, un 15–25% de tornillería, y hasta 25 revisiones. Una fila puede
describir **varios materiales** (`STUD BOLT … W/2 HEX. NUT … 2 WASHER`) y los escribe cada estudio de
ingeniería a su manera. A 90 s/fila eso son **100 h por revisión** y **2.500 h por obra**: ~87.500 €.

**Los dos errores no cuestan lo mismo, y eso decide todo el diseño.** Una revisión innecesaria cuesta
90 s = **0,875 €**. Un error silencioso —una línea resuelta con un atributo mal— para un frente de
obra **3–8 semanas**. Con un suelo conservador de 20.000 € para tres semanas:

> **Ratio ≈ 23.000 a 1.** Compensa mandar veintitrés mil líneas a revisión para evitar un error
> silencioso. Una revisión completa son cuatro mil líneas.

A ese ratio, "error silencioso < 2%" no se puede defender: un 2% de 4.000 son **80 errores caros por
revisión**. La única cifra defendible es **cero**, y la única forma de comprometerse a cero no es
acertar más — es **no resolver lo que no se puede justificar**.

**Contra qué mido.** `gold.jsonl`: 15 filas → 30 líneas × **8 celdas** (los 7 atributos y la
cantidad), etiquetadas a mano **antes** de que existiera el pipeline. Cada celda marcada `C` (la
deciden las reglas del cliente) o `P` (depende de una política mía declarada): **211 ciertas / 29 de
política**. Las métricas van sobre las `C`; un KPI que mezcla las dos mide en parte mi opinión.

**Qué mido**, y por qué no vale la precisión a secas:

| Métrica | Definición | Por qué |
|---|---|---|
| **Error silencioso** (primaria) | Líneas `RESUELTA` con ≥1 celda cierta mal · **tasa y recuento** | El error de 3–8 semanas. Va en recuento **además** de tasa porque la tasa sola premia a quien saca líneas buenas del conjunto resuelto |
| **Autonomía útil** | Resueltas **y** correctas / total | Es la que compra horas. Un sistema que manda todo a revisión la tiene a 0 |
| **Split fidelity** | Filas con el nº correcto de líneas · **nunca promediado** | Romper un set no es un atributo mal: es un material que nadie compra |
| **Ruido en cola** | Revisiones que el gold da por resueltas | El fallo invisible: si la cola tiene ruido, el comprador deja de mirarla |

**El compromiso.** Cero errores silenciosos sobre celdas ciertas · autonomía útil **≥45%** · coste
**≤0,001 €/fila leída**. Y el compromiso que de verdad sostiene el primero: **todo caso que ninguna
regla cubra sale señalado, no resuelto** (§2).

**El umbral resuelta/revisión — la decisión más importante — no es un número: es la procedencia más
débil admisible.** Un comprador puede repetir una regla de procedencia en voz alta; con un escalar no
puede discutir. La frontera está en `inferred`: se resuelve lo que está escrito, más lo que las tablas
del cliente dicen que significa, más tres políticas declaradas y conmutables. `absent` no se resuelve
nunca. Una probabilidad calibrada al 99% seguirían siendo 40 errores caros por cada 4.000 líneas.

## 2. La solución, agente a agente

```
Excel → 1 ingest → 2+3 analyze → 4 normalize → 5 validate → 6 critic → UI
        (det.)      (LLM)         (det.)        (det.)       (LLM sel.)
                      ↑ router determinista, 0 llamadas
```

| Etapa | LLM | Por qué existe | Si la quito |
|---|---|---|---|
| 1 ingest | No | Es I/O, y donde entra un MTO de otro estudio | No hay entrada. 2 bugs sólo visibles con otro formato |
| **2+3 analyze** | **Sí** | Delimitar el set y **atribuir** cada valor a su elemento es comprensión, no búsqueda | 15 líneas donde hay 30: el 47% de las filas son multi-material |
| 4 normalize | No | Son 4 tablas cerradas del cliente. Un LLM aquí puede inventar una equivalencia que no está en su tabla | Se paga por un riesgo, sin comprar nada |
| 5 validate | No | Obligaciones, coherencias y las 11 políticas, con motivo tipado | Desaparece la distinción "falta el dato" / "no estoy seguro" |
| 6 critic | Sí | Caza la **atribución** mala: una norma en el campo calidad. El verificador de spans no puede verlo, porque el valor sí está en el texto. A esfuerzo `high` —su propio dial, medido— da **recall 43% / precisión 100%** sobre los errores conocidos | Vuelven hasta 4 errores silenciosos |

**El hallazgo principal no es un modelo: es una frontera.** Tres veces he movido una decisión del
modelo a una tabla, y las tres cerraron un error real:

| Decisión | Valía |
|---|---|
| El **nombre** lo decide `findNames`, no la clasificación del modelo | **13 puntos** de error silencioso |
| La **longitud** dentro de `M16x60` sale de una regex, no de un segundo campo del JSON | 1 línea resoluble por fila |
| La **multiplicidad** la decide la fila (`W/2 HEX. NUT`), no el modelo | 2 líneas con el pedido **multiplicado por el tamaño del pedido** |

Puesto en dinero: la frontera bien puesta en el nombre mueve el coste defendible de **8.750 € a 48 €
por obra**, porque permite usar un modelo abierto que cuesta 176× menos en salida sin perder calidad.

## 3. Resultados, y dónde falla

`openai/gpt-oss-120b` vía OpenRouter, crítico apagado (aquí se mide el extractor):

| | Valor |
|---|---|
| **Error silencioso** | **0%** — 0 de 15 resueltas |
| Autonomía útil | 50,0% |
| Split fidelity | 100% (15/15) |
| Ruido en cola | 0% |
| Celdas ciertas | **211 / 211** · las 29 de política, también |
| Alucinaciones de span | 0 en 79 filas |
| **Coste** | **0,000095 €/fila** → **48 € por obra** (0,05% de los 87.500 € manuales) |
| Latencia | **no se promete**: 6,9 · 44,0 · 64,5 s/fila en tres pasadas idénticas |

**El precio no predice la calidad.** De 8 modelos, el **más barato** iguala a `gpt-5.5` y el de 6 $/M
es el peor (3,3% de autonomía, 62,5% de ruido: el caso degenerado que avisa el enunciado). Ordenado
sólo por error silencioso, el peor sale **primero**; hacen falta las cuatro métricas para que quede
último.

**Dónde falla, dicho antes de que lo digan ellos:**

1. **El split de las filas difíciles es estocástico.** Medido con repeticiones: las multi-elemento
   complicadas se parten mal **≈1 tirada de cada 4**. El recuento de líneas del set sintético es una
   tirada, no una propiedad. Lo que lo hace tolerable es que **no se entrega en silencio**: una tirada
   que colapsó una fila entera salió señalada con cuatro huecos.
2. **30 líneas, y escribí el gold *y* el prompt.** Un punto ciego compartido no lo detecta esta
   medida — y tengo la prueba de que el riesgo es real: la celda de **cantidad** estuvo etiquetada y
   sin compararse, siendo la única donde un error *multiplica* el pedido. Falta el segundo pase ciego,
   que es la cota inferior de la tasa de error humana.
3. **Una medida sola no dice nada.** El crítico daba recall 29% en una pasada; en tres da **14%, 43%
   y 71%** sobre la misma entrada. Estuve a punto de quitar el componente por una muestra. La
   precisión sí se estabilizó al subir su esfuerzo de razonamiento: 100%, medido.

## 4. La solución objetivo

Ordenada por delta de KPI por hora. Las tres primeras salieron de medir, no de imaginar:

| # | Qué | Delta |
|---|---|---|
| 1 | **Filtro determinista antes del modelo.** Una fila sin nombre de catálogo no necesita LLM. Hoy se leen las 20.000 filas para saber cuáles son las 4.000 de tornillería | **5× en coste.** 0 falsos negativos en 79 filas |
| 2 | **Fallar cerrado**: el hueco de política **bloquea** la resolución en lugar de acompañarla | El "100% seguro" pasa a ser estructural, no un aviso |
| 3 | **Identidad de línea estable**, del contenido y no de la columna `ITEM` (que es opcional) | Desbloquea el **diff entre revisiones**, el mayor ahorro del problema |
| 4 | **Las reglas como dato**: vocabulario en dos capas (catálogo del cliente, sólo lectura · nuestros alias, editable) y consola de políticas que **enseña el delta de KPI antes de aprobar** | Cambiar una regla es un cambio auditable, no un despliegue. Medida y longitud quedan fuera del vocabulario a propósito: son gramática |
| 5 | **El front como generador de ground truth**: cada corrección es una etiqueta, y cada sugerencia aprobada una entrada del vocabulario | El primer gold set real del cliente en 3 semanas. Y ataca el **falso no-resuelto**: la fila 63 le pedía a ingeniería una calidad que la fila sí escribía |

## 5. Qué he decidido no hacer

| Qué | Por qué no |
|---|---|
| LLM en la normalización | 4 tablas cerradas y exhaustivas. Es el error de criterio que el case penaliza |
| Fine-tuning sobre las 15 filas | El juicio va contra un blind set. Ajustar contra los datos dados infla el KPI y no compra nada |
| **Implementar la unión de N pasadas del crítico** | La tengo medida (recall 71%, precisión 83%, $0,0045/MTO) pero es **aritmética sobre tres pasadas**, no una ejecución. Entregar código cuyo número no he medido es el error que este proyecto ya pagó tres veces |
| **El filtro determinista** (5× en coste) | Mueve el veredicto de fuera-de-familia del modelo a una tabla: cambia P-9 y merece su medida, no un parche |
| **Gastar la tercera pregunta al cliente** | La candidata (unidad de longitudes imperiales) tiene criterio unilateral defendible, y lo que el rango no separa cae a revisión en vez de resolverse mal. Impacto: 3 celdas de 240 |
| Despliegue, auth, otras familias | El enunciado los excluye o pide profundidad en lugar de superficie |

## 6. Qué rompe esto en producción

**1. La cola se llena de ruido y el comprador deja de mirarla.** El único fallo que destruye el valor
**sin producir un solo error medible**: las métricas siguen verdes y las revisiones se aprueban en
bloque. Ya pasó dos veces en pequeño: una cabecera no reconocida generó 30 líneas con el mismo motivo
(en un MTO real, 4.000), y la primera versión del crítico metía 31,8% de ruido. *Detector*:
`queue_noise` como métrica de primera clase (hoy 0%) y motivos tipados para resolver 300 líneas en una
acción. *Pendiente*: separar en el backlog el hueco de política del split incompleto — hoy salen igual
y son destinatarios distintos.

**2. Deriva silenciosa: otro estudio escribe distinto y nadie se entera.** Las 11 políticas se
escribieron contra el fichero que me dieron, y **un default se dispara en silencio**. *Detector*:
`pnpm run gaps`, determinista, coste 0, sobre el 100% de las filas — no pregunta "¿ha acertado el
modelo?" sino "¿queda algo de la fila sin explicar?". En su primera ejecución encontró un bug del
parser de normas que 88 tests no vieron. *Pendiente*: la tasa de huecos como métrica de producto, con
su curva, que es lo que hace la promesa falsable.

**3. No hay una verdad contra la que medir, porque dos compradores no normalizan igual.** No rompe el
sistema: rompe la capacidad de **saber** si funciona, y hace indetectables los otros dos. Mi propio
gold ya tiene el síntoma. *Pendiente*: el segundo pase ciego. Y que las discrepancias entre
compradores se traten como **decisiones de vocabulario**, no como bugs del modelo: dos personas que
corrigen la misma celda de dos formas no son un problema de precisión, son una regla que la casa nunca
escribió.

# Normalización de tornillería desde MTOs · Oriol Bech

> **La primera excepción se corrige en menos de 90 segundos; la siguiente vez ya forma parte del
> vocabulario común. El modelo interpreta la prosa, pero las reglas del cliente deciden qué se compra.**

## 1. El problema y el compromiso

Un MTO puede traer 20.000 filas y 25 revisiones. Tornillería representa un 15–25%: unas **4.000
filas por revisión**, leídas hoy por seis compradores a **90 segundos por fila**. Son **100 horas
por revisión y 2.500 horas por obra** dedicadas a entender Excel antes de poder comprar.

El problema no es sólo el volumen. Una fila puede contener un set completo —espárrago, dos tuercas
y arandelas— escrito en prosa, con cantidades y especificaciones distintas para cada pieza.

**Los dos errores son asimétricos:**

| Error | Consecuencia | Decisión de producto |
|---|---|---|
| Dar por buena una línea mal interpretada | 3–8 semanas de retraso en obra | **No puede salir en silencio** |
| Mandar una línea correcta a revisión | 90 segundos adicionales | Se acepta, pero se mide para no llenar la cola de ruido |

Por eso no optimizo “accuracy”. Mido **error silencioso** —líneas aprobadas con algún dato cierto
mal—, **tiempo de corrección**, reutilización del vocabulario, autonomía útil y ruido en la cola.
La referencia son las 15 filas entregadas, etiquetadas antes del pipeline: **30 líneas y 240
celdas**, separando reglas del cliente (211) de decisiones de política (29).

**Mi compromiso:** cero errores silenciosos sobre datos decididos por el cliente · corregir una
línea en **≤90 segundos**, desde abrirla hasta guardar la decisión · cada sugerencia aceptada queda
en el vocabulario común y se reaplica a los casos iguales · coste **≤0,0001 €/fila leída**. Una
decisión guardada evita repetir esos 90 segundos en el resto del MTO y en los siguientes. La
autonomía inicial es un resultado, no la promesa: **lo que no está en el MTO no se inventa**.

## 2. La solución, agente a agente

La arquitectura tiene **dos agentes**, no seis. Todo lo que puede resolver una tabla o una regla
queda fuera del modelo.

| Agente | Qué hace y por qué existe | Qué pasa si lo quito |
|---|---|---|
| **A · lector** | Lee una fila de prosa una vez, identifica las piezas del set y atribuye cada dato a la pieza correcta | El lector por reglas sólo cubre con seguridad las **6/15 filas simples**; las 9 multi-material pierden piezas o atribución |
| **B · segunda lectura** | **Activo por defecto**, revisa selectivamente las filas con riesgo de atribución y **sólo puede mandar a revisión**, nunca aprobar | En el gold actual el delta es 0 porque A no falla; sobre 7 errores conocidos reduce los errores a 4, con precisión 100% en la pasada citada |

Después de A, las tablas del cliente deciden nombres, normas, calidades y acabados; las reglas
deciden obligatoriedad, coherencia y estado final. Esta frontera cerró tres fallos reales: confundir
`STUD BOLT`, perder la longitud de `M16x60` y multiplicar mal un pedido por interpretar la cantidad
con el modelo.

El resultado llega a una **UI de comprador**, no a otro Excel: RFQ listas, colas separadas por
destinatario, motivo de revisión y texto original resaltado. Identidad estable y comparación entre
revisiones evitan tratar como nueva una pieza ya comprada en una revisión anterior, sin usar LLM.

Cuando el comprador acepta una sugerencia, el sistema guarda el alias, el valor, la evidencia y el
motivo directamente en el vocabulario. Reaplica la decisión a todos los casos iguales del MTO
abierto y los MTO futuros leen la misma tabla. Una decisión incompatible no sobrescribe la anterior:
debe retirarse explícitamente. **La primera excepción enseña; las siguientes se resuelven con una
tabla, no con memoria del modelo.**

## 3. Resultados y dónde falla

`openai/gpt-oss-120b` vía OpenRouter:

| Resultado | Medido |
|---|---|
| **Error silencioso** | **0%** — 0 errores entre 15 líneas aprobadas |
| **Autonomía útil** | **50%** — 15 de 30 líneas ya no las toca nadie |
| **Ahorro potencial de trabajo** | **~1.250 horas por obra** al 50% de autonomía |
| **Tiempo de corrección** | Objetivo **≤90 s por línea**; falta la prueba cronometrada con comprador |
| **Reutilización del vocabulario** | Aceptar una sugerencia de material/acabado la aplica al resto del MTO y la deja activa para los siguientes |
| Separación de sets / ruido en cola | **100% / 0%** |
| Desglose | Los 7 atributos y la cantidad: **211/211 celdas ciertas correctas** |
| Coste | **0,00024 €/fila → 121 €/obra** con 500.000 lecturas · el **0,14 %** del baseline manual |
| Tiempo para 1.000 filas | Una pasada extrapola a **~62 min serial; ~5 min con concurrencia 12 ideal** (`.env` y valor por defecto). No es SLA: faltan repeticiones |

El **50% no es la promesa ni un límite del modelo**: el 87% de la cola son calidades de tuercas y
arandelas que el MTO no escribe. El valor acumulativo está en que cada excepción decidible se
corrige una vez, queda trazada y puede dejar de consumir 90 segundos en el futuro.

**Filas caídas en la referencia final: ninguna.** Fuera de ella aparecen los límites reales:

1. Algunas filas multi-material difíciles se separan mal en una de cada cuatro tiradas. Un detector
   determinista comprueba que todo lo escrito haya quedado explicado y evita que el fallo sea
   silencioso.
2. Una fila sintética puso la calidad `10` de una tuerca en el campo medida. Pasó confianza y
   evidencia textual; se cerró con una regla, no con más IA.

## 4. La solución objetivo

**Antes de escalar hay que cerrar lo entregado:** cronometrar el flujo ≤90 s; medir el error de las
sugerencias aceptadas; ampliar las sugerencias más allá de material/acabado; y bloquear todos los
huecos reales. Hoy el alta ágil escribe directamente en vocabulario y parte del gobierno sigue
en CLI.

La solución objetivo empieza después: convierte el histórico en gobierno, aprendizaje y predicción.

| Capacidad objetivo | Qué habría que construir | Coste estimado |
|---|---|---|
| **Identidad, roles y auditoría** | Autenticación; vincular corrección, aprobación y promoción a personas, proyecto y revisión; permisos y log inmutable | **3–5 días** |
| **Vocabulario y políticas por proveedor/emisor** | Al cargar el MTO, seleccionar su emisor y fijar la versión: base común + variantes por proveedor, histórico, regresión y rollback; dos alias incompatibles pueden coexistir si su alcance es distinto | **1–2 semanas** |
| **Fine-tuning / LoRA gobernado por evidencia** | Dataset sólo con correcciones aprobadas y sin conflicto; train/validation ciegos, registro de adaptadores, comparación contra baseline y rollback | **2–4 semanas + datos** |
| **Predicción operativa** | Registrar apertura/cierre de revisión, RFQ, pedido y entrega; estimar p50/p90 de revisión y aprovisionamiento por familia/proveedor | **2–3 semanas + histórico** |

El mayor ahorro fuera del KPI de extracción ya está construido: identidad por contenido y diff entre
revisiones para no recomprar en la revisión 12 lo pedido en la 9.

## 5. Qué decidí no hacer

| Decisión | Por qué |
|---|---|
| LLM para normalizar | Son tablas cerradas. Añadiría coste y variabilidad sin comprar capacidad |
| Fine-tuning sobre 15 filas | Inflaría el resultado antes del blind set; no demostraría generalización |
| RL o aprender sin clic humano | El sistema no convierte sus propias predicciones en reglas; una persona acepta cada alta |
| Tres pasadas del segundo agente | La unión calculada mejora recall, pero aún no está implementada y medida como sistema |
| Filtro pre-LLM de última hora | Cambia quién decide que una fila no es tornillería; merece medida propia |
| Despliegue, autenticación y otras familias | El case pide ejecución local y profundidad en una familia |

**Esfuerzo real:** **10–15 h**, por encima de la referencia de 5–10 h. El tiempo adicional se dedicó
a repetir resultados inestables y corregir el sistema de medida, no a ampliar alcance.

## 6. Qué rompe esto en producción

1. **La cola se llena de ruido y el comprador deja de mirarla.** Ya ocurrió: una cabecera desconocida
   generó 30 avisos iguales y la primera segunda-lectura añadió 31,8% de ruido. Se detecta con ruido
   en cola y motivos agrupables; falta alarma por revisión.
2. **Se aplica el vocabulario del proveedor equivocado.** El mismo alias puede significar cosas
   distintas según quién emite el MTO y una tabla global compraría una de ellas en silencio. Cada
   ejecución debe fijar proveedor + versión y resolver variante del emisor → base común; si el
   emisor falta ante un alias específico o hay colisión en su alcance, bloquea y mide el hueco.
3. **Dos compradores no comparten la misma verdad dentro del mismo alcance.** Entre proveedores
   pueden coexistir versiones; dentro del mismo proveedor, correcciones incompatibles son un
   conflicto que no se promedia ni entrena. Falta el segundo etiquetado ciego que acote la tasa
   humana de referencia.

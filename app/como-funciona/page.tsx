/**
 * Página de presentación: "Cómo funciona el sistema".
 *
 * 100% estática — no llama a `/api/*`, no depende de haber procesado ningún MTO. Es la versión
 * front de lo que ya está documentado en `specs/SPEC-00*.md` y `docs/03-policies.md` /
 * `docs/04-architecture.md` / `docs/11-system-behind-the-rules.md`, reescrito para
 * presentarlo a alguien que no va a abrir el repositorio.
 */
import { AppTopbar } from '../components/AppTopbar.tsx';

const STAGES = [
  {
    n: 1,
    title: 'Ingesta',
    llm: false,
    spec: 'SPEC-001',
    summary: 'El Excel/CSV se convierte en texto por fila, literal y con offsets estables.',
    detail:
      'No interpreta nada: localiza la fila de cabeceras, concatena todas las celdas de una fila ' +
      'en un único texto (sourceText) y guarda dónde empieza cada celda. No confía en el nombre de ' +
      'las columnas — el MTO real tiene una columna "MATERIAL" que en realidad contiene la norma o ' +
      'la calidad. Todo lo que viene después referencia estos offsets, así que la app puede señalar ' +
      'el trozo exacto del Excel que justifica cada valor.',
  },
  {
    n: 2,
    title: 'Router de modelo',
    llm: false,
    spec: 'SPEC-002 / SPEC-003',
    summary: 'Tablas deterministas cuentan cuántos materiales distintos menciona la fila.',
    detail:
      'El riesgo que necesita el modelo caro es la atribución: poner un atributo en el elemento ' +
      'equivocado cuando una fila describe varios materiales a la vez (un tornillo con su tuerca y ' +
      'arandelas). Ese riesgo sólo existe si hay más de un elemento — así que el router cuenta ' +
      'nombres de catálogo con las mismas tablas deterministas del baseline, sin gastar ni una ' +
      'llamada al modelo, y decide a qué nivel (barato/fuerte) mandar la fila.',
  },
  {
    n: 3,
    title: 'Split + Extract',
    llm: true,
    spec: 'SPEC-002 + SPEC-003',
    summary: 'Una sola llamada por fila: separa los elementos del set y extrae sus 7 atributos.',
    detail:
      'Decidir que una fila contiene tres materiales y decidir que "ASTM A194, GR 2H" es de la ' +
      'tuerca y no del espárrago es el mismo acto de lectura — separarlo en dos llamadas costaría el ' +
      'triple por el mismo juicio y añadiría un modo de fallo (una mala descomposición que la ' +
      'segunda etapa no puede revisar). Segmentar prosa libre multiidioma con elementos implícitos ' +
      'y localizar 7 atributos en orden libre es comprensión, no lo que resuelve una tabla.',
  },
  {
    n: 4,
    title: 'Vocabulario',
    llm: false,
    spec: 'SPEC-012',
    summary: 'Una sola vista: material y acabado editables; nombre, calidad y norma en solo lectura.',
    detail:
      'El MTO casi nunca escribe el material explícitamente —una vez en treinta líneas—, así que las ' +
      'otras veintinueve hay que deducirlas. La tabla de material decide "A4-70 → INOX", ' +
      '"8.8 → AC"; quien la aplica es la validación (P-3), no la normalización. ' +
      'La de acabado (SPEC-011) traduce alias al catálogo de §9. Las dos son dato ' +
      '(SQLite + log en git), trazables y ampliables desde /vocabulario sin desplegar. Un acabado ' +
      'que la tabla no conoce no se resuelve como "sin acabado": P-12 lo manda a revisión. Nombre, ' +
      'calidad y norma se listan igual, todavía solo lectura: son el catálogo cerrado del cliente.',
  },
  {
    n: 5,
    title: 'Normalización',
    llm: false,
    spec: 'SPEC-004',
    summary: 'Cuatro tablas cerradas — normas, acabados, calidades, nombres — más el material escrito.',
    detail:
      'Equivalencias verbatim de las reglas del cliente (p. ej. DIN 934 → ISO 4032, 25 normas DIN ' +
      'con su equivalente ISO/EN). Deliberadamente sin modelo: son tablas cerradas y exhaustivas, ' +
      'así que meter un LLM aquí sería pagar por token algo que ya resuelve una tabla — el error de ' +
      'criterio que este proyecto evita a propósito. ' +
      'El material también se normaliza aquí, pero sólo cuando la fila lo escribe: "acero" → AC, que ' +
      'es la normalización semántica que pide §4. En el MTO de referencia eso ocurre UNA vez de ' +
      'treinta —la fila 14, "Arandela plana DIN 125 M10, acero, zincada"—, porque el MTO casi nunca ' +
      'escribe el material. Las otras veintinueve lo obtienen derivándolo de la calidad, y eso pasa ' +
      'en la validación y no aquí: necesita el vocabulario y una política que se pueda apagar. Por ' +
      'eso la fila 14 sale con procedencia "extraído" y las demás con "derivado" — no es un matiz de ' +
      'etiqueta, es lo que separa un dato que pone el MTO de uno que decidimos nosotros.',
  },
  {
    n: 6,
    title: 'Validación',
    llm: false,
    spec: 'SPEC-005',
    summary: 'Reglas booleanas: aplica las políticas P-1…P-12 y decide el estado de la línea.',
    detail:
      'Comprueba coherencia calidad/tipo, norma y calidad presentes, plausibilidad de unidades, y ' +
      'aplica el resto de políticas de negocio (ver más abajo). Sin modelo, a propósito: son reglas ' +
      'booleanas, y meter un LLM aquí haría el resultado no reproducible entre ejecuciones del ' +
      'mismo fichero — y el challenge exige poder dar traza y repetir el resultado. ' +
      'Es la primera etapa que ve la FILA ENTERA, y por eso resuelve lo que un elemento aislado no ' +
      'puede: propagar la medida dentro de un set (§2, la única extrapolación que las reglas ' +
      'permiten), decidir a qué elementos alcanza un acabado escrito una sola vez (P-1), y derivar ' +
      'el material de la calidad (P-3): A4-70 → INOX, 8.8 → AC. Esa derivación vive aquí y no en la ' +
      'normalización porque las reglas del cliente no la contienen: es decisión nuestra, consulta el ' +
      'vocabulario y tiene que poder apagarse. Con ella apagada, 29 de las 30 líneas se quedan sin ' +
      'material.',
  },
  {
    n: 7,
    title: 'Estado final',
    llm: false,
    spec: 'SPEC-007 / SPEC-008',
    summary: 'Cada línea sale por uno de tres canales — nunca se mezclan.',
    detail:
      'RESUELTA → lista para RFQ. REVISION_MANUAL → una sola cola "En revisión", tanto si falta un ' +
      'dato en el propio Excel (que acaba siendo de ingeniería, porque ningún comprador rellena un ' +
      'dato que nunca se escribió) como si es baja confianza con el dato presente: para quien revisa ' +
      'el MTO son el mismo gesto —mirar una línea sin resolver—, así que se agrupan y se validan en ' +
      'el mismo sitio. Y la fila que no es tornillería (una brida, una junta) → su propia cola, ' +
      'porque no le falta ningún dato: es de otra familia, y no cuenta en los porcentajes. Aparte de ' +
      'las tres, sin mezclarse con ninguna: un caso que ninguna política cubre abre un "hueco de ' +
      'política" — una decisión que el proyecto debe, no un dato que revisar.',
  },
];

const AGENTS = [
  {
    name: 'Split + extract',
    role: 'Generador: decide elementos y atributos',
    when: 'Siempre, 1 vez por fila',
    calls: '1/fila (2 si el router escala a modelo fuerte)',
    model: 'Barato o fuerte, según el router',
    canPromote: 'No: RESUELTA la decide el validador, no el modelo',
    canDegrade: 'No: el estado no lo toca ninguna llamada al modelo',
    failure: 'Si el proveedor falla, la fila sale como PROCESSING_FAILED; nunca desaparece',
  },
];

const POLICIES = [
  { id: 'P-1', name: 'Alcance del acabado en un set', decision: 'El acabado escrito a nivel de fila alcanza a todos los elementos del set (extrapolado)' },
  { id: 'P-2', name: 'Multiplicidad no escrita', decision: '1 por defecto, 2 para tuercas de espárrago; nunca bloquea, se confirma en el front' },
  { id: 'P-3', name: 'Material no escrito', decision: 'Se deriva de la calidad vía el vocabulario (AC/INOX); sin cobertura, hueco de política' },
  { id: 'P-4', name: 'Longitud sin unidad', decision: 'Métrico sin ambigüedad; imperial por rango de plausibilidad físico, si no encaja va a revisión' },
  { id: 'P-5', name: 'Línea sin norma', decision: 'Va a revisión: sin norma no hay referencia que pedir a un proveedor' },
  { id: 'P-6', name: 'Incoherencia calidad/tipo', decision: 'Va a revisión; nunca se reescribe la especificación en silencio (8.8 ≠ 8)' },
  { id: 'P-7', name: 'Calidad ausente', decision: 'El sistema manda a revisión; la persona decide si crea el elemento sin calidad' },
  { id: 'P-8', name: 'Durezas HV fuera de arandela', decision: 'Se resuelve: las reglas restringen 8/10 a tuercas explícitamente y no dicen nada de HV' },
  { id: 'P-9', name: 'Fila que no es tornillería', decision: 'Cola aparte, "no es tornillería, no lo proceso"; nunca se fuerza al catálogo' },
  { id: 'P-10', name: 'Número desnudo en la medida de un set', decision: 'Se descarta; §2 pone la medida bien formada del hermano' },
  { id: 'P-11', name: 'Valor que P-10 descarta', decision: 'Si es calidad de catálogo y coherente con el tipo, se recupera' },
  { id: 'P-12', name: 'Acabado que el vocabulario no reconoce', decision: 'Va a revisión (UNMAPPED_VALUE); no se exporta como si no llevara acabado' },
  { id: 'P-13', name: 'Calidad que el vocabulario de material no cubre', decision: 'La línea no se resuelve con el material vacío: va a revisión y abre la decisión' },
];

/**
 * Los guardarraíles, que es la pregunta que de verdad hace quien compra.
 *
 * No "¿usáis IA?" sino **"¿qué parte del resultado depende de que el modelo tenga un buen día?"**.
 * La respuesta corta es: una sola llamada por fila, y todo lo que pasa después es tabla o regla.
 * Cada fila de aquí es una restricción que existe en el código y tiene su prueba, no una intención.
 */
const GUARDRAILS = [
  {
    claim: 'El modelo propone; nunca decide el nombre',
    how:
      'La familia la fija la tabla de §3 sobre el término literal de la fila. Si el modelo dice ' +
      'VARILLA ROSCADA donde la fila pone STUD BOLT, sale ESPARRAGO. El modelo pierde.',
    proof: 'analyze.test.ts · «la tabla veta al modelo»',
  },
  {
    claim: 'La cantidad la decide la fila, no el modelo',
    how:
      'La multiplicidad se busca con un escáner sobre el texto (W/2 HEX. NUT, 2 arandelas). Es el ' +
      'único número que MULTIPLICA el pedido, y un modelo llegó a leer la columna de cantidad como ' +
      'multiplicidad: 100 tornillos se convirtieron en 10.000. Ahora manda la fila y la discrepancia ' +
      'se reporta.',
    proof: 'findMultiplicity · 16 casos, incluidas las formas que NO son cantidades',
  },
  {
    claim: 'Ningún valor puede salir si no está escrito en la fila',
    how:
      'Al modelo no se le piden posiciones, se le pide el literal en el que se apoya, y lo buscamos ' +
      'nosotros en el texto. Lo que no aparece en la fila no vino de la fila: se descarta y se cuenta ' +
      'como alucinación. 0 en 79 filas.',
    proof: 'spans.ts · locate()',
  },
  {
    claim: 'El modelo no puede dar por buena una línea',
    how:
      'RESUELTA la decide el validador con reglas booleanas sobre la salida ya normalizada. Ninguna ' +
      'llamada al modelo toca el estado de una línea: el modelo aporta lectura, no veredicto.',
    proof: 'SPEC-005 · validate.ts',
  },
  {
    claim: 'Lo ambiguo es una decisión con nombre, no un valor por defecto',
    how:
      'Cada hueco de las reglas del cliente es una política P-* conmutable por variable de entorno, ' +
      'con su delta medido. Si un caso no lo cubre ninguna, se abre un «hueco de política»: una ' +
      'decisión que el proyecto debe, no un dato que revisar en silencio.',
    proof: 'docs/03-policies.md · la tabla de aquí arriba',
  },
  {
    claim: 'Una fila nunca desaparece',
    how:
      'Si el modelo no devuelve elementos, sale una línea con su motivo. Si el proveedor se cae, sale ' +
      'como PROCESSING_FAILED. El fallo se ve; nunca se convierte en una fila que no estaba.',
    proof: 'validate.ts · «una fila nunca desaparece»',
  },
  {
    claim: 'La caché cubre la llamada al modelo y nada más',
    how:
      'El normalizador y el validador se vuelven a ejecutar siempre. Cambiar una política re-deriva ' +
      'el resultado entero aunque la lectura venga de caché — si no, se estaría midiendo la caché.',
    proof: 'ADR-004',
  },
  {
    claim: 'Corregir a mano no cambia las reglas',
    how:
      'Una corrección es una etiqueta sobre ESA fila, con evidencia literal obligatoria y motivo. El ' +
      'servidor rechaza cualquier evidencia que no esté en la fila palabra por palabra. Convertirla en ' +
      'regla es otro camino, con aprobación y regresión contra el gold.',
    proof: 'SPEC-015',
  },
];

export default function ComoFuncionaPage() {
  return (
    <>
      <AppTopbar />
      <div className="how-page">
      <div className="how-inner">
        <header className="how-head">
          <div className="upload-eyebrow">Reconciliación de MTOs · Tornillería</div>
          <h1>Cómo funciona el sistema</h1>
          <p className="kpi-sub">
            El recorrido de una fila de MTO, de principio a fin: qué decide una tabla, qué decide un
            modelo, y por qué. Siete etapas, y las políticas de negocio que gobiernan lo que las
            reglas del cliente no dejaban claro.
          </p>
          <p className="kpi-note how-lede">
            La pregunta corta, contestada arriba del todo: <strong>de las siete etapas, sólo una
            llama a un modelo</strong>. Una llamada por fila. Todo lo que pasa después —normalizar,
            validar, decidir si la línea se puede pedir— son tablas cerradas y reglas booleanas, así
            que <strong>el mismo Excel da el mismo resultado</strong> y cada dato se puede señalar en
            el texto original. Los guardarraíles están en la sección siguiente.
          </p>
        </header>

        {/* ---- 1. El recorrido de una fila --------------------------------- */}
        <section className="kpi-section">
          <h3>El recorrido de una fila</h3>
          <p className="kpi-note">
            De las 7 etapas, sólo <strong>1 llama a un modelo</strong> (marcada «LLM» abajo). Las
            otras seis son tablas y reglas deterministas — reproducibles, auditables y gratis.
          </p>
          <div className="how-flow">
            {STAGES.map((s, i) => (
              <div className="how-stage-wrap" key={s.n}>
                <details className="how-stage">
                  <summary>
                    <span className="how-stage-n">{s.n}</span>
                    <span className="how-stage-title">{s.title}</span>
                    <span className={`badge how-badge-${s.llm ? 'llm' : 'rules'}`}>
                      {s.llm ? 'LLM' : 'reglas'}
                    </span>
                    <span className="how-stage-spec">{s.spec}</span>
                  </summary>
                  <p className="how-stage-summary">{s.summary}</p>
                  <p className="how-stage-detail">{s.detail}</p>
                </details>
                {i < STAGES.length - 1 && <div className="how-arrow" aria-hidden>↓</div>}
              </div>
            ))}
          </div>
        </section>

        {/* ---- 1b. Guardarraíles -------------------------------------------- */}
        <section className="kpi-section">
          <h3>Qué impide que el modelo se invente algo</h3>
          <p className="kpi-note">
            La pregunta razonable de quien va a firmar una compra no es «¿usáis IA?», es{' '}
            <strong>«¿qué parte del resultado depende de que el modelo tenga un buen día?»</strong>.
            La respuesta es: la lectura de la prosa, y sólo eso. A partir de ahí el modelo entra en un
            embudo de restricciones que no puede saltarse, y cuando choca con una tabla{' '}
            <strong>pierde el modelo</strong>. Cada línea de abajo existe en el código y tiene su
            prueba automática; ninguna es una intención.
          </p>
          <table className="vocab-table">
            <thead>
              <tr><th>Garantía</th><th>Cómo se sostiene</th><th>Dónde se comprueba</th></tr>
            </thead>
            <tbody>
              {GUARDRAILS.map((g) => (
                <tr key={g.claim}>
                  <td><strong>{g.claim}</strong></td>
                  <td>{g.how}</td>
                  <td><code>{g.proof}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="kpi-note">
            Lo que <strong>no</strong> se promete, porque no sería cierto: la lectura de la prosa no
            es determinista. Repetido el mismo fichero, el modelo puede leer una fila de otra manera
            —o el proveedor puede caerse—. Por eso las cifras se miden con la caché apagada y en
            varias pasadas, nunca en una. Y por eso el diseño busca que{' '}
            <strong>la varianza se pague en revisiones de más y nunca en material mal pedido</strong>:
            una fila leída raro se queda sin resolver, que cuesta 90 segundos, en vez de salir
            resuelta y equivocada, que cuesta semanas de obra.
          </p>
        </section>

        {/* ---- 2. Las llamadas al modelo ------------------------------------ */}
        <section className="kpi-section">
          <h3>La llamada al modelo: qué se le pide y qué no</h3>
          <p className="kpi-note">
            Una sola llamada por fila, y hace una sola cosa: <strong>leer la prosa</strong>. Separar
            los elementos de un set y decidir a cuál pertenece cada atributo es el mismo acto de
            lectura, así que partirlo en dos llamadas costaría el triple por el mismo juicio. Lo que
            devuelve entra después por el embudo de arriba: el nombre lo rehace la tabla, la cantidad
            la rehace la fila, y el estado lo decide el validador.
          </p>
          <table className="vocab-table">
            <thead>
              <tr>
                <th>Llamada</th>
                <th>Rol</th>
                <th>Cuándo corre</th>
                <th>Llamadas</th>
                <th>¿Puede promover?</th>
                <th>¿Puede degradar?</th>
              </tr>
            </thead>
            <tbody>
              {AGENTS.map((a) => (
                <tr key={a.name}>
                  <td><strong>{a.name}</strong></td>
                  <td>{a.role}</td>
                  <td>{a.when}</td>
                  <td>{a.calls}</td>
                  <td>{a.canPromote}</td>
                  <td>{a.canDegrade}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="kpi-note how-optional">
            <strong>Hay además una segunda lectura, activable por configuración.</strong> Es un
            crítico: contrasta la salida ya normalizada contra el texto original buscando el fallo
            que las reglas no pueden ver por sí solas —un atributo colocado en el elemento
            equivocado— y por diseño <strong>sólo puede mandar una línea a revisión, nunca
            aprobarla</strong>. Esa asimetría es lo que hace seguro ponerle ahí un modelo barato: su
            peor caso es una revisión de más, jamás una compra mal hecha. Se enciende por MTO con una
            variable de entorno, y tiene su propio banco de medida —recall y precisión sobre una
            salida con errores conocidos— para decidir en qué catálogos compensa pagarla.
          </p>
        </section>

        {/* ---- 3. Las políticas ---------------------------------------------- */}
        <section className="kpi-section">
          <h3>Las políticas: lo que las reglas del cliente no dejaban claro</h3>
          <p className="kpi-note">
            Trece ambigüedades reales del enunciado, cada una con una decisión explícita y
            reversible por variable de entorno — nada se resuelve implícitamente en el código.
          </p>
          <table className="vocab-table">
            <thead>
              <tr><th>Id</th><th>Ambigüedad</th><th>Decisión</th></tr>
            </thead>
            <tbody>
              {POLICIES.map((p) => (
                <tr key={p.id}>
                  <td><code>{p.id}</code></td>
                  <td>{p.name}</td>
                  <td>{p.decision}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* ---- 4. Trazabilidad ------------------------------------------------ */}
        <section className="kpi-section">
          <h3>Trazabilidad: de dónde sale cada dato</h3>
          <p className="kpi-note">
            Cada atributo de cada línea de salida lleva su procedencia, no sólo su valor. Es lo que
            permite mostrar, para cualquier celda, exactamente por qué el sistema escribió lo que
            escribió — un requisito del reto, no un extra.
          </p>
          <ul className="kpi-cant-list">
            <li><strong>extraído</strong> — está literal en el texto de la fila.</li>
            <li><strong>normalizado en tabla</strong> — vino de una equivalencia cerrada (DIN → ISO, calidad → grupo).</li>
            <li><strong>derivado</strong> — el vocabulario de material lo dedujo de la calidad.</li>
            <li><strong>inferido</strong> — una política de negocio lo completó (p. ej. multiplicidad no escrita).</li>
            <li><strong>extrapolado</strong> — se propagó de un elemento del set a otro (p. ej. el acabado).</li>
            <li><strong>literal fuera de catálogo</strong> — está en la fila y ninguna tabla lo reconoce. §5 manda conservarlo tal cual (los grados ASTM: GR B7, GR 2H). El valor es exacto; lo que falta es su equivalencia.</li>
            <li><strong>corregido a mano</strong> — lo cambió una persona, con evidencia literal y motivo. La fuente más fiable de la lista y la que el sistema menos puede explicar, que es justo por qué se marca.</li>
            <li><strong>ausente</strong> — no está, y es un valor válido, no un error.</li>
            <li><strong>no aplica</strong> — la longitud de una tuerca (§7). No es un hueco.</li>
          </ul>
        </section>

        <footer className="how-footer">
          <a className="wf-btn small" href="/vocabulario">Ver el vocabulario de material →</a>
          <a className="wf-btn dark small" href="/">Volver a subir un MTO</a>
        </footer>
      </div>
      </div>
    </>
  );
}

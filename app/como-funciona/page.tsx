/**
 * Página de presentación: "Cómo funciona el sistema".
 *
 * 100% estática — no llama a `/api/*`, no depende de haber procesado ningún MTO. Es la versión
 * front de lo que ya está documentado en `specs/SPEC-00*.md` y `docs/03-policies.md` /
 * `docs/04-architecture.md` / `docs/12-system-behind-the-rules.md`, reescrito para
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
      'El MTO casi nunca escribe el material explícitamente. La tabla de material decide "A4-70 → INOX", ' +
      '"8.8 → AC". La de acabado (SPEC-011) traduce alias al catálogo de §9. Las dos son dato ' +
      '(SQLite + log en git), trazables y ampliables desde /vocabulario sin desplegar. Un acabado ' +
      'que la tabla no conoce no se resuelve como "sin acabado": P-12 lo manda a revisión. Nombre, ' +
      'calidad y norma se listan igual, todavía solo lectura: son el catálogo cerrado del cliente.',
  },
  {
    n: 5,
    title: 'Normalización',
    llm: false,
    spec: 'SPEC-004',
    summary: 'Cuatro tablas cerradas y exhaustivas: normas, acabados, calidades, nombres.',
    detail:
      'Equivalencias verbatim de las reglas del cliente (p. ej. DIN 934 → ISO 4032, 25 normas DIN ' +
      'con su equivalente ISO/EN). Deliberadamente sin modelo: son tablas cerradas y exhaustivas, ' +
      'así que meter un LLM aquí sería pagar por token algo que ya resuelve una tabla — el error de ' +
      'criterio que este proyecto evita a propósito.',
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
      'mismo fichero — y el challenge exige poder dar traza y repetir el resultado.',
  },
  {
    n: 7,
    title: 'Crítico',
    llm: true,
    spec: 'SPEC-006',
    summary: 'Segunda opinión, sólo en filas de riesgo, y sólo puede degradar — nunca promover.',
    detail:
      'Corre exclusivamente sobre filas con más de un elemento y evidencia débil (en el MTO de ' +
      'referencia, 9 de 15 filas) — no por un score de confianza, que resultó no separar nada útil. ' +
      'Compara la salida ya normalizada contra el texto original buscando tres cosas: material sin ' +
      'colocar, atributo en el elemento equivocado, cantidad que contradice la prosa. Si discrepa, ' +
      'la línea baja a revisión con el motivo. Nunca puede subir una línea de revisión a resuelta: ' +
      'ese diseño asimétrico es lo que hace seguro usar un modelo barato aquí. Y si esta segunda ' +
      'lectura falla, la línea sale igual pero se dice cuál: una comprobación que desaparece sin ' +
      'avisar es peor que no tenerla, porque el número de la pantalla no se mueve.',
  },
  {
    n: 8,
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
    name: 'Agente A · split + extract',
    role: 'Generador: decide elementos y atributos',
    when: 'Siempre, 1 vez por fila',
    calls: '1/fila (2 si el router escala a modelo fuerte)',
    model: 'Barato o fuerte, según el router',
    canPromote: 'N/A — es el único que genera',
    canDegrade: 'N/A',
    failure: 'Línea mal generada; no tiene red de seguridad propia',
  },
  {
    name: 'Agente B · crítico',
    role: 'Verificador: sólo compara salida contra texto fuente',
    when: 'Selectivo: filas multi-elemento con evidencia débil',
    calls: '1/fila hoy (repetir 2-3 veces y unir está evaluado, no implementado)',
    model: 'Siempre el más barato',
    canPromote: 'No, nunca — invariante con test',
    canDegrade: 'Sí, es su única función',
    failure: 'Si el proveedor falla, se mantiene el veredicto de las reglas; nunca tumba el pipeline',
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
            modelo, y por qué. Ocho etapas, dos agentes de IA, y las políticas de negocio que
            gobiernan lo que las reglas del cliente no dejaban claro.
          </p>
        </header>

        {/* ---- 1. El recorrido de una fila --------------------------------- */}
        <section className="kpi-section">
          <h3>El recorrido de una fila</h3>
          <p className="kpi-note">
            De las 8 etapas, sólo <strong>2 llaman a un modelo</strong> (marcadas «LLM» abajo). El
            resto son tablas y reglas deterministas — reproducibles, auditables y gratis.
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

        {/* ---- 2. Las llamadas al modelo ------------------------------------ */}
        <section className="kpi-section">
          <h3>Las llamadas al modelo: los dos agentes</h3>
          <p className="kpi-note">
            Un generador y un verificador, deliberadamente separados: el que genera tiene toda la
            información pero también todo el sesgo; el que verifica no ve el problema desde cero,
            sólo pregunta "¿esto contradice la fuente?" — sesgado a refutar, y sólo puede empeorar el
            resultado, nunca mejorarlo de más.
          </p>
          <table className="vocab-table">
            <thead>
              <tr>
                <th>Agente</th>
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
        </section>

        {/* ---- 3. Las políticas ---------------------------------------------- */}
        <section className="kpi-section">
          <h3>Las políticas: lo que las reglas del cliente no dejaban claro</h3>
          <p className="kpi-note">
            Nueve ambigüedades reales del enunciado, cada una con una decisión explícita y
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
            <li><strong>ausente</strong> — no está, y es un valor válido, no un error.</li>
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

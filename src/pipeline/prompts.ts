/**
 * Prompts for the analyze agent. Written in Spanish on purpose: the client's rules, the catalogue
 * values and half the MTO are Spanish, and translating the domain into English would introduce
 * drift in exactly the terms that have to come out verbatim.
 *
 * What is deliberately NOT in this prompt: the equivalence tables (quality groups, DIN->ISO,
 * finish aliases). Those are deterministic and belong to stage 4. Putting them here would invite
 * the model to normalize, and a model that normalizes can invent an equivalence that is not in the
 * client's table — see specs/SPEC-004-normalizer.md.
 */

export const ANALYZE_SYSTEM = `Eres un extractor de líneas de tornillería a partir de filas de un MTO (Material Take-Off) de una
empresa de ingeniería y construcción. Trabajas para el departamento de compras.

Tu única tarea es DELIMITAR y EXTRAER. No normalizas, no traduces, no deduces.

## 1. Una fila puede describir varios materiales

Una fila puede describir un SET funcional: un tornillo o espárrago, su tuerca o sus dos tuercas, y
sus arandelas. Cada elemento es un material distinto que se compra por separado, así que devuelves
un elemento por cada material mencionado.

Reglas duras:
- NO completes sets por convención. Si la fila describe un espárrago y no menciona tuercas,
  devuelves UN elemento. Nunca añadas un elemento que la fila no menciona.
- Marca como "principal" el elemento que la fila describe primero y con más detalle. El resto son
  "secondary".
- Los tipos posibles son exactamente cinco: TORNILLO, TUERCA, ARANDELA, VARILLA ROSCADA, ESPARRAGO.
  No hay subtipos: un tornillo Allen y un tornillo hexagonal son los dos TORNILLO; una tuerca
  autoblocante es TUERCA. Si un término no encaja en ninguno de los cinco, deja normalizedName a
  null y pon el término en detectedName.

## 2. Extraes lo que aparece, nunca lo más probable

Para cada elemento extraes seis atributos. Si el atributo NO aparece escrito PARA ESE ELEMENTO,
devuelves null. Esto es lo más importante de tu trabajo:

- NO copies un atributo de un elemento a otro. Si el tornillo dice A4-70 y la tuerca no dice nada,
  la calidad de la tuerca es null. Un set puede llevar tornillo A4-70 y tuerca A4-80.
- NO copies la medida de un elemento a otro, ni siquiera cuando es obvio. Otro proceso posterior se
  encarga de eso; tú devuelves null.
- NO normalices. Si la fila dice "zincado", devuelves "zincado", no "CINCADO". Si dice "DIN931",
  devuelves "DIN931", no "ISO 4014".
- NO inventes unidades. Si la longitud viene como "130" sin unidad, devuelves "130".

Los seis atributos:

| Atributo | Qué es | Ejemplos |
|---|---|---|
| material | El METAL escrito explícitamente | acero, STEEL, INOX, acero inoxidable |
| quality | Calidad o grado, sólo si está marcado como tal | 8.8, A2, A4-70, A4-80, 304, 316, 18-8, GR B7, GR 2H, 200HV, 45H |

Cuidado con esta confusión: A2, A4, A2-70, A4-70, A2-80, A4-80, 304, 316 y 18-8 son CALIDADES, no
materiales, aunque designen acero inoxidable. Van en quality. El material sólo se rellena cuando la
fila escribe el metal con sus palabras ("acero", "STEEL", "INOX").
| measure | Diámetro nominal | M20, 7/8", 1/2" |
| length | Longitud, con unidad si la trae | 90, 130, 40 mm, 2" |
| standard | Norma | DIN 931, DIN931, ISO 4032, ASTM A193, ASME B18.2.1, MSS SP-97, DIN EN 14399-4 |
| finish | Acabado o recubrimiento | zincado, zinc plated, ZN, HDG, geomet, YZP, BL |

Aviso importante sobre la columna MATERIAL: en estos MTO la columna que se llama MATERIAL casi
nunca contiene un material. Contiene la calidad (8.8, A4-70) o la norma con su grado
(ASTM A193 GR B7). El nombre de la columna no es el atributo: mira el valor, no la cabecera. Y ese
valor pertenece al elemento PRINCIPAL, no a todos los elementos de la fila.

Si no sabes si un valor está marcado como calidad, no lo extraigas.

## 3. Cantidades

Extrae la multiplicidad de cada elemento SÓLO si está escrita: "W/2 HEX. NUT" son 2 tuercas por
espárrago, "2 arandelas" son 2 arandelas. Si la fila dice sólo "with NUT" o "con tuerca", la
multiplicidad no está escrita: pon multiplicity 1 y multiplicityStated en false. No la inventes.

## 4. Evidencia literal

Cada valor que devuelves va acompañado de "evidence": el fragmento de texto LITERAL Y EXACTO de la
fila del que sale, copiado carácter a carácter. Si no puedes copiar un fragmento literal que lo
justifique, el valor es null. La evidencia se verifica automáticamente contra la fila original.

## 5. Filas que no son tornillería

Si la fila describe algo que no es tornillería (una brida, una junta, un tubo, una válvula), pon
outOfFamily en true y devuelve elements vacío. No fuerces una brida a ser un TORNILLO.`;

export function analyzeUser(sourceText: string, itemRef: string): string {
  return `Fila ${itemRef} del MTO. El texto es la concatenación de las celdas con " | " entre ellas:

${sourceText}`;
}

/** JSON Schema for strict structured output. Every property is required; optionals are nullable. */
const attr = {
  type: 'object',
  additionalProperties: false,
  required: ['value', 'evidence'],
  properties: {
    value: { type: ['string', 'null'], description: 'El valor tal como aparece, sin normalizar' },
    evidence: { type: ['string', 'null'], description: 'Fragmento literal y exacto de la fila' },
  },
} as const;

export const ANALYZE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['outOfFamily', 'outOfFamilyReason', 'elements'],
  properties: {
    outOfFamily: { type: 'boolean' },
    outOfFamilyReason: { type: ['string', 'null'] },
    elements: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'detectedName', 'normalizedName', 'role', 'evidence',
          'multiplicity', 'multiplicityStated', 'attributes',
        ],
        properties: {
          detectedName: { type: 'string' },
          normalizedName: {
            type: ['string', 'null'],
            enum: ['TORNILLO', 'TUERCA', 'ARANDELA', 'VARILLA ROSCADA', 'ESPARRAGO', null],
          },
          role: { type: 'string', enum: ['principal', 'secondary'] },
          evidence: { type: 'string' },
          multiplicity: { type: 'integer', minimum: 1 },
          multiplicityStated: { type: 'boolean' },
          attributes: {
            type: 'object',
            additionalProperties: false,
            required: ['material', 'quality', 'measure', 'length', 'standard', 'finish'],
            properties: {
              material: attr, quality: attr, measure: attr,
              length: attr, standard: attr, finish: attr,
            },
          },
        },
      },
    },
  },
} as Record<string, unknown>;

/** projectId por defecto: nombre del fichero sin extensión. SPEC-014. */
export function projectIdFromFileName(fileName: string): string {
  const i = fileName.lastIndexOf('.');
  return i > 0 ? fileName.slice(0, i) : fileName;
}

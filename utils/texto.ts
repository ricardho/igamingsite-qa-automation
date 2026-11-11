/** Escapa caracteres especiais para montar uma RegExp literal a partir de texto livre. */
export function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

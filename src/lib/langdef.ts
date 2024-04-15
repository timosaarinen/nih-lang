const keywords = new Set([
  'do', 'for', 'fun', 'if', 'return', 'while'
]);

export function isKeyword(s: string): boolean {
  return keywords.has(s);
}

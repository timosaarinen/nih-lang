export const isLetter = (char: string) => /[a-zA-Z_]/.test(char);
export const isDigit = (char: string) => /[0-9]/.test(char);

export function stripNewlines(str: string): string {
  return str.replace(/\r?\n|\r/g, "");
}

export function skipToNextLine(str: string, index: number): number {
  while(str[index++] !== '\n') {
    if (index >= str.length) return str.length; // eof
  }
  if (str[index] === '\r') index++;
  return index;
}

export function parseName(src: string, index: number) {
  let start = index;
  index++;
  while (isLetter(src[index]) || isDigit(src[index])) {
    index++;
  }
  const value = src.slice(start, index);
  return [value, start, index];
}

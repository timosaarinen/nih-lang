export function stripNewlines(str: string): string {
  return str.replace(/\r?\n|\r/g, "");
}

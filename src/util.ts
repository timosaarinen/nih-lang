export const isLetter = (char: string) => /[a-zA-Z_]/.test(char);
export const isDigit = (char: string) => /[0-9]/.test(char);

//------------------------------------------------------------------------
export function fmt(...args: any[]): any {
  return args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
}

export function errorbox(...args: any[]) {
  let text = fmt(args);
  console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
  console.log('');
  console.log(text);
  console.log();
  console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
  return text;
}

export function error(...args: any[]): any {
  throw new Error(errorbox(args));
}

export function assert(shouldbetrue: boolean, msg?: string): any {
  if (!shouldbetrue) {
    msg = 'Assertion failed: ' + (msg ?? '');
    throw new Error(msg);
  }
  return null;
}

// global log and grouped log (must be enabled)
export let log_groups = new Map<string, boolean>();
export function log(...args: any[]): any                          { console.log(...args); } // console.log(fmt(args));
export function glog(group: string, ...args: any[]): any          { if (log_groups.get(group)) console.log(...args); } // console.log(fmt(args));
export function glogenable(group: string, state: boolean = true)  { log_groups.set(group, state); }

// Match source (code) string at given index to the target string (which can contain spaces).
// @returns null if not match or the index after the string (at next character)
export function strmatch(target: string, source: string, startIndex: number): number | null {
  if (source.substring(startIndex, startIndex + target.length) === target) {
    return startIndex + target.length;
  }
  return null;
}

export function stripNewlines(str: string): string {
  throw new Error("TODO: stripNewLines"); //return str.replace(/\r?\n|\r/g, "");
}

export function nextLineStart(str: string, index: number): number {
  while(str[index++] !== '\n' && str[index++] !== '\r') {
    if (index >= str.length) return str.length; // eof
  }
  if (str[index] === '\n' || str[index] === '\r') index++;
  return index;
}

export function strToEndOfLine(str: string, index: number) {
  const end = nextLineStart(str, index);
  while (str[index] == '\r' || str[index] == '\n') index--;
  return str.substring(index, end);
}

export function parseName(src: string, index: number): [string, number, number] {
  let start = index;
  index++;
  while (isLetter(src[index]) || isDigit(src[index])) {
    index++;
  }
  const value: string = src.slice(start, index);
  return [value, start, index];
}

export function json(o: any): string {
  return JSON.stringify(o);
}

import { execSync } from 'child_process';

describe('nih.ts output', () => {
  it('outputs the correct string', () => {
    const expectedOutput = "NIH language (.ni) to/from NIH S-expression (.nih) compiler";
    const output = execSync(`node dist/ni.js`).toString().trim();
    expect(output).toEqual(expectedOutput);
  });
});

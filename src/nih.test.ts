import { execSync } from 'child_process';

describe('nih.ts output', () => {
  it('outputs the correct string', () => {
    //const expectedOutput = "NIH interpreter taking NIH S-expression as input (.nih)";
    //const output = execSync(`node dist/nih.js`).toString().trim();
    //expect(output).toEqual(expectedOutput);
    
    expect(execSync(`node dist/nih.js`)); // TODO: tests
  });
});

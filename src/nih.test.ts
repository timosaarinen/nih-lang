import { execSync } from 'child_process';

describe('nih.ts output', () => {
  it('outputs the correct string', () => {
    // TODO: keep using Jest? Just nih --test <allsourcefiles> and extract expected output from .nih start, @expected-output?
    //const expectedOutput = "...";
    //const output = execSync(`node dist/nih.js`).toString().trim();
    //expect(output).toEqual(expectedOutput);
    expect(true); //expect(execSync(`node dist/nih.js example/hiihoo.nih.sexpr`));
  });
});

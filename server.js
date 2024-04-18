import express from 'express';
import { execSync } from 'child_process';

const app = express();
const port = 3000;

app.use(express.json());

app.post('/compile', (req, res) => {
  const { code } = req.body;

  // Run NIH and capture stdout/stderr
  //  TODO: Could also run client-side, so no server req?
  //execSync(`echo "${code}" | nih --stdin`, (error, stdout, stderr) => {
  execSync(`echo "${code}"`, (error, stdout, stderr) => {
    if (error) {
      console.error(`exec error: ${error}`);
      return res.send({ output: `Error: ${stderr}` });
    }
    res.send({ output: stdout });
  });
});

app.use(express.static('public'));
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

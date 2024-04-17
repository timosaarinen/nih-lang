import express from 'express'; 

const app = express();
const port = 3000;

app.use(express.json());

app.post('/compile', (req, res) => {
  const { code } = req.body;
  // Here, run your interpreter and capture stdout and stderr
  const exec = require('child_process').exec;
  exec(`echo "${code}" | mylang-interpreter`, (error, stdout, stderr) => {
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

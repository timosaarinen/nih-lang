const initialCode = `
// Start typing your code here
print 'Hello, world!'`;

//------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', function() {

  const editor = CodeMirror(document.getElementById('editor'), {
      mode: 'javascript',
      theme: 'dracula',
      lineNumbers: true,
      value: initialCode
  });
  editor.setSize("100%", "100%");

  editor.on('change', function() {
      fetch('/compile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: editor.getValue() })
      })
      .then(response => response.json())
      .then(data => {
          document.getElementById('output').textContent = data.output;
      })
      .catch(error => {
          document.getElementById('output').textContent = 'Error: ' + error;
      });
  });
});

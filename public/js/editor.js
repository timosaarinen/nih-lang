// document.addEventListener('DOMContentLoaded', function() {
//   const editor = CodeMirror.fromTextArea(document.getElementById('code'), {
//     mode: 'your-language-mode', // define this if custom
//     lineNumbers: true
//   });
//
//   editor.on('change', function() {
//     // Fetch and display compilation output on each change
//     fetch('/compile', {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({ code: editor.getValue() })
//     })
//     .then(response => response.json())
//     .then(data => {
//       document.getElementById('output').textContent = data.output;
//     });
//   });
// });

// --------------------

// document.addEventListener('DOMContentLoaded', function() {
//   const editor = CodeMirror(document.getElementById('editor'), {
//       mode: 'javascript',  // Change this to your custom mode if you have one
//       theme: 'dracula',
//       lineNumbers: true
//   });

//   editor.setSize("100%", "100%");

//   editor.on('change', function() {
//       fetch('/compile', {
//           method: 'POST',
//           headers: { 'Content-Type': 'application/json' },
//           body: JSON.stringify({ code: editor.getValue() })
//       })
//       .then(response => response.json())
//       .then(data => {
//           document.getElementById('output').textContent = data.output;
//       })
//       .catch(error => {
//           document.getElementById('output').textContent = 'Error: ' + error;
//       });
//   });
// });

document.addEventListener('DOMContentLoaded', function() {
  const initialCode = `// Start typing your code here
print 'Hello, world!'`;

  const editor = CodeMirror(document.getElementById('editor'), {
      mode: 'javascript',  // Change this to your custom mode if you have one
      theme: 'dracula',
      lineNumbers: true,
      value: initialCode // Set the initial content of the editor
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

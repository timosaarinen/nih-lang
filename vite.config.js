import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  // Define the base public path if necessary, if not, it defaults to '/'
  base: './',
  // Set the server root as the public directory
  root: path.resolve(__dirname, 'public'),
  server: {
    // Specifies the server should watch files in the project
    watch: {
      // Watch for changes in specific directories/files
      include: [path.resolve(__dirname, 'public/js/**/*.js')]
    }
  },
  // Configuring where to output built files when `vite build` is run
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true, // Empties the output directory on build
    rollupOptions: {
      // Ensures Vite handles input from the specific js file for bundling if necessary
      input: path.resolve(__dirname, 'public/js/editor.js')
    }
  }
});

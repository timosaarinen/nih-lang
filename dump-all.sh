#!/bin/bash

# Specified root files to include, explicitly excluding 'package-lock.json'
files=(".editorconfig" ".eslintrc.mjs" ".gitignore" "jest.config.mjs" "package.json" "tsconfig.json")

# Print each specified root file with its name
for file in "${files[@]}"; do
    if [ -e "$file" ]; then
        echo "=== $file ===" # Unified file marker
        cat "$file"
        echo # Empty line for readability
    fi
done

# Handle all files in the src/ directory
for srcfile in src/*; do
    echo "=== $srcfile ===" # Unified file marker
    cat "$srcfile"
    echo # Empty line for readability
done

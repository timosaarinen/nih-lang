#/bin/bash

# TODO: dumps a LOT of information..
#tsc --outDir dist --explainfiles --listFiles --listEmittedFiles --pretty
tsc --outDir dist --pretty

# Copy our 'nih' command (bash script) to dist
cp ./nih dist

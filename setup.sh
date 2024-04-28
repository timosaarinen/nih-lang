#/bin/bash
#
# To get PATH actually remain changed, remember to run with: 
#   source setup.sh
#
# TODO: for now, copies Nih to ~/nih-1.0.0

# Compile
echo "Building NIH.."
bash ./build-dist.sh

# Deploy
echo "Deploying to ~/nih-1.0.0.."
mkdir ~/nih-1.0.0
cp -R ./dist/* ~/nih-1.0.0

# Add 'nih' to PATH
echo "Adding 'nih' to PATH.."
export PATH="$PATH:~/nih"
echo "Your PATH is now: " $PATH
echo "If you ran this with 'source setup.sh' you should now be able to write and run 'nih'!"

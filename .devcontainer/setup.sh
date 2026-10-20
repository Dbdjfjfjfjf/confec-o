#!/usr/bin/env bash
set -e

# Java 17 (exigido pelo cordova-android atual) e Gradle via SDKMAN ------   FEITO
source "$HOME/.sdkman/bin/sdkman-init.sh"
sdk install java 17.0.12-tem < /dev/null || true   # se falhar: sdk list java
sdk default java 17.0.12-tem
sdk install gradle < /dev/null

# Android command-line tools
export ANDROID_HOME=$HOME/android-sdk
mkdir -p $ANDROID_HOME/cmdline-tools
cd /tmp
curl -fsSL -o cmdtools.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
unzip -q -o cmdtools.zip -d $ANDROID_HOME/cmdline-tools
rm -rf $ANDROID_HOME/cmdline-tools/latest
mv $ANDROID_HOME/cmdline-tools/cmdline-tools $ANDROID_HOME/cmdline-tools/latest

cat >> ~/.bashrc <<'EOF'
export ANDROID_HOME=$HOME/android-sdk
export ANDROID_SDK_ROOT=$ANDROID_HOME
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools
EOF
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin

yes | sdkmanager --licenses > /dev/null
sdkmanager "platform-tools" "platforms;android-35" "platforms;android-34" \
           "build-tools;35.0.0" "build-tools;34.0.0"

# Cordova
npm install -g cordova

echo "Pronto. Abra um terminal novo e rode: cordova requirements"
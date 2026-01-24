#!/bin/bash

# Build script for Linux
echo "Building Caspian for Linux..."

# Check if we're on Linux
if [[ "$OSTYPE" != "linux-gnu"* ]]; then
    echo "Warning: You're not on Linux. Cross-compilation may not work as expected."
fi

# Check for required system dependencies
echo "Checking system dependencies..."
MISSING_DEPS=()

# Check for essential build tools
if ! command -v pkg-config &> /dev/null; then
    MISSING_DEPS+=("pkg-config")
fi

if ! command -v gcc &> /dev/null && ! command -v clang &> /dev/null; then
    MISSING_DEPS+=("build-essential")
fi

# Check for WebKit2GTK
if ! pkg-config --exists webkit2gtk-4.1; then
    MISSING_DEPS+=("libwebkit2gtk-4.1-dev")
fi

# Check for other required libraries
if ! pkg-config --exists gtk+-3.0; then
    MISSING_DEPS+=("libgtk-3-dev")
fi

if ! pkg-config --exists openssl; then
    MISSING_DEPS+=("libssl-dev")
fi

if [ ${#MISSING_DEPS[@]} -ne 0 ]; then
    echo "Missing system dependencies. Please install:"
    echo "sudo apt update && sudo apt install -y ${MISSING_DEPS[*]}"
    exit 1
fi

echo "All system dependencies found."

# Install Node.js dependencies
echo "Installing Node.js dependencies..."
npm install

# Build the application
echo "Building Caspian for Linux..."
npm run tauri:build:linux

if [ $? -eq 0 ]; then
    echo "Build complete! Check src-tauri/target/release/bundle/ for output files."
    echo ""
    echo "Available packages:"
    ls -la src-tauri/target/release/bundle/deb/ 2>/dev/null || echo "  No .deb packages found"
    ls -la src-tauri/target/release/bundle/appimage/ 2>/dev/null || echo "  No AppImage found"
else
    echo "Build failed. Check the output above for errors."
    exit 1
fi
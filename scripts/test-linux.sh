#!/bin/bash

# Test script for Linux functionality
echo "Testing Caspian Linux functionality..."

# Check system dependencies
echo "Checking system dependencies..."
MISSING_DEPS=()

if ! command -v pkg-config &> /dev/null; then
    MISSING_DEPS+=("pkg-config")
fi

if ! command -v gcc &> /dev/null && ! command -v clang &> /dev/null; then
    MISSING_DEPS+=("build-essential")
fi

if ! pkg-config --exists webkit2gtk-4.1; then
    MISSING_DEPS+=("libwebkit2gtk-4.1-dev")
fi

if [ ${#MISSING_DEPS[@]} -ne 0 ]; then
    echo "❌ Missing system dependencies: ${MISSING_DEPS[*]}"
    echo "Install with: sudo apt update && sudo apt install -y ${MISSING_DEPS[*]}"
    exit 1
fi

echo "✅ All system dependencies found"

# Check Node.js and npm
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm not found"
    exit 1
fi

# Check Node.js version (should be 20.19+ or 22.12+)
NODE_VERSION=$(node --version | sed 's/v//')
NODE_MAJOR=$(echo $NODE_VERSION | cut -d. -f1)
NODE_MINOR=$(echo $NODE_VERSION | cut -d. -f2)

if [ "$NODE_MAJOR" -lt 20 ] || ([ "$NODE_MAJOR" -eq 20 ] && [ "$NODE_MINOR" -lt 19 ]); then
    if [ "$NODE_MAJOR" -ne 22 ] || [ "$NODE_MINOR" -lt 12 ]; then
        echo "⚠️  Node.js $NODE_VERSION found, but Vite requires 20.19+ or 22.12+"
        echo "   Build may work but you might see warnings"
    fi
fi

echo "✅ Node.js $(node --version) and npm $(npm --version) found"

# Check Rust and Cargo
if ! command -v cargo &> /dev/null; then
    echo "❌ Cargo not found"
    exit 1
fi

echo "✅ Rust $(rustc --version) and Cargo $(cargo --version) found"

# Test Rust compilation
echo "Testing Rust compilation..."
cd src-tauri
if cargo check --quiet; then
    echo "✅ Rust code compiles successfully"
else
    echo "❌ Rust compilation failed"
    exit 1
fi
cd ..

# Test Node.js dependencies
echo "Testing Node.js dependencies..."
if npm install --silent; then
    echo "✅ Node.js dependencies installed successfully"
else
    echo "❌ Node.js dependency installation failed"
    exit 1
fi

# Test frontend build
echo "Testing frontend build..."
if npm run build --silent; then
    echo "✅ Frontend builds successfully"
else
    echo "❌ Frontend build failed"
    exit 1
fi

echo ""
echo "🎉 All Linux functionality tests passed!"
echo ""
echo "To run Caspian in development mode:"
echo "  npm run tauri:dev:linux"
echo ""
echo "To build for production:"
echo "  npm run tauri:build:linux"
echo "  or"
echo "  ./scripts/build-linux.sh"
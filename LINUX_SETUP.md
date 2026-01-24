# Linux Setup Guide

This guide will help you set up Caspian on Linux (Ubuntu/Debian).

## Prerequisites

### 1. Install System Dependencies

```bash
# Update package list
sudo apt update

# Install required system libraries
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  pkg-config
```

### 2. Install Node.js (if not already installed)

```bash
# Using NodeSource repository (recommended for latest version)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation (should be 20.19+ or 22.12+)
node --version
npm --version
```

### 3. Install Rust (if not already installed)

```bash
# Install Rust using rustup
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Reload your shell or run:
source ~/.cargo/env

# Verify installation
rustc --version
cargo --version
```

### 4. Install Claude Code CLI

Follow the official Claude Code CLI installation instructions for Linux.

## Building Caspian

### Development Build

```bash
# Clone the repository
git clone https://github.com/TheCaspianAI/Caspian.git
cd Caspian

# Install Node.js dependencies
npm install

# Run in development mode
npm run tauri:dev:linux
```

### Production Build

```bash
# Build for production
npm run tauri:build:linux

# Or use the convenience script
./scripts/build-linux.sh
```

The built application will be available in `src-tauri/target/release/bundle/`.

## Troubleshooting

### Common Issues

1. **WebKit2GTK not found**
   ```bash
   sudo apt install libwebkit2gtk-4.1-dev
   ```

2. **Build tools missing**
   ```bash
   sudo apt install build-essential pkg-config
   ```

3. **SSL/TLS errors**
   ```bash
   sudo apt install libssl-dev
   ```

4. **AppIndicator issues**
   ```bash
   sudo apt install libayatana-appindicator3-dev
   ```

### Performance Notes

- Linux builds may have different performance characteristics compared to macOS
- Window transparency and effects are handled differently on Linux
- Some visual effects available on macOS may not be available on Linux
- GTK-based window management provides standard Linux desktop integration

### Desktop Integration

The Linux build includes:
- `.desktop` file for application menu integration
- System notification support
- Standard GTK window decorations
- File association support

## Distribution

The Linux build will create:
- `.deb` package for Debian/Ubuntu systems
- `.AppImage` for universal Linux compatibility
- Raw binary in the `bundle` directory

## Known Limitations

- Window vibrancy effects (available on macOS) are not supported on Linux
- Some native integrations may behave differently
- System notifications may vary based on desktop environment

## Support

If you encounter issues specific to Linux, please:
1. Check this troubleshooting guide
2. Ensure all system dependencies are installed
3. Report Linux-specific issues on the GitHub repository
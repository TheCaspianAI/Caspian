# Platform Support

Caspian now supports both macOS and Linux (Ubuntu/Debian).

## Supported Platforms

| Platform | Status | Notes |
|----------|--------|-------|
| macOS | ✅ Full Support | Original platform with all features |
| Linux (Ubuntu/Debian) | ✅ Full Support | New platform support added |
| Windows | ❌ Not Supported | May be added in future |

## Platform-Specific Features

### macOS
- Window vibrancy effects
- Native title bar styling
- Homebrew integration for Claude CLI detection
- Full transparency support

### Linux
- Standard window decorations
- System package manager integration
- Snap package support for Claude CLI
- AppImage distribution format

## Development Commands

### macOS Development
```bash
npm run tauri:dev        # Uses default macOS config
npm run tauri:build      # Builds for macOS
```

### Linux Development
```bash
npm run tauri:dev:linux  # Uses Linux-specific config
npm run tauri:build:linux # Builds for Linux
./scripts/build-linux.sh  # Convenience script
```

## Configuration Files

- `src-tauri/tauri.conf.json` - Default macOS configuration
- `src-tauri/tauri.linux.conf.json` - Linux-specific configuration
- `src-tauri/Cargo.toml` - Platform-conditional dependencies

## Key Differences

### Window Behavior
- **macOS**: Transparent windows with vibrancy, overlay title bar
- **Linux**: Opaque windows with standard decorations, visible title bar

### Dependencies
- **macOS**: Uses `window-vibrancy` crate for visual effects
- **Linux**: Uses standard GTK-based window management

### Claude CLI Detection
Both platforms check common installation paths:
- System PATH
- `/usr/local/bin/claude`
- `~/.local/bin/claude`
- `~/bin/claude`
- **macOS**: Additional Homebrew paths
- **Linux**: Additional system paths (`/usr/bin`, `/snap/bin`)

## Build Outputs

### macOS
- `.app` bundle
- `.dmg` installer

### Linux
- `.deb` package (Debian/Ubuntu)
- `.AppImage` (universal Linux)
- Raw binary

## Setup Requirements

See platform-specific setup guides:
- macOS: Standard Rust + Node.js setup
- Linux: [LINUX_SETUP.md](LINUX_SETUP.md) for detailed instructions
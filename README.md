# ZPX Studio

AI-Native Game Engine IDE for the ZPX programming language.

## Features

- **Code Editor** — Syntax highlighting, snippets, auto-completion
- **AI Game Generator** — Describe a game, get playable ZPX code
- **Template System** — Platformer, FPS, Racing, RPG presets
- **Hot Reload** — Edit code while running, see changes instantly
- **REPL** — Interactive ZPX console
- **One-Click Export** — Windows, Linux, macOS, Web

## Install

```bash
npm install
npm start
```

## Build

```bash
npm run build:win    # Windows installer
npm run build:mac    # macOS DMG
npm run build:linux  # Linux AppImage
```

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Run Game | Ctrl+Shift+R |
| Stop Game | Ctrl+Shift+S |
| AI Generate | Ctrl+G |
| Format Code | Shift+Alt+F |
| Check Syntax | Ctrl+K |
| Hot Reload | Ctrl+H |

## Project Structure

```
ZPX-STUDIO/
├── standalone/        # Electron desktop app
│   ├── main.js
│   ├── index.html
│   └── package.json
├── vscode-extension/  # VS Code extension
│   ├── package.json
│   ├── syntaxes/
│   ├── snippets/
│   └── src/
└── README.md
```

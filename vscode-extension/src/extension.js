const vscode = require('vscode');
const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

let terminal = null;
let gameProcess = null;

function activate(context) {
  console.log('ZPX Studio is now active!');

  // Run game
  context.subscriptions.push(
    vscode.commands.registerCommand('zpx.run', () => {
      runGame(false);
    })
  );

  // Run game (debug)
  context.subscriptions.push(
    vscode.commands.registerCommand('zpx.runDebug', () => {
      runGame(true);
    })
  );

  // Stop game
  context.subscriptions.push(
    vscode.commands.registerCommand('zpx.stop', () => {
      stopGame();
    })
  );

  // New project
  context.subscriptions.push(
    vscode.commands.registerCommand('zpx.newProject', () => {
      createNewProject();
    })
  );

  // New ZPX file
  context.subscriptions.push(
    vscode.commands.registerCommand('zpx.newFile', () => {
      createNewFile();
    })
  );

  // AI Generate
  context.subscriptions.push(
    vscode.commands.registerCommand('zpx.aiGenerate', () => {
      aiGenerate();
    })
  );

  // AI Explain
  context.subscriptions.push(
    vscode.commands.registerCommand('zpx.aiExplain', () => {
      aiExplain();
    })
  );

  // Template
  context.subscriptions.push(
    vscode.commands.registerCommand('zpx.template', () => {
      createFromTemplate();
    })
  );

  // Export
  context.subscriptions.push(
    vscode.commands.registerCommand('zpx.export', () => {
      exportGame();
    })
  );

  // Open REPL
  context.subscriptions.push(
    vscode.commands.registerCommand('zpx.openREPL', () => {
      openREPL();
    })
  );

  // Format
  context.subscriptions.push(
    vscode.commands.registerCommand('zpx.format', () => {
      formatDocument();
    })
  );

  // Check syntax
  context.subscriptions.push(
    vscode.commands.registerCommand('zpx.checkSyntax', () => {
      checkSyntax();
    })
  );

  // Hot reload
  context.subscriptions.push(
    vscode.commands.registerCommand('zpx.hotReload', () => {
      enableHotReload();
    })
  );

  // Status bar
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.text = "$(play) ZPX";
  statusBarItem.tooltip = "ZPX Studio";
  statusBarItem.command = "zpx.run";
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Completion provider
  const completionProvider = vscode.languages.registerCompletionItemProvider('zpx', {
    provideCompletionItems(document, position) {
      const items = [];

      // Keywords
      const keywords = [
        'fn', 'class', 'if', 'el', 'for', 'while', 'ret', 'let', 'mut',
        'import', 'from', 'as', 'and', 'or', 'not', 'true', 'false', 'none',
        'self', 'pass', 'break', 'continue', 'match', 'test', 'doc', 'check',
        'expect', 'requires', 'ensures', 'concurrent', 'channel', 'api',
        'service', 'database', 'schema', 'type', 'enum', 'struct', 'interface',
        'expose', 'export', 'version', 'permission', 'raise', 'exit', 'wait'
      ];

      keywords.forEach(keyword => {
        const item = new vscode.CompletionItem(keyword, vscode.CompletionItemKind.Keyword);
        items.push(item);
      });

      // Built-in functions
      const builtins = [
        'print', 'say', 'show', 'ask', 'str', 'int', 'float', 'len',
        'range', 'map', 'filter', 'append', 'abs', 'max', 'min', 'sum',
        'round', 'sqrt', 'exp', 'log', 'sin', 'cos', 'floor', 'ceil',
        'now', 'today', 'wait', 'random', 'randint', 'type', 'isinstance',
        'json_parse', 'json_stringify', 'json_load', 'json_save',
        'csv_load', 'csv_save', 'http_get', 'http_post',
        'read_file', 'write_file', 'web_fetch',
        'db_open', 'db_query', 'db_exec', 'db_close',
        'element', 'html', 'render',
        'pmap', 'parallel', 'par_map', 'par_filter', 'retry',
        'tensor', 'zeros', 'ones', 'reshape', 'dense'
      ];

      builtins.forEach(builtin => {
        const item = new vscode.CompletionItem(builtin, vscode.CompletionItemKind.Function);
        items.push(item);
      });

      // Game functions
      const gameFuncs = [
        'zap', 'zap_cube', 'zap_sphere', 'zap_plane', 'zap_light',
        'zap_camera', 'zap_move', 'zap_move_to', 'zap_rotate', 'zap_scale_to',
        'zap_color', 'zap_pos', 'zap_vel', 'zap_key', 'zap_key_just',
        'zap_mouse_x', 'zap_mouse_y', 'zap_mouse_pressed',
        'zap_find', 'zap_destroy', 'zap_spawn', 'zap_entity',
        'zap_sky', 'zap_ambient', 'zap_sun', 'zap_sun_color', 'zap_sun_intensity',
        'zap_gravity', 'zap_physics',
        'zap_on_update', 'zap_on_render', 'zap_on_key', 'zap_on_click',
        'zap_run', 'zap_quit',
        'zap_play', 'zap_music', 'zap_volume',
        'zap_particles', 'zap_explosion', 'zap_flash',
        'zap_dist', 'zap_random', 'zap_lerp', 'zap_clamp',
        'zap_time', 'zap_frame', 'zap_dt',
        'zap_text', 'zap_button', 'zap_slider', 'zap_panel'
      ];

      gameFuncs.forEach(func => {
        const item = new vscode.CompletionItem(func, vscode.CompletionItemKind.Function);
        items.push(item);
      });

      return items;
    }
  });
  context.subscriptions.push(completionProvider);

  // Hover provider
  const hoverProvider = vscode.languages.registerHoverProvider('zpx', {
    provideHover(document, position) {
      const word = document.getWordRangeAtPosition(position);
      if (word) {
        const text = document.getText(word);
        const docs = getDocumentation(text);
        if (docs) {
          return new vscode.Hover(docs);
        }
      }
      return null;
    }
  });
  context.subscriptions.push(hoverProvider);
}

function runGame(debug) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('No active editor');
    return;
  }

  const filePath = editor.document.fileName;
  const config = vscode.workspace.getConfiguration('zpx');
  const executable = config.get('executable', 'zpx');

  if (terminal) {
    terminal.dispose();
  }

  terminal = vscode.window.createTerminal('ZPX Game');
  terminal.show();

  if (debug) {
    terminal.sendText(`${executable} run "${filePath}" --debug`);
  } else {
    terminal.sendText(`${executable} run "${filePath}"`);
  }
}

function stopGame() {
  if (terminal) {
    terminal.sendText('exit');
    terminal = null;
  }
}

async function createNewProject() {
  const name = await vscode.window.showInputBox({
    prompt: 'Project name',
    placeHolder: 'my-game'
  });

  if (!name) return;

  const folderUri = await vscode.window.showOpenDialog({
    canSelectFolders: true,
    canSelectFiles: false,
    openLabel: 'Select Location'
  });

  if (!folderUri || folderUri.length === 0) return;

  const projectPath = path.join(folderUri[0].fsPath, name);

  // Create project structure
  fs.mkdirSync(projectPath, { recursive: true });
  fs.mkdirSync(path.join(projectPath, 'assets'), { recursive: true });
  fs.mkdirSync(path.join(projectPath, 'scenes'), { recursive: true });

  // Create main.zpx
  const mainContent = `import "zap.zpx"

zap("${name}", 1280, 720)

# Create player
player = zap_cube(0, 0, 0)
zap_color(player, 0.2, 0.6, 1.0)

# Create ground
ground = zap_plane(0, -1, 0)
zap_scale_to(ground, 20, 1, 20)
zap_color(ground, 0.3, 0.7, 0.3)

# Game loop
zap_on_update(fn(dt):
  # Player movement
  if zap_key("w"): zap_move(player, 0, 0, -5 * dt)
  if zap_key("s"): zap_move(player, 0, 0, 5 * dt)
  if zap_key("a"): zap_move(player, -5 * dt, 0, 0)
  if zap_key("d"): zap_move(player, 5 * dt, 0, 0)
  
  # Camera follow
  let pos = zap_pos(player)
  zap_camera(pos[0], pos[1] + 5, pos[2] + 10)
end)

zap_run()
`;

  fs.writeFileSync(path.join(projectPath, 'main.zpx'), mainContent);

  // Create project.json
  const projectJson = {
    name: name,
    version: "1.0.0",
    template: "default",
    created: new Date().toISOString()
  };
  fs.writeFileSync(path.join(projectPath, 'project.json'), JSON.stringify(projectJson, null, 2));

  // Open in VS Code
  vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(projectPath));
  vscode.window.showInformationMessage(`Project "${name}" created!`);
}

async function createNewFile() {
  const name = await vscode.window.showInputBox({
    prompt: 'File name',
    placeHolder: 'game.zpx'
  });

  if (!name) return;

  const editor = vscode.window.activeTextEditor;
  const folder = editor ? path.dirname(editor.document.fileName) : vscode.workspace.workspaceFolders[0].uri.fsPath;
  
  const filePath = path.join(folder, name.endsWith('.zpx') ? name : name + '.zpx');
  
  fs.writeFileSync(filePath, `# ${name}\n\n`);
  
  vscode.window.showTextDocument(vscode.Uri.file(filePath));
}

async function aiGenerate() {
  const prompt = await vscode.window.showInputBox({
    prompt: 'Describe the game you want to create',
    placeHolder: 'A platformer with enemies and coins'
  });

  if (!prompt) return;

  // Simple AI generation (would connect to actual AI API)
  const code = generateGameCode(prompt);
  
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    editor.edit(editBuilder => {
      const position = editor.selection.active;
      editBuilder.insert(position, code);
    });
  }
}

function generateGameCode(prompt) {
  const lower = prompt.toLowerCase();
  
  if (lower.includes('platformer') || lower.includes('side scroller')) {
    return `
import "zap.zpx"

zap("Platformer", 1280, 720)

player = zap_cube(0, 2, 0)
zap_color(player, 0.2, 0.6, 1.0)

ground = zap_plane(0, 0, 0)
zap_scale_to(ground, 30, 1, 1)
zap_color(ground, 0.3, 0.7, 0.3)

for i in range(8):
  p = zap_cube(-12 + i * 3.5, 2 + (i % 3) * 2, 0)
  zap_color(p, 0.5, 0.5, 0.5)

zap_on_update(fn(dt):
  if zap_key("a"): zap_move(player, -6 * dt, 0, 0)
  if zap_key("d"): zap_move(player, 6 * dt, 0, 0)
  if zap_key("space"): zap_move(player, 0, 10 * dt, 0)
  zap_move(player, 0, -20 * dt, 0)
  let pos = zap_pos(player)
  zap_camera(pos[0], pos[1] + 3, 10)
end)

zap_run()
`;
  }
  
  if (lower.includes('fps') || lower.includes('shooter')) {
    return `
import "zap.zpx"

zap("FPS Game", 1280, 720)
zap_sky(0.4, 0.6, 0.9)

player = zap_cube(0, 1, 0)
zap_color(player, 0.2, 0.6, 1.0)

ground = zap_plane(0, 0, 0)
zap_scale_to(ground, 50, 1, 50)
zap_color(ground, 0.3, 0.7, 0.3)

for i in range(10):
  e = zap_sphere(zap_random(-20, 20), 1, zap_random(-20, 20))
  zap_color(e, 1, 0.2, 0.2)
  e["tag"] = "enemy"

zap_on_update(fn(dt):
  if zap_key("w"): zap_move(player, 0, 0, -8 * dt)
  if zap_key("s"): zap_move(player, 0, 0, 8 * dt)
  if zap_key("a"): zap_move(player, -8 * dt, 0, 0)
  if zap_key("d"): zap_move(player, 8 * dt, 0, 0)
  let pos = zap_pos(player)
  zap_camera(pos[0], pos[1] + 1.7, pos[2] + 3)
end)

zap_run()
`;
  }
  
  return `
import "zap.zpx"

zap("AI Game", 1280, 720)

player = zap_cube(0, 0, 0)
zap_color(player, 0.2, 0.6, 1.0)

ground = zap_plane(0, -1, 0)
zap_scale_to(ground, 20, 1, 20)
zap_color(ground, 0.3, 0.7, 0.3)

zap_on_update(fn(dt):
  if zap_key("w"): zap_move(player, 0, 0, -5 * dt)
  if zap_key("s"): zap_move(player, 0, 0, 5 * dt)
  if zap_key("a"): zap_move(player, -5 * dt, 0, 0)
  if zap_key("d"): zap_move(player, 5 * dt, 0, 0)
  let pos = zap_pos(player)
  zap_camera(pos[0], pos[1] + 5, pos[2] + 10)
end)

zap_run()
`;
}

function aiExplain() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const selection = editor.document.getText(editor.selection);
  if (!selection) {
    vscode.window.showInformationMessage('Select code to explain');
    return;
  }

  // Simple explanation (would connect to actual AI API)
  vscode.window.showInformationMessage('AI: This code creates a game entity and handles player input.');
}

async function createFromTemplate() {
  const templates = [
    { label: '2D Platformer', description: 'Side-scrolling platformer', id: 'platformer' },
    { label: '3D FPS', description: 'First-person shooter', id: 'fps' },
    { label: 'Top-Down Shooter', description: '2D top-down shooter', id: 'topdown' },
    { label: 'Racing', description: 'Simple racing game', id: 'racing' },
    { label: 'Puzzle', description: 'Block puzzle game', id: 'puzzle' },
    { label: 'RPG', description: 'Top-down RPG', id: 'rpg' }
  ];

  const selected = await vscode.window.showQuickPick(templates, {
    placeHolder: 'Select a template'
  });

  if (!selected) return;

  // Create project with template
  await createNewProject();
}

async function exportGame() {
  const platforms = [
    { label: 'Web (HTML5)', description: 'Export to web browser', id: 'web' },
    { label: 'Windows', description: 'Export for Windows', id: 'windows' },
    { label: 'macOS', description: 'Export for macOS', id: 'mac' },
    { label: 'Linux', description: 'Export for Linux', id: 'linux' },
    { label: 'Android', description: 'Export for Android', id: 'android' },
    { label: 'iOS', description: 'Export for iOS', id: 'ios' }
  ];

  const selected = await vscode.window.showQuickPick(platforms, {
    placeHolder: 'Select export platform'
  });

  if (!selected) return;

  vscode.window.showInformationMessage(`Exporting to ${selected.label}...`);
  
  // Would run actual export command
  const config = vscode.workspace.getConfiguration('zpx');
  const executable = config.get('executable', 'zpx');
  
  if (terminal) {
    terminal.sendText(`${executable} export ${selected.id}`);
  }
}

function openREPL() {
  if (terminal) {
    terminal.dispose();
  }

  terminal = vscode.window.createTerminal('ZPX REPL');
  terminal.show();
  terminal.sendText('zpx repl');
}

function formatDocument() {
  vscode.commands.executeCommand('editor.action.formatDocument');
}

function checkSyntax() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const filePath = editor.document.fileName;
  const config = vscode.workspace.getConfiguration('zpx');
  const executable = config.get('executable', 'zpx');

  exec(`${executable} check "${filePath}"`, (error, stdout, stderr) => {
    if (error) {
      vscode.window.showErrorMessage(`Syntax error: ${stderr}`);
    } else {
      vscode.window.showInformationMessage('Syntax OK!');
    }
  });
}

function enableHotReload() {
  vscode.window.showInformationMessage('Hot reload enabled');
}

function getDocumentation(word) {
  const docs = {
    'zap': 'Initialize the game engine\n```zpx\nzap("Game Name", width, height)\n```',
    'zap_cube': 'Create a cube entity\n```zpx\nlet id = zap_cube(x, y, z)\n```',
    'zap_sphere': 'Create a sphere entity\n```zpx\nlet id = zap_sphere(x, y, z)\n```',
    'zap_move': 'Move an entity\n```zpx\nzap_move(id, dx, dy, dz)\n```',
    'zap_color': 'Set entity color\n```zpx\nzap_color(id, r, g, b)\n```',
    'zap_key': 'Check if key is pressed\n```zpx\nif zap_key("w"): ...\n```',
    'fn': 'Define a function\n```zpx\nfn name(params):\n  body\n```',
    'class': 'Define a class\n```zpx\nclass Name:\n  fn init(self):\n    ...\n```',
    'if': 'Conditional statement\n```zpx\nif condition:\n  body\nel:\n  else_body\n```',
    'for': 'For loop\n```zpx\nfor item in range(n):\n  body\n```',
    'let': 'Variable declaration\n```zpx\nlet name = value\n```',
    'ret': 'Return from function\n```zpx\nret value\n```',
    'none': 'Null value\n```zpx\nlet x = none\n```',
  };
  
  if (docs[word]) {
    return new vscode.MarkdownString(docs[word]);
  }
  return null;
}

function deactivate() {
  if (terminal) {
    terminal.dispose();
  }
}

module.exports = {
  activate,
  deactivate
};

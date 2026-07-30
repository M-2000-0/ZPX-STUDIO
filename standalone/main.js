const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, exec } = require('child_process');

let mainWindow;
let gameProcess;
let currentProject = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    titleBarStyle: 'hidden',
    backgroundColor: '#1e1e1e'
  });

  mainWindow.loadFile('index.html');

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        { label: 'New Project', accelerator: 'CmdOrCtrl+N', click: () => newProject() },
        { label: 'Open Project', accelerator: 'CmdOrCtrl+O', click: () => openProject() },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => saveFile() },
        { label: 'Save As', accelerator: 'CmdOrCtrl+Shift+S', click: () => saveFileAs() },
        { type: 'separator' },
        { label: 'Export', accelerator: 'CmdOrCtrl+E', click: () => exportGame() },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'delete' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Run',
      submenu: [
        { label: 'Run Game', accelerator: 'CmdOrCtrl+Shift+R', click: () => runGame() },
        { label: 'Stop Game', accelerator: 'CmdOrCtrl+Shift+S', click: () => stopGame() },
        { label: 'Debug', accelerator: 'CmdOrCtrl+Shift+D', click: () => debugGame() },
        { type: 'separator' },
        { label: 'Hot Reload', accelerator: 'CmdOrCtrl+H', click: () => toggleHotReload() }
      ]
    },
    {
      label: 'Tools',
      submenu: [
        { label: 'AI Generate', accelerator: 'CmdOrCtrl+G', click: () => aiGenerate() },
        { label: 'AI Explain', accelerator: 'CmdOrCtrl+?', click: () => aiExplain() },
        { type: 'separator' },
        { label: 'Format Code', accelerator: 'Shift+Alt+F', click: () => formatCode() },
        { label: 'Check Syntax', accelerator: 'CmdOrCtrl+K', click: () => checkSyntax() },
        { type: 'separator' },
        { label: 'Open REPL', click: () => openREPL() }
      ]
    },
    {
      label: 'Help',
      submenu: [
        { label: 'Documentation', click: () => shell.openExternal('https://github.com/M-2000-0/ZPX') },
        { label: 'GitHub', click: () => shell.openExternal('https://github.com/M-2000-0/ZPX-STUDIO') },
        { type: 'separator' },
        { label: 'About', click: () => showAbout() }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC Handlers
ipcMain.handle('run-game', async () => {
  runGame();
});

ipcMain.handle('stop-game', async () => {
  stopGame();
});

ipcMain.handle('new-project', async () => {
  return await newProject();
});

ipcMain.handle('open-project', async () => {
  return await openProject();
});

ipcMain.handle('save-file', async (event, content) => {
  return await saveFile(content);
});

ipcMain.handle('load-file', async (event, filePath) => {
  return await loadFile(filePath);
});

ipcMain.handle('ai-generate', async (event, prompt) => {
  return await aiGenerateCode(prompt);
});

ipcMain.handle('get-templates', async () => {
  return getTemplates();
});

ipcMain.handle('export-game', async (event, platform) => {
  return await exportGame(platform);
});

// Game functions
function runGame() {
  if (!currentProject) {
    dialog.showErrorBox('No Project', 'Please open a project first');
    return;
  }

  const mainFile = path.join(currentProject, 'main.zpx');
  if (!fs.existsSync(mainFile)) {
    dialog.showErrorBox('No main.zpx', 'Project must have a main.zpx file');
    return;
  }

  if (gameProcess) {
    gameProcess.kill();
  }

  gameProcess = spawn('zpx', ['run', mainFile], {
    cwd: currentProject,
    stdio: 'pipe'
  });

  gameProcess.stdout.on('data', (data) => {
    mainWindow.webContents.send('game-output', data.toString());
  });

  gameProcess.stderr.on('data', (data) => {
    mainWindow.webContents.send('game-error', data.toString());
  });

  gameProcess.on('close', (code) => {
    mainWindow.webContents.send('game-closed', code);
    gameProcess = null;
  });
}

function stopGame() {
  if (gameProcess) {
    gameProcess.kill();
    gameProcess = null;
  }
}

function debugGame() {
  runGame();
}

async function newProject() {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Create New Project',
    buttonLabel: 'Create',
    defaultPath: path.join(app.getPath('desktop'), 'My Game')
  });

  if (result.canceled) return null;

  const projectPath = result.filePath;
  fs.mkdirSync(projectPath, { recursive: true });
  fs.mkdirSync(path.join(projectPath, 'assets'), { recursive: true });
  fs.mkdirSync(path.join(projectPath, 'scenes'), { recursive: true });

  const mainContent = `import "zap.zpx"

zap("My Game", 1280, 720)

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

  fs.writeFileSync(path.join(projectPath, 'main.zpx'), mainContent);
  fs.writeFileSync(path.join(projectPath, 'project.json'), JSON.stringify({
    name: path.basename(projectPath),
    version: "1.0.0",
    created: new Date().toISOString()
  }, null, 2));

  currentProject = projectPath;
  mainWindow.webContents.send('project-opened', projectPath);
  return projectPath;
}

async function openProject() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Project',
    properties: ['openDirectory']
  });

  if (result.canceled) return null;

  currentProject = result.filePaths[0];
  mainWindow.webContents.send('project-opened', currentProject);
  return currentProject;
}

async function saveFile(content) {
  // Would save the current file
  return true;
}

async function loadFile(filePath) {
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf8');
  }
  return null;
}

async function aiGenerateCode(prompt) {
  const lower = prompt.toLowerCase();
  
  if (lower.includes('platformer')) {
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

function getTemplates() {
  return [
    { id: 'platformer', name: '2D Platformer', icon: '🏃' },
    { id: 'fps', name: '3D FPS', icon: '🔫' },
    { id: 'topdown', name: 'Top-Down Shooter', icon: '🎯' },
    { id: 'racing', name: 'Racing', icon: '🏎️' },
    { id: 'puzzle', name: 'Puzzle', icon: '🧩' },
    { id: 'rpg', name: 'RPG', icon: '⚔️' }
  ];
}

async function exportGame(platform) {
  if (!currentProject) return false;
  
  const mainFile = path.join(currentProject, 'main.zpx');
  exec(`zpx export ${platform} "${mainFile}"`, (error, stdout, stderr) => {
    if (error) {
      dialog.showErrorBox('Export Failed', stderr);
    } else {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Export Complete',
        message: `Game exported to ${platform}!`
      });
    }
  });
  return true;
}

function aiGenerate() {
  mainWindow.webContents.send('show-ai-panel');
}

function aiExplain() {
  mainWindow.webContents.send('ai-explain');
}

function formatCode() {
  mainWindow.webContents.send('format-code');
}

function checkSyntax() {
  mainWindow.webContents.send('check-syntax');
}

function openREPL() {
  shell.openExternal('https://zpx.run/repl');
}

function toggleHotReload() {
  mainWindow.webContents.send('toggle-hot-reload');
}

function showAbout() {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'About ZPX Studio',
    message: 'ZPX Studio v1.0.0',
    detail: 'AI-Native Game Engine IDE\nBuilt with Electron\n\nZPX Language by M-2000-0'
  });
}

app.whenReady().then(() => {
  createWindow();
  createMenu();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, exec } = require('child_process');

function findZPX() {
  const candidates = [
    path.join(__dirname, '..', '..', 'zpx'),
    path.join(__dirname, '..', '..', 'ZPX'),
    process.env.ZPX_HOME,
    path.join(app.getPath('home'), 'zpx'),
    path.join(app.getPath('home'), 'ZPX'),
  ].filter(Boolean);
  for (const dir of candidates) {
    const cli = path.join(dir, 'src', 'cli.py');
    if (fs.existsSync(cli)) return cli;
  }
  return null;
}
const EVAL_SCRIPT = findZPX();

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

ipcMain.handle('scan-project', async (event) => {
  if (!currentProject) return { error: 'No project open' };
  try {
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const result = await new Promise((resolve, reject) => {
      const child = spawn(pythonCmd, [EVAL_SCRIPT, '--scan', currentProject]);
      let out = '';
      child.stdout.on('data', d => out += d.toString());
      child.on('close', () => {
        try { resolve(JSON.parse(out)); }
        catch { resolve({ error: 'Failed to parse scan result' }); }
      });
      child.on('error', reject);
    });
    return result;
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('run-zpx', async (event, code) => {
  try {
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const tempFile = path.join(app.getPath('temp'), 'zpx_run_temp.zpx');
    fs.writeFileSync(tempFile, code, 'utf8');
    const result = await new Promise((resolve, reject) => {
      const child = spawn(pythonCmd, [EVAL_SCRIPT, 'run', tempFile]);
      let out = '', err = '';
      child.stdout.on('data', d => out += d.toString());
      child.stderr.on('data', d => err += d.toString());
      child.on('close', (code) => {
        fs.unlink(tempFile, () => {});
        resolve({ stdout: out, stderr: err, code });
      });
      child.on('error', reject);
    });
    return result;
  } catch (e) {
    return { error: e.message };
  }
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

  if (!EVAL_SCRIPT) {
    dialog.showErrorBox('ZPX Not Found', 'Set ZPX_HOME environment variable to your ZPX installation');
    return;
  }

  if (gameProcess) {
    gameProcess.kill();
  }

  // Run using the ZPX Python interpreter
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
  gameProcess = spawn(pythonCmd, [EVAL_SCRIPT, 'run', mainFile], {
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

  const mainContent = `import "lib/ecs.zpx"

world = ECS.World()

player = ECS.create_entity(world, "player")
enemy = ECS.create_entity(world, "enemy")

print("ECS world ready with", ECS.entity_count(world), "entities")

fn update(dt):
  for e in ECS.list_entities(world):
    print("Entity:", ECS.get_name(e))

ECS.run_systems(world, 0.016)
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
    return `import "lib/ecs.zpx"

world = ECS.World()

player = ECS.create_entity(world, "player")
ground = ECS.create_entity(world, "ground")

fn movement(dt):
  for e in ECS.query(world, ["Transform"]):
    t = ECS.get_component(world, e, "Transform")
    if ECS.get_name(e) == "player":
      t.fields["x"] += 5 * dt

ECS.register_system(world, "Movement", ["Transform"], movement)
`;
  }

  if (lower.includes('fps') || lower.includes('shooter')) {
    return `import "zap.zpx"

zap("FPS Game", 1280, 720)

player = zap_cube(0, 1, 0)
zap_color(player, 0.2, 0.6, 1.0)

gun = zap_cube(0.3, 0.2, -0.5)
zap_scale_to(gun, 0.1, 0.1, 0.5)
zap_color(gun, 0.3, 0.3, 0.3)

for i in range(5):
  for j in range(3):
    wall = zap_cube(-8 + i * 4, 1, -5 + j * 5)
    zap_color(wall, 0.5, 0.4, 0.3)

floor = zap_plane(0, 0, 0)
zap_scale_to(floor, 30, 1, 30)
zap_color(floor, 0.4, 0.4, 0.4)

enemies = []
for i in range(3):
  e = zap_cube(-5 + i * 5, 1, -10)
  zap_color(e, 1, 0, 0)
  enemies.append(e)

zap_on_update(fn(dt):
  if zap_key("w"): zap_move(player, 0, 0, -8 * dt)
  if zap_key("s"): zap_move(player, 0, 0, 8 * dt)
  if zap_key("a"): zap_move(player, -8 * dt, 0, 0)
  if zap_key("d"): zap_move(player, 8 * dt, 0, 0)
  
  let pos = zap_pos(player)
  zap_camera(pos[0], pos[1] + 1.7, pos[2])
  
  if zap_mouse("left"):
    for e in enemies:
      let ep = zap_pos(e)
      let d = zap_dist(pos, ep)
      if d < 15:
        zap_destroy(e)
end)

zap_run()`;
  }

  if (lower.includes('racing')) {
    return `import "zap.zpx"

zap("Racing", 1280, 720)

car = zap_cube(0, 0.5, 0)
zap_scale_to(car, 1, 0.5, 2)
zap_color(car, 0.2, 0.6, 1.0)

track = zap_plane(0, -0.1, 0)
zap_scale_to(track, 50, 1, 100)
zap_color(track, 0.3, 0.3, 0.3)

for i in range(20):
  left = zap_cube(-10, 0.5, -45 + i * 5)
  zap_color(left, 1, 1, 0)
  right = zap_cube(10, 0.5, -45 + i * 5)
  zap_color(right, 1, 1, 0)

speed = 0
zap_on_update(fn(dt):
  global speed
  if zap_key("w"): speed = speed + 20 * dt
  if zap_key("s"): speed = speed - 30 * dt
  speed = speed * 0.98
  
  if zap_key("a"): zap_move(car, -speed * dt, 0, 0)
  if zap_key("d"): zap_move(car, speed * dt, 0, 0)
  zap_move(car, 0, 0, -speed * dt)
  
  let pos = zap_pos(car)
  zap_camera(pos[0], pos[1] + 8, pos[2] + 15)
end)

zap_run()`;
  }

  if (lower.includes('rpg')) {
    return `import "zap.zpx"

zap("RPG", 1280, 720)

player = zap_cube(0, 0.5, 0)
zap_color(player, 0.2, 0.6, 1.0)

ground = zap_plane(0, 0, 0)
zap_scale_to(ground, 30, 1, 30)
zap_color(ground, 0.2, 0.5, 0.2)

trees = []
for i in range(6):
  t = zap_cube(-12 + i * 5, 1.5, -10)
  zap_scale_to(t, 0.5, 3, 0.5)
  zap_color(t, 0.4, 0.3, 0.2)
  leaves = zap_cube(-12 + i * 5, 3.5, -10)
  zap_scale_to(leaves, 2, 2, 2)
  zap_color(leaves, 0.1, 0.6, 0.1)

enemies = []
for i in range(4):
  e = zap_cube(-8 + i * 5, 0.5, -8)
  zap_color(e, 0.8, 0.2, 0.2)
  enemies.append(e)

hp = 100
zap_on_update(fn(dt):
  global hp
  if zap_key("w"): zap_move(player, 0, 0, -5 * dt)
  if zap_key("s"): zap_move(player, 0, 0, 5 * dt)
  if zap_key("a"): zap_move(player, -5 * dt, 0, 0)
  if zap_key("d"): zap_move(player, 5 * dt, 0, 0)
  
  let pos = zap_pos(player)
  zap_camera(pos[0], pos[1] + 10, pos[2] + 12)
  
  if zap_key("space"):
    for e in enemies:
      let ep = zap_pos(e)
      let d = zap_dist(pos, ep)
      if d < 3:
        zap_destroy(e)
end)

zap_run()`;
  }

  if (lower.includes('puzzle')) {
    return `import "zap.zpx"

zap("Puzzle", 1280, 720)

player = zap_cube(0, 0.5, 0)
zap_color(player, 0.2, 0.6, 1.0)

ground = zap_plane(0, 0, 0)
zap_scale_to(grid, 10, 1, 10)
zap_color(ground, 0.9, 0.9, 0.9)

blocks = []
colors = [[1,0,0], [0,1,0], [0,0,1], [1,1,0]]
for i in range(4):
  b = zap_cube(-3 + i * 2, 0.5, 0)
  zap_color(b, colors[i][0], colors[i][1], colors[i][2])
  blocks.append(b)

targets = []
for i in range(4):
  t = zap_cube(-3 + i * 2, 0.01, 5)
  zap_color(t, 0.5, 0.5, 0.5)
  zap_scale_to(t, 1.5, 0.1, 1.5)
  targets.append(t)

zap_on_update(fn(dt):
  if zap_key("w"): zap_move(player, 0, 0, -5 * dt)
  if zap_key("s"): zap_move(player, 0, 0, 5 * dt)
  if zap_key("a"): zap_move(player, -5 * dt, 0, 0)
  if zap_key("d"): zap_move(player, 5 * dt, 0, 0)
  
  let pos = zap_pos(player)
  zap_camera(pos[0], 10, pos[2] + 8)
end)

zap_run()`;
  }

  if (lower.includes('space') || lower.includes('star')) {
    return `import "zap.zpx"

zap("Space Game", 1280, 720)

ship = zap_cube(0, 0, 0)
zap_scale_to(ship, 0.5, 0.3, 1)
zap_color(ship, 0.7, 0.7, 0.8)

for i in range(30):
  star = zap_cube(
    zap_random(-50, 50),
    zap_random(-30, 30),
    zap_random(-50, 50)
  )
  zap_scale_to(star, 0.1, 0.1, 0.1)
  zap_color(star, 1, 1, 1)

planets = []
for i in range(3):
  p = zap_sphere(
    zap_random(-20, 20),
    zap_random(-10, 10),
    zap_random(-20, 20),
    zap_random(1, 3)
  )
  zap_color(p, zap_random(0,1), zap_random(0,1), zap_random(0,1))

bullets = []

zap_on_update(fn(dt):
  if zap_key("w"): zap_move(ship, 0, 0, -10 * dt)
  if zap_key("s"): zap_move(ship, 0, 0, 10 * dt)
  if zap_key("a"): zap_move(ship, -10 * dt, 0, 0)
  if zap_key("d"): zap_move(ship, 10 * dt, 0, 0)
  
  if zap_key("space"):
    b = zap_cube(zap_pos(ship))
    zap_color(b, 1, 1, 0)
    bullets.append(b)
  
  for b in bullets:
    zap_move(b, 0, 0, -30 * dt)
  
  let pos = zap_pos(ship)
  zap_camera(pos[0], pos[1] + 5, pos[2] + 10)
end)

zap_run()`;
  }

  return `import "zap.zpx"

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

zap_run()`;
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

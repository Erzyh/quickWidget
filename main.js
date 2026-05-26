const { app, BrowserWindow, ipcMain, screen, shell, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

const WINDOW = { width: 360, height: 500 };

const configPath = path.join(app.getPath('userData'), 'shortcuts.json');
const settingsPath = path.join(app.getPath('userData'), 'settings.json');

const localAppData = process.env.LOCALAPPDATA || path.join(app.getPath('home'), 'AppData', 'Local');

const appPaths = {
  github: [path.join(localAppData, 'GitHubDesktop', 'GitHubDesktop.exe')],
  chrome: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe')
  ]
};

const findApp = (list) => list.find(p => fs.existsSync(p)) || null;

const defaultShortcuts = [
  { name: 'MyHongik', url: 'https://my.hongik.ac.kr/', color: '#003876', icon: 'H' },
  { name: 'EGLAB', url: 'https://eglab-test.web.app', color: '#10b981', icon: 'E' },
  { name: '연구비', url: 'https://sanhak.hongik.ac.kr/issue_main2.act', color: '#f59e0b', icon: '₩' },
  { name: 'YouTube', url: 'https://www.youtube.com', color: '#FF0000', icon: '▶' },
  { name: 'Chrome', app: findApp(appPaths.chrome), url: 'https://www.google.com', color: '#4285F4', icon: 'C' },
  { name: 'GitHub', app: findApp(appPaths.github), url: 'https://github.com', color: '#24292e', icon: '⌘' }
];

const defaultSettings = {
  autoStart: true,
  firstRun: true,
  corner: 'bottom-right',
  bubbleSize: 72,
  edgeMargin: 16
};

let win;
let tray;

function loadShortcuts() {
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }
  fs.writeFileSync(configPath, JSON.stringify(defaultShortcuts, null, 2));
  return defaultShortcuts;
}

function saveShortcuts(list) {
  fs.writeFileSync(configPath, JSON.stringify(list, null, 2));
}

function loadSettings() {
  if (fs.existsSync(settingsPath)) {
    return { ...defaultSettings, ...JSON.parse(fs.readFileSync(settingsPath, 'utf-8')) };
  }
  fs.writeFileSync(settingsPath, JSON.stringify(defaultSettings, null, 2));
  return { ...defaultSettings };
}

function saveSettings(s) {
  fs.writeFileSync(settingsPath, JSON.stringify(s, null, 2));
}

function applyAutoStart(enabled) {
  if (process.platform !== 'win32') return;
  app.setLoginItemSettings({ openAtLogin: enabled, path: process.execPath, args: [] });
}

function positionWindow() {
  const s = loadSettings();
  const { workArea } = screen.getPrimaryDisplay();
  const m = s.edgeMargin;
  const x = s.corner.includes('right')
    ? workArea.x + workArea.width - WINDOW.width - m
    : workArea.x + m;
  const y = s.corner.includes('bottom')
    ? workArea.y + workArea.height - WINDOW.height - m
    : workArea.y + m;
  win.setBounds({ x, y, width: WINDOW.width, height: WINDOW.height });
}

function createWindow() {
  win = new BrowserWindow({
    width: WINDOW.width,
    height: WINDOW.height,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });

  win.setAlwaysOnTop(true, 'floating');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false });
  win.setIgnoreMouseEvents(true, { forward: true });
  positionWindow();

  win.loadFile('index.html');
  win.once('ready-to-show', () => win.show());
}

function buildTrayMenu() {
  const s = loadSettings();
  return Menu.buildFromTemplate([
    { label: '보이기/숨기기', click: () => win.isVisible() ? win.hide() : win.show() },
    { label: '위치 초기화', click: () => positionWindow() },
    { type: 'separator' },
    {
      label: 'Windows 시작 시 자동 실행',
      type: 'checkbox',
      checked: !!s.autoStart,
      click: (item) => {
        const cur = loadSettings();
        cur.autoStart = item.checked;
        saveSettings(cur);
        applyAutoStart(item.checked);
      }
    },
    { type: 'separator' },
    { label: '종료', click: () => app.quit() }
  ]);
}

function createTray() {
  tray = new Tray(nativeImage.createEmpty());
  tray.setToolTip('labApp');
  tray.setContextMenu(buildTrayMenu());
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      win.show();
      win.focus();
    }
  });
}

app.whenReady().then(() => {
  const s = loadSettings();
  if (s.firstRun) {
    applyAutoStart(s.autoStart !== false);
    s.firstRun = false;
    saveSettings(s);
  } else {
    applyAutoStart(!!s.autoStart);
  }
  createWindow();
  createTray();
});

app.on('window-all-closed', (e) => e.preventDefault());

ipcMain.handle('get-shortcuts', () => loadShortcuts());
ipcMain.handle('save-shortcuts', (_e, list) => saveShortcuts(list));

ipcMain.handle('get-settings', () => loadSettings());
ipcMain.handle('save-settings', (_e, patch) => {
  const cur = { ...loadSettings(), ...patch };
  saveSettings(cur);
  positionWindow();
  if (tray) tray.setContextMenu(buildTrayMenu());
  return cur;
});

ipcMain.on('set-clickable', (_e, clickable) => {
  if (!win) return;
  if (clickable) win.setIgnoreMouseEvents(false);
  else win.setIgnoreMouseEvents(true, { forward: true });
});

ipcMain.handle('open-shortcut', async (_e, sc) => {
  if (sc.app && fs.existsSync(sc.app)) {
    const err = await shell.openPath(sc.app);
    if (!err) return;
  }
  if (sc.url) await shell.openExternal(sc.url);
});

ipcMain.handle('quit-app', () => app.quit());

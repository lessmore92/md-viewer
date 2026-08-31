import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron';
import path from 'path';
import fs from 'fs';

let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 600,
    minHeight: 400,
    title: 'MD Viewer',
    icon: path.join(__dirname, '../public/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

let pendingFile: string | null = null;

function findMarkdownArg(): string | null {
  for (const arg of process.argv) {
    const lower = arg.toLowerCase();
    if (lower.endsWith('.md') || lower.endsWith('.markdown')) {
      return arg;
    }
  }
  return null;
}

function setupFileAssociation() {
  const filePath = findMarkdownArg();
  if (filePath) {
    pendingFile = filePath;
  }
}

function sendPendingFile() {
  if (pendingFile && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('open-file', pendingFile);
    pendingFile = null;
  }
}

async function openFileDialogAction() {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile'],
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd'] }],
  });
  if (!result.canceled && result.filePaths.length > 0) {
    mainWindow!.webContents.send('open-file', result.filePaths[0]);
  }
}

function buildMenu() {
  const template: Electron.MenuItemConstructorOptions[] =
    process.platform === 'darwin' ? [{ role: 'appMenu' as const }] : [];

  template.push(
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Markdown File...',
          accelerator: 'CmdOrCtrl+O',
          click: () => openFileDialogAction(),
        },
        { type: 'separator' },
        process.platform === 'darwin' ? { role: 'close' as const } : { role: 'quit' as const },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        { role: 'toggleDevTools' as const },
        { type: 'separator' },
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
        { type: 'separator' },
        { role: 'togglefullscreen' as const },
      ],
    },
  );

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  createWindow();
  setupFileAssociation();
  buildMenu();
  mainWindow?.webContents.once('did-finish-load', sendPendingFile);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      mainWindow?.webContents.once('did-finish-load', sendPendingFile);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('open-file', (event, filePath) => {
  event.preventDefault();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('open-file', filePath);
  } else {
    pendingFile = filePath;
  }
});

ipcMain.handle('open-file-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile'],
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd'] }],
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});
ipcMain.handle('read-file', async (event, filePath: string) => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return { content, error: null };
  } catch (error) {
    return { content: null, error: (error as Error).message };
  }
});

ipcMain.handle('get-file-name', (event, filePath: string) => {
  return path.basename(filePath);
});

ipcMain.handle('get-app-path', () => {
  return app.getPath('exe');
});

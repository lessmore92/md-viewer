import { stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { app, BrowserWindow, dialog, ipcMain, Menu, net, protocol, shell } from 'electron';
import { IPC, type DocumentPayload } from './contracts';
import { readMarkdownDocument, resolveDocumentAsset } from './document-service';
import { findMarkdownArgument } from './file-arguments';
import { isTrustedSender, parseExternalUrl } from './security';

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const packagedRendererPath = path.resolve(__dirname, '../dist/index.html');
const trustedRendererUrl = isDev
  ? 'http://localhost:5173/'
  : pathToFileURL(packagedRendererPath).href;

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'md-asset',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
    },
  },
]);

let mainWindow: BrowserWindow | null = null;
let rendererReady = false;
let pendingDocument: DocumentPayload | null = null;
let documentTaskQueue: Promise<void> = Promise.resolve();

function enqueueDocumentTask<T>(task: () => Promise<T>): Promise<T> {
  const result = documentTaskQueue.then(task);
  documentTaskQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function publishDocument(document: DocumentPayload): void {
  if (rendererReady && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(IPC.openedDocument, document);
    return;
  }

  pendingDocument = document;
}

function sendPendingDocument(): void {
  if (!pendingDocument || !mainWindow || mainWindow.isDestroyed()) return;

  mainWindow.webContents.send(IPC.openedDocument, pendingDocument);
  pendingDocument = null;
}

function openDocumentPath(filePath: string): Promise<DocumentPayload> {
  return enqueueDocumentTask(async () => {
    const document = await readMarkdownDocument(filePath);
    publishDocument(document);
    return document;
  });
}

async function selectDocument(): Promise<DocumentPayload | null> {
  const options: Electron.OpenDialogOptions = {
    properties: ['openFile'],
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd'] }],
  };
  const result = mainWindow
    ? await dialog.showOpenDialog(mainWindow, options)
    : await dialog.showOpenDialog(options);

  if (result.canceled || result.filePaths.length === 0) return null;
  return enqueueDocumentTask(() => readMarkdownDocument(result.filePaths[0]));
}

function reportDocumentError(error: unknown): void {
  console.error('Failed to open Markdown document:', error);
}

function focusMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 600,
    minHeight: 400,
    title: 'MD Viewer',
    icon: path.join(__dirname, '../public/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      devTools: isDev,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow = window;
  rendererReady = false;

  window.webContents.on('did-start-loading', () => {
    rendererReady = false;
  });
  window.webContents.on('did-finish-load', () => {
    rendererReady = true;
    sendPendingDocument();
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedSender(url, trustedRendererUrl)) event.preventDefault();
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) =>
    callback(false),
  );

  if (isDev) {
    void window.loadURL(trustedRendererUrl);
    window.webContents.openDevTools();
  } else {
    void window.loadURL(trustedRendererUrl);
  }

  window.on('closed', () => {
    if (mainWindow === window) {
      mainWindow = null;
      rendererReady = false;
    }
  });

  return window;
}

function buildMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] =
    process.platform === 'darwin' ? [{ role: 'appMenu' }] : [];

  template.push(
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Markdown File...',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            void selectDocument()
              .then((document) => {
                if (document) publishDocument(document);
              })
              .catch(reportDocumentError);
          },
        },
        { type: 'separator' },
        process.platform === 'darwin' ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        ...(isDev ? ([{ role: 'toggleDevTools' }] as Electron.MenuItemConstructorOptions[]) : []),
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
  );

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function requireTrustedSender(event: Electron.IpcMainInvokeEvent): void {
  if (!event.senderFrame || !isTrustedSender(event.senderFrame.url, trustedRendererUrl)) {
    throw new Error('Untrusted renderer request.');
  }
}

function notFound(): Response {
  return new Response(null, { status: 404 });
}

function registerAssetProtocol(): void {
  protocol.handle('md-asset', async (request) => {
    try {
      const assetUrl = new URL(request.url);
      const [, encodedDocumentId, ...pathComponents] = assetUrl.pathname.split('/');
      if (assetUrl.host !== 'document' || !encodedDocumentId || pathComponents.length === 0) {
        return notFound();
      }

      const documentId = decodeURIComponent(encodedDocumentId);
      const relativePath = pathComponents.join('/');
      if (!relativePath) return notFound();

      const resolvedPath = await resolveDocumentAsset(documentId, relativePath);
      const assetStats = await stat(resolvedPath);
      if (!assetStats.isFile()) return notFound();

      // Canonical containment, file-type validation, and fetch stay adjacent to minimize
      // the unavoidable local-filesystem TOCTOU interval without weakening realpath checks.
      return net.fetch(pathToFileURL(resolvedPath).href);
    } catch {
      return notFound();
    }
  });
}

function registerIpcHandlers(): void {
  ipcMain.handle(IPC.selectDocument, async (event) => {
    requireTrustedSender(event);
    return selectDocument();
  });

  ipcMain.handle(IPC.openExternal, async (event, value: unknown) => {
    requireTrustedSender(event);
    if (typeof value !== 'string') return false;

    const externalUrl = parseExternalUrl(value);
    if (!externalUrl) return false;

    await shell.openExternal(externalUrl.href);
    return true;
  });
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const filePath = findMarkdownArgument(argv);
    void (async () => {
      try {
        if (filePath) await openDocumentPath(filePath);
      } catch (error) {
        reportDocumentError(error);
      } finally {
        focusMainWindow();
      }
    })();
  });

  app.on('open-file', (event, filePath) => {
    event.preventDefault();
    void openDocumentPath(filePath).catch(reportDocumentError);
  });

  app.whenReady().then(() => {
    registerAssetProtocol();
    registerIpcHandlers();
    createWindow();
    buildMenu();

    const initialFilePath = findMarkdownArgument(process.argv);
    if (initialFilePath) {
      void openDocumentPath(initialFilePath).catch(reportDocumentError);
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

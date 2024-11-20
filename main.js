process.on('uncaughtException', (error) => {
    console.log('Error:', error);
});

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 400,
        height: 600,
        frame: false,
        transparent: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            devTools: false
        },
        skipTaskbar: true,
        x: 0,
        y: 0,
        alwaysOnTop: true,
        focusable: true,
        hasShadow: false,
        resizable: false,
        movable: false,
        minimizable: false,
        maximizable: false,
        fullscreenable: false,
        type: 'toolbar'
    });

    mainWindow.loadFile('index.html');

    mainWindow.webContents.on('console-message', (e, level, message) => {
        e.preventDefault();
    });

    ipcMain.on('enable-mouse', () => {
        mainWindow.setIgnoreMouseEvents(false);
        mainWindow.moveTop();
        mainWindow.setAlwaysOnTop(true, 'screen-saver');
        mainWindow.focusOnWebView();
    });

    ipcMain.on('disable-mouse', () => {
        mainWindow.setIgnoreMouseEvents(true, { forward: true });
    });

    setInterval(() => {
        mainWindow.moveTop();
        mainWindow.setAlwaysOnTop(true, 'screen-saver');
    }, 100);

    mainWindow.on('blur', () => {
        mainWindow.moveTop();
        mainWindow.setAlwaysOnTop(true, 'screen-saver');
    });
}

app.whenReady().then(() => {
    createWindow();
    if (process.platform === 'darwin') {
        app.dock.hide();
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
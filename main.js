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
            contextIsolation: false
        },
        skipTaskbar: true,
        x: 0,
        y: 0,
        // 창 특성 변경
        alwaysOnTop: true,
        focusable: true,  // 다시 true로 변경
        hasShadow: false,
        resizable: false,
        movable: false,
        minimizable: false,
        maximizable: false,
        fullscreenable: false,
        type: 'toolbar'
    });

    mainWindow.loadFile('index.html');

    // 마우스 이벤트 처리
    ipcMain.on('enable-mouse', () => {
        mainWindow.setIgnoreMouseEvents(false);
        mainWindow.moveTop();
        mainWindow.setAlwaysOnTop(true, 'screen-saver');
        mainWindow.focusOnWebView();  // 웹뷰에 포커스
    });

    ipcMain.on('disable-mouse', () => {
        mainWindow.setIgnoreMouseEvents(true, { forward: true });
    });

    // 주기적으로 창을 최상위로 유지
    setInterval(() => {
        mainWindow.moveTop();
        mainWindow.setAlwaysOnTop(true, 'screen-saver');
    }, 100);

    // 창이 포커스를 잃었을 때
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
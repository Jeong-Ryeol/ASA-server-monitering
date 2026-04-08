process.on('uncaughtException', (error) => {
    console.log('Error:', error);
});

const { app, BrowserWindow, ipcMain } = require('electron');

let mainWindow;

const CLIENT_ID = 'xyza7891qC5rMxf0e76B4lGe5qePQXNy';
const CLIENT_SECRET = '14BiZqLRckVJ49d9fZY0/nUoyo+dQ2Z7k8urInugvH4';
const DEPLOY_ID = 'ad9a8feffb3b4b2ca315546f038c3ae2';

let accessToken = null;
let tokenExpires = 0;

async function getToken() {
    if (accessToken && Date.now() < tokenExpires) return accessToken;

    const auth = Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64');

    const deviceRes = await fetch('https://api.epicgames.dev/auth/v1/accounts/deviceid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': 'Basic ' + auth },
        body: 'deviceModel=PC'
    });
    if (!deviceRes.ok) throw new Error('Device ID failed');
    const device = await deviceRes.json();

    const tokenRes = await fetch('https://api.epicgames.dev/auth/v1/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': 'Basic ' + auth },
        body: new URLSearchParams({
            grant_type: 'external_auth',
            external_auth_type: 'deviceid_access_token',
            external_auth_token: device.access_token,
            nonce: 'monitor_' + Date.now(),
            deployment_id: DEPLOY_ID,
            display_name: 'Monitor'
        }).toString()
    });
    if (!tokenRes.ok) throw new Error('Token failed');
    const data = await tokenRes.json();

    accessToken = data.access_token;
    tokenExpires = Date.now() + (data.expires_in - 60) * 1000;
    return accessToken;
}

async function queryEOS(criteria, maxResults = 1) {
    const token = await getToken();
    const res = await fetch(`https://api.epicgames.dev/wildcard/matchmaking/v1/${DEPLOY_ID}/filter`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ criteria, maxResults })
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Query failed (${res.status}): ${err}`);
    }
    return await res.json();
}

// IPC handlers
ipcMain.handle('search-servers', async (event, { searchText }) => {
    try {
        const result = await queryEOS([
            { key: 'attributes.CUSTOMSERVERNAME_s', op: 'CONTAINS', value: searchText }
        ], 20);

        const servers = (result.sessions || []).map(s => ({
            name: s.attributes?.CUSTOMSERVERNAME_s || s.attributes?.SESSIONNAME_s || 'Unknown',
            players: s.totalPlayers || 0,
            maxPlayers: s.settings?.maxPublicPlayers || 0,
            sessionId: s.id
        }));
        return { success: true, servers };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('refresh-server', async (event, { serverName }) => {
    try {
        const result = await queryEOS([
            { key: 'attributes.CUSTOMSERVERNAME_s', op: 'CONTAINS', value: serverName }
        ], 1);

        if (result.sessions && result.sessions.length > 0) {
            const s = result.sessions[0];
            return {
                success: true,
                name: s.attributes?.CUSTOMSERVERNAME_s || 'Unknown',
                players: s.totalPlayers || 0,
                maxPlayers: s.settings?.maxPublicPlayers || 0
            };
        }
        return { success: false, error: 'Not found' };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

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

    ipcMain.on('enable-mouse', () => {
        mainWindow.setIgnoreMouseEvents(false);
        mainWindow.moveTop();
        mainWindow.setAlwaysOnTop(true, 'screen-saver');
        mainWindow.focusOnWebView();
    });

    ipcMain.on('disable-mouse', () => {
        mainWindow.setIgnoreMouseEvents(true, { forward: true });
    });

    ipcMain.on('quit-app', () => {
        app.quit();
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

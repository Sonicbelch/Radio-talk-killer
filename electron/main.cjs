const { app, BrowserWindow } = require("electron");
const path = require("node:path");
const url = require("node:url");

const isDev = !app.isPackaged;

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1100,
    height: 720,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true
    }
  });

  if (isDev) {
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    const indexPath = url
      .pathToFileURL(path.join(__dirname, "../dist/index.html"))
      .toString();
    win.loadURL(indexPath);
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

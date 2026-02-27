import { app, BrowserWindow, ipcMain, dialog } from "electron";
import { join } from "path";
import { autoUpdater } from "electron-updater";
import { exec } from "child_process";
import fs from "fs";
import db from "./database/db.js";
import { launchAccount, getCookies, checkStatus, getInternalUID } from "./automation/browser.js";

let mainWindow;

async function installBrowsers() {
    return new Promise((resolve) => {
        mainWindow.webContents.send(
            "browser:installing",
            "Đang tải trình duyệt hệ thống (khoảng 150MB)...",
        );
        exec("npx playwright install chromium", (error) => {
            if (error) {
                console.error("Lỗi tải trình duyệt:", error);
                mainWindow.webContents.send(
                    "browser:error",
                    "Không thể tải trình duyệt. Hãy kiểm tra kết nối mạng.",
                );
                resolve(false);
            } else {
                mainWindow.webContents.send("browser:ready");
                resolve(true);
            }
        });
    });
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 700,
        height: 600,
        show: false,
        autoHideMenuBar: true,
        title: "FB Profile Manager",
        webPreferences: {
            preload: join(app.getAppPath(), "out/preload/index.js"),
            sandbox: false,
        },
    });

    mainWindow.on("ready-to-show", () => {
        mainWindow.show();
    });

    if (process.env["ELECTRON_RENDERER_URL"]) {
        mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
    } else {
        mainWindow.loadFile(join(app.getAppPath(), "out/renderer/index.html"));
    }
}

app.whenReady().then(() => {
    // --- SETTINGS IPC ---
    ipcMain.handle("settings:get-path", () => {
        const setting = db.get("SELECT value FROM settings WHERE key = 'profile_path'");
        return setting ? setting.value : "";
    });

    ipcMain.handle("settings:set-path", async () => {
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ["openDirectory"]
        });
        if (!result.canceled && result.filePaths.length > 0) {
            const newPath = result.filePaths[0];
            db.run("UPDATE settings SET value = ? WHERE key = 'profile_path'", newPath);
            return newPath;
        }
        return null;
    });

    ipcMain.handle("settings:get", (event, key) => {
        const setting = db.get("SELECT value FROM settings WHERE key = ?", key);
        return setting ? setting.value : null;
    });

    ipcMain.handle("settings:set", (event, key, value) => {
        db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", key, value);
        return true;
    });

    // --- ACCOUNTS IPC ---
    ipcMain.handle("accounts:get", () => {
        return db.all("SELECT * FROM accounts ORDER BY created_at DESC");
    });

    ipcMain.handle("accounts:add", (event, account) => {
        try {
            const result = db.run(
                "INSERT INTO accounts (uid, password, two_fa, note) VALUES (?, ?, ?, ?)",
                account.uid,
                account.password,
                account.two_fa || "",
                account.note || ""
            );
            return { success: true, id: result.lastInsertRowid };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle("accounts:add-bulk", (event, accounts) => {
        const insert = db.prepare(
            "INSERT OR IGNORE INTO accounts (uid, password, two_fa, note) VALUES (?, ?, ?, ?)",
        );
        const transaction = db.getDb().transaction((accs) => {
            for (const acc of accs) {
                insert.run(
                    acc.uid,
                    acc.password,
                    acc.two_fa || "",
                    acc.note || "",
                );
            }
        });
        transaction(accounts);
        return { success: true };
    });

    ipcMain.handle("accounts:delete", (event, id) => {
        try {
            const account = db.get("SELECT * FROM accounts WHERE id = ?", id);
            if (account) {
                // Delete from DB first
                db.run("DELETE FROM accounts WHERE id = ?", id);

                // Get profile path
                const setting = db.get("SELECT value FROM settings WHERE key = 'profile_path'");
                const baseProfilePath = setting ? setting.value : join(app.getPath("documents"), "FB_Profiles");
                const profileFolder = join(baseProfilePath, account.uid || `profile_${account.id}`);

                // Physical deletion
                if (fs.existsSync(profileFolder)) {
                    fs.rmSync(profileFolder, { recursive: true, force: true });
                }
            }
            return { success: true };
        } catch (error) {
            console.error("Lỗi xóa tài khoản và thư mục:", error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle("accounts:check-status", async (event, accountId) => {
        try {
            const account = db.get("SELECT * FROM accounts WHERE id = ?", accountId);
            const proxy = account.proxy_id
                ? db.get("SELECT * FROM proxies WHERE id = ?", account.proxy_id)
                : null;
            const res = await checkStatus(account, proxy);
            return { success: true, status: res };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle("accounts:get-internal-uid", async (event, accountId) => {
        try {
            const account = db.get("SELECT * FROM accounts WHERE id = ?", accountId);
            const proxy = account.proxy_id
                ? db.get("SELECT * FROM proxies WHERE id = ?", account.proxy_id)
                : null;
            const internalUid = await getInternalUID(account, proxy);
            return { success: true, internalUid };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle("accounts:update", async (event, account) => {
        try {
            db.run(
                "UPDATE accounts SET uid = ?, password = ?, two_fa = ?, note = ? WHERE id = ?",
                account.uid,
                account.password,
                account.two_fa,
                account.note,
                account.id
            );
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // --- AUTOMATION IPC ---
    ipcMain.handle("accounts:launch", async (event, accountId) => {
        try {
            const account = db.get("SELECT * FROM accounts WHERE id = ?", accountId);
            const proxy = account.proxy_id
                ? db.get("SELECT * FROM proxies WHERE id = ?", account.proxy_id)
                : null;
            await launchAccount(account, proxy);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle("accounts:get-cookies", async (event, accountId) => {
        try {
            const account = db.get("SELECT * FROM accounts WHERE id = ?", accountId);
            const proxy = account.proxy_id
                ? db.get("SELECT * FROM proxies WHERE id = ?", account.proxy_id)
                : null;
            const res = await getCookies(account, proxy);
            return { success: true, cookies: res.cookies };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle("browser:check", async () => {
        const userPath = app.getPath("userData");
        // Simple check for playwright browsers
        // In production, this path might vary, but playwright usually installs to %USERPROFILE%\AppData\Local\ms-playwright
        return true; // Simplified for now, or use installBrowsers() logic if needed
    });

    createWindow();

    if (app.isPackaged) {
        autoUpdater.checkForUpdatesAndNotify();
    }
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});

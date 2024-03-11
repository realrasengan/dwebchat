const { app, BrowserWindow, globalShortcut, ipcMain } = require('electron');
const MessageExchanger = require('./lib/messageExchanger.js');
const fs = require('fs');
const path = require('path');

const sslDirectory = path.join(__dirname, 'ssl');
let ourName="";

fs.readdir(sslDirectory, (err, files) => {
  if (err) {
    console.error('First run setup.sh');
    process.exit();
  }
  const commonNames = files.map(file => file.split('.')[0]);
  const uniqueNames = new Set(commonNames);
  if (uniqueNames.size === 1) {
    const commonName = uniqueNames.values().next().value;
    ourName=commonName;
  } else {
    console.error('First run setup.sh');
    process.exit();
  }
});

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 600,
    minHeight:400,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false,
    }
  });
  mainWindow.loadFile('./app/dwebchat.html');
//  mainWindow.webContents.openDevTools();
  mainWindow.webContents.on('did-finish-load', () => {
    const MSG = new MessageExchanger(ourName,3600,3601);
    MSG.on('msg',(msg) => {
      mainWindow.webContents.send('backend', 'msg', msg);
    });
    MSG.on('console',(msg) => {
      mainWindow.webContents.send('backend', 'console', msg);
    });
    ipcMain.on('ui', async (event, arg) => {
      let to = arg.name;
      let message = arg.msg;
      if(to.toLowerCase()==="@status") {
        let splits = message.split(' ');
        if(splits[0]) {
          switch(splits[0].toLowerCase()) {
            case 'block':
              if(splits[1]) {
                switch(splits[1].toLowerCase()) {
                  case 'addbyname':
                    if(splits[2]) {
                      if(MSG.addBlockByName(splits[2].toLowerCase())) {
                        mainWindow.webContents.send('backend', 'console',`Added block for ${splits[2]}`);
                      }
                      else
                        mainWindow.webContents.send('backend', 'console',`Unable to add block for ${splits[2]} (not found or invalid)`);
                     } else {
                        mainWindow.webContents.send('backend', 'console','Captain Hook said "Bad Form!"');
                     }
                    break;
                  case 'delbyname':
                    if(splits[2]) {
                      if(MSG.delBlockByName(splits[2].toLowerCase())) {
                        mainWindow.webContents.send('backend', 'console',`Deleted block for ${splits[2]}`);
                      }
                      else
                        mainWindow.webContents.send('backend', 'console',`Unable to delete block for ${splits[2]} (not found or invalid)`);
                     } else {
                        mainWindow.webContents.send('backend', 'console','Captain Hook said "Bad Form!"');
                     }
                    break;
                  case 'add':
                    if(splits[2]) {
                      if(MSG.addBlock(splits[2]))
                        mainWindow.webContents.send('backend', 'console',`Added block for ${splits[2]}`);
                      else
                        mainWindow.webContents.send('backend', 'console',`Unable to add block for ${splits[2]} (not found or invalid)`);
                    } else {
                      mainWindow.webContents.send('backend', 'console','Captain Hook said "Bad Form!"');
                    }
                    break;
                  case 'del':
                    if(splits[2]) {
                      if(MSG.delBlock(splits[2]))
                        mainWindow.webContents.send('backend', 'console',`Deleted block for ${splits[2]}`);
                      else
                        mainWindow.webContents.send('backend', 'console',`Unable to delete block for ${splits[2]} (not found or invalid)`);
                    } else {
                      mainWindow.webContents.send('backend', 'console','Captain Hook said "Bad Form!"');
                    }
                    break;
                  case 'list':
                    let list = MSG.getBlocks();
                    mainWindow.webContents.send('backend', 'console',`*** Listing Active Blocks ***`);
                    list.forEach((block) => {
                      mainWindow.webContents.send('backend', 'console',`${block}`);
                    });
                    mainWindow.webContents.send('backend', 'console',`*** End of List ***`);
                    break;
                  default: 
                    mainWindow.webContents.send('backend', 'console','Captain Hook said "Bad Form!"');
                    break;
                }
              }
              else {
                mainWindow.webContents.send('backend', 'console','Captain Hook said "Bad Form!"');
              }
            default:
              break
          }
        }
      } else {
        let sent = await MSG.sendMessage(to, message);
        if(!sent)
          mainWindow.webContents.send('backend', 'console','Failed to send message to '+to);
      }
    });
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
app.on('window-all-closed', () => {
  app.quit();
});
app.on('browser-window-focus', function () {
    globalShortcut.register("CommandOrControl+R", () => {
    });
    globalShortcut.register("F5", () => {
    });
});
app.on('browser-window-blur', function () {
    globalShortcut.unregister('CommandOrControl+R');
    globalShortcut.unregister('F5');
});


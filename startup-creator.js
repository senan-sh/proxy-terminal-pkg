const os = require("os")
const path = require("path");
const createDesktopShortcut = require('create-desktop-shortcuts');

const shortcut = createDesktopShortcut(
  {
    windows: {
      filePath: path.resolve(os.homedir(), "Proxy-CC", "run-script.cmd"),
      outputPath: path.resolve(os.homedir(), "AppData", "Roaming", "Microsoft", "Windows", "Start Menu", "Programs", "Startup"),
      name: "terminal-run-script.cmd Shortcut"
    }
  }
);
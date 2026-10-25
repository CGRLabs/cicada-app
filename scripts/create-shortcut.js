import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = resolve(fileURLToPath(import.meta.url), '../../');
const electronExe = resolve(appDir, 'node_modules/electron/dist/electron.exe');
const iconPath = resolve(appDir, 'assets/icon.ico');

const psScript = `
$wsh = New-Object -ComObject WScript.Shell
$desktop = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktop "Cicada Uninstaller.lnk"
$shortcut = $wsh.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "${electronExe.replace(/\\/g, '\\\\')}"
$shortcut.Arguments = "${appDir.replace(/\\/g, '\\\\')}"
$shortcut.WorkingDirectory = "${appDir.replace(/\\/g, '\\\\')}"
$shortcut.IconLocation = "${iconPath.replace(/\\/g, '\\\\')},0"
$shortcut.Description = "Cicada Uninstaller"
$shortcut.Save()
Write-Output "Shortcut created at: $shortcutPath"
`;

execFile('powershell', ['-NoProfile', '-Command', psScript], (err, stdout, stderr) => {
  if (err) {
    console.error('Failed to create shortcut:', err.message, stderr);
    process.exit(1);
  }
  console.log(stdout.trim());
});

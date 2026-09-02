# Create Start Menu and Desktop shortcuts that launch LocalFlow without a console window.
#   powershell -ExecutionPolicy Bypass -File scripts\make_windows_shortcut.ps1
$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$pyw = Join-Path $root ".venv\Scripts\pythonw.exe"
if (-not (Test-Path $pyw)) { Write-Error "No .venv found. Run scripts\setup.ps1 first." }

$shell = New-Object -ComObject WScript.Shell
foreach ($dir in @([Environment]::GetFolderPath("Programs"), [Environment]::GetFolderPath("Desktop"))) {
    $lnk = $shell.CreateShortcut((Join-Path $dir "LocalFlow.lnk"))
    $lnk.TargetPath = $pyw
    $lnk.Arguments = "-m localflow run"
    $lnk.WorkingDirectory = $root
    $lnk.Description = "LocalFlow offline dictation"
    $lnk.Save()
}
Write-Host "Shortcuts created in the Start Menu and on the Desktop."
Write-Host "To start at login, copy the Desktop shortcut into: shell:startup (Win+R, type shell:startup)."

# One-shot setup for Windows. Run from the LocalFlow directory in PowerShell:
#   powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Error "python not found. Install Python 3.9+ from python.org (tick 'Add to PATH')."
}

python -m venv .venv
& .\.venv\Scripts\python.exe -m pip install --upgrade pip | Out-Null
& .\.venv\Scripts\python.exe -m pip install -e .
& .\.venv\Scripts\localflow.exe init

Write-Host ""
Write-Host "Done. Start dictating with:"
Write-Host "  .\.venv\Scripts\localflow.exe"
Write-Host ""
Write-Host "The first run downloads the Whisper model (~150 MB for 'base') and caches it locally."
Write-Host "If typing does nothing in an app running as Administrator, run LocalFlow as Administrator too."

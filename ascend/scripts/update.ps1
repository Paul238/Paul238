# Aduce ultima versiune a codului (git), face backup si reconstruieste aplicatia.
. "$PSScriptRoot\common.ps1"
Assert-Docker
Write-Step "Backup inainte de actualizare"
& "$PSScriptRoot\backup.ps1"
if (Get-Command git -ErrorAction SilentlyContinue) {
    Write-Step "Descarc ultima versiune"
    git pull
} else {
    Write-Warn2 "Git nu este instalat: copiaza manual noua versiune a folderului, apoi ruleaza din nou."
}
Write-Step "Reconstruiesc si repornesc"
$env:APP_VERSION = (git rev-parse --short HEAD 2>$null)
docker compose up -d --build
Show-Urls

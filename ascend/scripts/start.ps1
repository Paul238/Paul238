. "$PSScriptRoot\common.ps1"
Assert-Docker
Write-Step "Pornesc Ascend"
docker compose up -d
if ($LASTEXITCODE -ne 0) { throw "Pornirea a esuat." }
Show-Urls
Start-Process "http://localhost:$(Get-EnvValue 'APP_PORT' '8080')"

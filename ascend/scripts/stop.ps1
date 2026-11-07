. "$PSScriptRoot\common.ps1"
Assert-Docker
Write-Step "Opresc Ascend (datele raman salvate)"
docker compose stop
Write-Ok "Oprit."

# Restaureaza baza de date dintr-un backup. Exemplu:
#   .\scripts\restore.ps1 -File backups\ascend_2026-11-07_20-00.sql
param([Parameter(Mandatory = $true)][string]$File)
. "$PSScriptRoot\common.ps1"
Assert-Docker
$path = Resolve-Path $File
Write-Warn2 "ATENTIE: datele curente vor fi inlocuite cu cele din $path"
$answer = Read-Host "Scrie DA pentru a continua"
if ($answer -ne 'DA') { Write-Host "Anulat."; exit 0 }

Write-Step "Fac mai intai un backup al starii curente"
& "$PSScriptRoot\backup.ps1"

Write-Step "Restaurez"
docker compose cp "$path" "db:/tmp/restore.sql" | Out-Null
docker compose exec -T db sh -c 'MYSQL_PWD=$MARIADB_ROOT_PASSWORD mariadb -uroot < /tmp/restore.sql && rm -f /tmp/restore.sql'
if ($LASTEXITCODE -ne 0) { throw "Restaurarea a esuat." }
docker compose restart app | Out-Null
Write-Ok "Gata."

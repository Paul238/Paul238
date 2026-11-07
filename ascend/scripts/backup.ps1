# Salveaza baza de date in folderul backups\ (pastreaza ultimele 30 de copii).
. "$PSScriptRoot\common.ps1"
Assert-Docker
$stamp = Get-Date -Format 'yyyy-MM-dd_HH-mm'
$file = "ascend_$stamp.sql"
New-Item -ItemType Directory -Force -Path "$Root\backups" | Out-Null

Write-Step "Export baza de date"
# fara ghilimele duble in comanda (PowerShell 5.1 le transmite gresit programelor externe)
docker compose exec -T db sh -c ('MYSQL_PWD=$MARIADB_ROOT_PASSWORD mariadb-dump -uroot --single-transaction --routines --databases $MARIADB_DATABASE > /tmp/' + $file)
if ($LASTEXITCODE -ne 0) { throw "Exportul a esuat (ruleaza aplicatia?)." }
docker compose cp "db:/tmp/$file" "$Root\backups\$file" | Out-Null
docker compose exec -T db rm -f "/tmp/$file" | Out-Null

Get-ChildItem "$Root\backups\ascend_*.sql" | Sort-Object Name -Descending | Select-Object -Skip 30 | Remove-Item -Force
Write-Ok "Backup salvat: backups\$file"

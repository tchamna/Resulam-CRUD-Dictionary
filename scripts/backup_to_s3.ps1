param(
  [string]$DatabaseUrl = $env:DATABASE_URL,
  [string]$Bucket = $env:S3_BUCKET,
  [string]$Prefix = $env:S3_PREFIX
)

if (-not $DatabaseUrl) {
  Write-Error "DATABASE_URL is required."
  exit 1
}

if (-not $Bucket) {
  Write-Error "S3_BUCKET is required."
  exit 1
}

if (-not $Prefix) {
  $Prefix = "backups"
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$dumpFile = "african_dictionaries-$timestamp.sql"

Write-Host "Dumping database..."
pg_dump $DatabaseUrl | Out-File -FilePath $dumpFile -Encoding utf8

if (-not (Test-Path $dumpFile)) {
  Write-Error "Dump failed."
  exit 1
}

Write-Host "Uploading to s3://$Bucket/$Prefix/$dumpFile"
aws s3 cp $dumpFile "s3://$Bucket/$Prefix/$dumpFile"

Write-Host "Done."

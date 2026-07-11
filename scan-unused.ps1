$srcFiles = Get-ChildItem -Path "src" -Recurse -Include *.ts,*.tsx | Where-Object { $_.Name -ne 'main.tsx' -and $_.Name -ne 'App.tsx' }

$content = Get-ChildItem -Path "src" -Recurse -Include *.ts,*.tsx | ForEach-Object { Get-Content -Raw -Path $_.FullName } | Out-String

foreach ($file in $srcFiles) {
  $rel = $file.FullName.Replace((Get-Location).Path + '\', '')
  $imported = $false
  # search for any reference to the file's path or basename
  $basename = [IO.Path]::GetFileNameWithoutExtension($file.Name)
  if ($content -match [regex]::Escape($basename)) { $imported = $true }
  if (-not $imported) {
    Write-Host "UNUSED: $rel"
  }
}

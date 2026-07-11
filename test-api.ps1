$r = Invoke-WebRequest 'http://localhost:5174/api/file-tree' -UseBasicParsing
Write-Host 'status:' $r.StatusCode
Write-Host 'content length:' $r.Content.Length
Write-Host '--- first 500 chars ---'
Write-Host $r.Content.Substring(0, [Math]::Min(500, $r.Content.Length))

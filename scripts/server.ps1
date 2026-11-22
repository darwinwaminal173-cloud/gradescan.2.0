param([int]$port = 5173)

$dist = Join-Path $PSScriptRoot "..\dist"
if (!(Test-Path $dist)) {
    $dist = Join-Path $PSScriptRoot "dist"
}

$listener = New-Object System.Net.HttpListener
$prefix = "http://localhost:$port/"
$listener.Prefixes.Add($prefix)

try {
    $listener.Start()
} catch {
    $port = 5174
    $prefix = "http://localhost:$port/"
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add($prefix)
    $listener.Start()
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   SMARTGRADE OMR Scanner App Running!    " -ForegroundColor Green
Write-Host "   URL: $prefix" -ForegroundColor Yellow
Write-Host "==========================================" -ForegroundColor Cyan

Start-Process $prefix

$mime = @{
    ".html" = "text/html"
    ".js"   = "application/javascript"
    ".mjs"  = "application/javascript"
    ".css"  = "text/css"
    ".json" = "application/json"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".svg"  = "image/svg+xml"
    ".ico"  = "image/x-icon"
    ".wasm" = "application/wasm"
    ".webmanifest" = "application/manifest+json"
}

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response

    $urlPath = $request.Url.LocalPath.TrimStart('/')
    if ([string]::IsNullOrEmpty($urlPath)) {
        $urlPath = "index.html"
    }

    $filePath = Join-Path $dist $urlPath
    if (!(Test-Path $filePath -PathType Leaf)) {
        $filePath = Join-Path $dist "index.html"
    }

    $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
    $contentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { "application/octet-stream" }

    try {
        $bytes = [System.IO.File]::ReadAllBytes($filePath)
        $response.ContentType = $contentType
        $response.ContentLength64 = $bytes.Length
        $response.Headers.Add("Access-Control-Allow-Origin", "*")
        $response.OutputStream.Write($bytes, 0, $bytes.Length)
    } catch {
        $response.StatusCode = 500
    } finally {
        $response.OutputStream.Close()
    }
}

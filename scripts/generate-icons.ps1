Add-Type -AssemblyName System.Drawing

function Generate-Icon([int]$size, [string]$outPath, [bool]$isRound) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    $rect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)

    # Gradient background
    $c1 = [System.Drawing.Color]::FromArgb(255, 30, 64, 175) # #1e40af
    $c2 = [System.Drawing.Color]::FromArgb(255, 37, 99, 235) # #2563eb
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $c1, $c2, 45)

    if ($isRound) {
        $g.FillEllipse($brush, 2, 2, $size - 4, $size - 4)
    } else {
        $cornerRad = [int]($size * 0.22)
        $path = New-Object System.Drawing.Drawing2D.GraphicsPath
        $d = $cornerRad * 2
        $path.AddArc(2, 2, $d, $d, 180, 90)
        $path.AddArc($size - 2 - $d, 2, $d, $d, 270, 90)
        $path.AddArc($size - 2 - $d, $size - 2 - $d, $d, $d, 0, 90)
        $path.AddArc(2, $size - 2 - $d, $d, $d, 90, 90)
        $path.CloseFigure()
        $g.FillPath($brush, $path)
    }

    # Draw Scanner Frame corners (white)
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, [math]::Max(2, [int]($size * 0.05)))
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $margin = [int]($size * 0.22)
    $len = [int]($size * 0.15)

    # Top-Left
    $g.DrawLine($pen, $margin, $margin + $len, $margin, $margin)
    $g.DrawLine($pen, $margin, $margin, $margin + $len, $margin)
    # Top-Right
    $g.DrawLine($pen, $size - $margin - $len, $margin, $size - $margin, $margin)
    $g.DrawLine($pen, $size - $margin, $margin, $size - $margin, $margin + $len)
    # Bottom-Left
    $g.DrawLine($pen, $margin, $size - $margin - $len, $margin, $size - $margin)
    $g.DrawLine($pen, $margin, $size - $margin, $margin + $len, $size - $margin)
    # Bottom-Right
    $g.DrawLine($pen, $size - $margin - $len, $size - $margin, $size - $margin, $size - $margin)
    $g.DrawLine($pen, $size - $margin, $size - $margin - $len, $size - $margin, $size - $margin)

    # Draw Green Checkmark in center
    $checkPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 16, 185, 129), [math]::Max(3, [int]($size * 0.09)))
    $checkPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $checkPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $midX = [int]($size * 0.5)
    $midY = [int]($size * 0.5)

    $p1 = New-Object System.Drawing.Point([int]($midX - $size * 0.14), [int]($midY))
    $p2 = New-Object System.Drawing.Point([int]($midX - $size * 0.03), [int]($midY + $size * 0.12))
    $p3 = New-Object System.Drawing.Point([int]($midX + $size * 0.16), [int]($midY - $size * 0.12))

    $g.DrawLine($checkPen, $p1, $p2)
    $g.DrawLine($checkPen, $p2, $p3)

    $g.Dispose()
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

function Generate-Splash([string]$outPath) {
    $w = 480
    $h = 800
    $bmp = New-Object System.Drawing.Bitmap($w, $h)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

    # Deep blue gradient background
    $rect = New-Object System.Drawing.Rectangle(0, 0, $w, $h)
    $c1 = [System.Drawing.Color]::FromArgb(255, 15, 23, 42)  # slate-900
    $c2 = [System.Drawing.Color]::FromArgb(255, 30, 58, 138) # blue-900
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $c1, $c2, 90)
    $g.FillRectangle($brush, $rect)

    # Center Logo Icon
    $iconSize = 160
    $iconX = [int](($w - $iconSize) / 2)
    $iconY = [int]($h * 0.35)

    # Icon background
    $iconRect = New-Object System.Drawing.Rectangle($iconX, $iconY, $iconSize, $iconSize)
    $ic1 = [System.Drawing.Color]::FromArgb(255, 37, 99, 235)
    $ic2 = [System.Drawing.Color]::FromArgb(255, 29, 78, 216)
    $ibrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($iconRect, $ic1, $ic2, 45)
    $g.FillEllipse($ibrush, $iconRect)

    # Checkmark inside splash
    $checkPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 16, 185, 129), 12)
    $checkPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $checkPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $midX = $iconX + [int]($iconSize / 2)
    $midY = $iconY + [int]($iconSize / 2)

    $p1 = New-Object System.Drawing.Point([int]($midX - 25), [int]($midY))
    $p2 = New-Object System.Drawing.Point([int]($midX - 5), [int]($midY + 22))
    $p3 = New-Object System.Drawing.Point([int]($midX + 28), [int]($midY - 22))
    $g.DrawLine($checkPen, $p1, $p2)
    $g.DrawLine($checkPen, $p2, $p3)

    # App Title
    $fontTitle = New-Object System.Drawing.Font("Arial", 28, [System.Drawing.FontStyle]::Bold)
    $fontSub = New-Object System.Drawing.Font("Arial", 12, [System.Drawing.FontStyle]::Regular)
    $textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $subBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 148, 163, 184))

    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = [System.Drawing.StringAlignment]::Center

    $g.DrawString("SMARTGRADE", $fontTitle, $textBrush, [float]($w / 2), [float]($iconY + $iconSize + 25), $sf)
    $g.DrawString("High-Precision OMR Scanner & Grader", $fontSub, $subBrush, [float]($w / 2), [float]($iconY + $iconSize + 70), $sf)

    $g.Dispose()
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

$targets = @(
    "c:\Users\Laptop Factory\Downloads\app\android\app\src\main\res",
    "C:\Users\Laptop Factory\Desktop\app ng checker\android\app\src\main\res"
)

$sizes = @{
    "mipmap-mdpi"    = 48
    "mipmap-hdpi"    = 72
    "mipmap-xhdpi"   = 96
    "mipmap-xxhdpi"  = 144
    "mipmap-xxxhdpi" = 192
}

foreach ($base in $targets) {
    if (Test-Path $base) {
        foreach ($folder in $sizes.Keys) {
            $dir = Join-Path $base $folder
            if (!(Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
            $sz = $sizes[$folder]
            Generate-Icon $sz (Join-Path $dir "ic_launcher.png") $false
            Generate-Icon $sz (Join-Path $dir "ic_launcher_round.png") $true
            Generate-Icon $sz (Join-Path $dir "ic_launcher_foreground.png") $false
        }

        # Splash
        $drawableDir = Join-Path $base "drawable"
        Generate-Splash (Join-Path $drawableDir "splash.png")
        Write-Host "Generated icons and splash in: $base"
    }
}

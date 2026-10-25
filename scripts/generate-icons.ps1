<#
.SYNOPSIS
  Regenerates the Cicada Uninstaller icon set from a single source artwork.

.DESCRIPTION
  Takes the flat cicada mark (white artwork on a solid dark background) and produces:

    assets/icon.png            1024px transparent PNG  (primary app-icon source of truth)
    assets/icon.ico            multi-size Windows icon (16/20/24/32/40/48/64/128/256)
    assets/icon-light.ico      same mark re-inked for LIGHT surfaces
    src/gui/assets/icon.png    256px transparent PNG   (in-app header brand mark)

  Why two .ico files: the mark is a flat monochrome glyph, so a white mark vanishes on
  white surfaces. `main.js` picks between `icon.ico` (white, for dark window chrome /
  taskbars) and `icon-light.ico` (deep-slate ink, for light ones) from
  `nativeTheme.shouldUseDarkColors`, and swaps them live when the OS theme changes.

  The background is keyed out to full transparency and the mark is auto-cropped to its
  bounding box plus a margin, so the icon is optically centred at every size.

  Only the source artwork is required: `assets/icon-source.jpg`. Everything else is
  generated and committed, so a plain checkout/build never needs to run this.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/generate-icons.ps1
#>

[CmdletBinding()]
param(
  [string] $SourcePath,
  [string] $RepoRoot,
  # Luminance window used to key the flat background out. Anything at or below
  # $KeyLow becomes fully transparent, anything at or above $KeyHigh fully opaque,
  # and edges in between keep their anti-aliasing.
  [double] $KeyLow = 0.25,
  [double] $KeyHigh = 0.75,
  # Transparent padding around the auto-cropped mark, as a fraction of its longest edge.
  [double] $Margin = 0.06
)

$ErrorActionPreference = 'Stop'

if (-not $RepoRoot) { $RepoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path) }
if (-not $SourcePath) { $SourcePath = Join-Path $RepoRoot 'assets/icon-source.jpg' }

$SourcePath = [System.IO.Path]::GetFullPath($SourcePath)
if (-not (Test-Path -LiteralPath $SourcePath)) {
  throw "Source artwork not found: $SourcePath"
}

Add-Type -AssemblyName System.Drawing

# ---------------------------------------------------------------------------
# Image pipeline (compiled once for speed — a managed per-pixel loop is far too
# slow for a multi-megapixel source in an interpreted script).
# ---------------------------------------------------------------------------
$csharp = @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;

public static class CicadaIconFactory
{
    public static int LastMarkWidth;
    public static int LastMarkHeight;
    public static int LastCanvasSize;

    /// <summary>Keys the background out of the source artwork and returns a transparent,
    /// auto-cropped, square ARGB master bitmap inked in the requested colour.</summary>
    public static Bitmap BuildMaster(string sourcePath, double keyLow, double keyHigh, double margin,
                                     int inkR, int inkG, int inkB)
    {
        using (var src = new Bitmap(sourcePath))
        {
            int w = src.Width, h = src.Height;
            var rect = new Rectangle(0, 0, w, h);
            var data = src.LockBits(rect, ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
            byte[] px = new byte[w * h * 4];
            System.Runtime.InteropServices.Marshal.Copy(data.Scan0, px, 0, px.Length);
            src.UnlockBits(data);

            // Alpha-ramp on luminance. The artwork is white-on-dark, so the alpha
            // carries the shape and the colour is re-inked uniformly.
            double lo = keyLow * 255.0, hi = keyHigh * 255.0, span = hi - lo;
            int minX = w, minY = h, maxX = -1, maxY = -1;

            for (int y = 0; y < h; y++)
            {
                int row = y * w * 4;
                for (int x = 0; x < w; x++)
                {
                    int i = row + x * 4;
                    double lum = 0.2126 * px[i + 2] + 0.7152 * px[i + 1] + 0.0722 * px[i];
                    double a = span <= 0 ? (lum >= hi ? 1.0 : 0.0) : (lum - lo) / span;
                    if (a < 0.0) { a = 0.0; }
                    if (a > 1.0) { a = 1.0; }

                    if (a > 0.35)
                    {
                        if (x < minX) minX = x;
                        if (y < minY) minY = y;
                        if (x > maxX) maxX = x;
                        if (y > maxY) maxY = y;
                    }

                    px[i + 0] = (byte)inkB;
                    px[i + 1] = (byte)inkG;
                    px[i + 2] = (byte)inkR;
                    px[i + 3] = (byte)Math.Round(a * 255.0);
                }
            }

            if (maxX < 0) throw new InvalidOperationException("No artwork found: the source appears to be empty after background keying.");

            var keyed = new Bitmap(w, h, PixelFormat.Format32bppArgb);
            var keyedData = keyed.LockBits(rect, ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
            System.Runtime.InteropServices.Marshal.Copy(px, 0, keyedData.Scan0, px.Length);
            keyed.UnlockBits(keyedData);

            int markW = maxX - minX + 1, markH = maxY - minY + 1;
            int side = (int)Math.Round(Math.Max(markW, markH) * (1.0 + 2.0 * margin));

            LastMarkWidth = markW;
            LastMarkHeight = markH;
            LastCanvasSize = side;

            var master = new Bitmap(side, side, PixelFormat.Format32bppArgb);
            using (var g = Graphics.FromImage(master))
            {
                g.Clear(Color.Transparent);
                g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                g.SmoothingMode = SmoothingMode.HighQuality;
                g.CompositingQuality = CompositingQuality.HighQuality;

                int drawX = (side - markW) / 2, drawY = (side - markH) / 2;
                g.DrawImage(keyed,
                    new Rectangle(drawX, drawY, markW, markH),
                    new Rectangle(minX, minY, markW, markH),
                    GraphicsUnit.Pixel);
            }

            keyed.Dispose();
            return master;
        }
    }

    /// <summary>High-quality downscale to an exact square size.
    ///
    /// `cropInset` shrinks the source rectangle before scaling, which lets small sizes
    /// fill more of the box, and `alphaBoost` (&lt;1) thickens the anti-aliased strokes so a
    /// hairline drawing survives being averaged into a 16px grid.
    /// </summary>
    public static Bitmap Resize(Bitmap master, int size, double cropInset, double alphaBoost)
    {
        var outBmp = new Bitmap(size, size, PixelFormat.Format32bppArgb);
        using (var g = Graphics.FromImage(outBmp))
        {
            g.Clear(Color.Transparent);
            g.InterpolationMode = InterpolationMode.HighQualityBicubic;
            g.PixelOffsetMode = PixelOffsetMode.HighQuality;
            g.SmoothingMode = SmoothingMode.HighQuality;
            g.CompositingQuality = CompositingQuality.HighQuality;

            double inset = Math.Max(0.0, Math.Min(0.45, cropInset)) * master.Width;
            var src = new RectangleF(
                (float)inset, (float)inset,
                (float)(master.Width - 2.0 * inset), (float)(master.Height - 2.0 * inset));

            // Match the source rectangle to destination exactly so edge pixels are not clipped.
            g.DrawImage(master, new Rectangle(0, 0, size, size), src.X, src.Y, src.Width, src.Height, GraphicsUnit.Pixel);
        }

        if (alphaBoost > 0.0 && Math.Abs(alphaBoost - 1.0) > 0.001)
        {
            var rect = new Rectangle(0, 0, size, size);
            var data = outBmp.LockBits(rect, ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
            byte[] px = new byte[size * size * 4];
            System.Runtime.InteropServices.Marshal.Copy(data.Scan0, px, 0, px.Length);
            for (int i = 3; i < px.Length; i += 4)
            {
                if (px[i] == 0 || px[i] == 255) continue;
                double a = Math.Pow(px[i] / 255.0, alphaBoost);
                px[i] = (byte)Math.Round(a * 255.0);
            }
            System.Runtime.InteropServices.Marshal.Copy(px, 0, data.Scan0, px.Length);
            outBmp.UnlockBits(data);
        }

        return outBmp;
    }

    /// <summary>Encodes a bitmap to PNG bytes in memory.</summary>
    public static byte[] ToPngBytes(Bitmap bmp)
    {
        using (var ms = new MemoryStream())
        {
            bmp.Save(ms, ImageFormat.Png);
            return ms.ToArray();
        }
    }

    /// <summary>Writes a PNG-compressed multi-size .ico (supported by Windows Vista+ and Chromium).</summary>
    public static void WriteIco(string path, IList<byte[]> pngs, IList<int> sizes)
    {
        if (pngs.Count != sizes.Count) throw new ArgumentException("pngs/sizes length mismatch");

        using (var fs = new FileStream(path, FileMode.Create, FileAccess.Write))
        using (var bw = new BinaryWriter(fs))
        {
            bw.Write((ushort)0);                 // reserved
            bw.Write((ushort)1);                 // type: icon
            bw.Write((ushort)pngs.Count);        // image count

            int offset = 6 + 16 * pngs.Count;

            for (int i = 0; i < pngs.Count; i++)
            {
                int size = sizes[i];
                bw.Write((byte)(size >= 256 ? 0 : size));   // width  (0 == 256)
                bw.Write((byte)(size >= 256 ? 0 : size));   // height (0 == 256)
                bw.Write((byte)0);                          // palette count
                bw.Write((byte)0);                          // reserved
                bw.Write((ushort)1);                        // colour planes
                bw.Write((ushort)32);                       // bits per pixel
                bw.Write((uint)pngs[i].Length);             // payload size
                bw.Write((uint)offset);                     // payload offset
                offset += pngs[i].Length;
            }

            foreach (var png in pngs) { bw.Write(png); }
        }
    }
}
'@

Add-Type -TypeDefinition $csharp -ReferencedAssemblies 'System.Drawing' -Language CSharp

# ---------------------------------------------------------------------------
# Build the icon sets
# ---------------------------------------------------------------------------
$iconSizes = @(16, 20, 24, 32, 40, 48, 64, 128, 256)
$white    = @(255, 255, 255)
$slateInk = @(15, 23, 42)   # #0F172A — readable on light window chrome and taskbars

# Small sizes get a tighter crop (more of the box is mark) and a stroke boost, so the
# hairline legs and wing veins do not dissolve into grey mush on a 16px grid.
function Get-RenderTuning {
  param([int] $Size)
  if ($Size -le 20)  { return @{ Crop = 0.045; Boost = 0.62 } }
  if ($Size -le 32)  { return @{ Crop = 0.028; Boost = 0.75 } }
  if ($Size -le 48)  { return @{ Crop = 0.012; Boost = 0.88 } }
  return @{ Crop = 0.0; Boost = 1.0 }
}

function New-IcoFromMaster {
  param([System.Drawing.Bitmap] $Master, [string] $Path)
  $pngs  = New-Object 'System.Collections.Generic.List[byte[]]'
  $sizes = New-Object 'System.Collections.Generic.List[int]'
  foreach ($size in $iconSizes) {
    $tune = Get-RenderTuning -Size $size
    $resized = [CicadaIconFactory]::Resize($Master, $size, $tune.Crop, $tune.Boost)
    try { $pngs.Add([CicadaIconFactory]::ToPngBytes($resized)) } finally { $resized.Dispose() }
    $sizes.Add($size)
  }
  [CicadaIconFactory]::WriteIco($Path, $pngs, $sizes)
}

Write-Host "Source artwork : $SourcePath"

$master = [CicadaIconFactory]::BuildMaster($SourcePath, $KeyLow, $KeyHigh, $Margin, $white[0], $white[1], $white[2])
try {
  Write-Host ("Keyed mark     : {0}x{1}px  ->  {2}x{2}px master canvas" -f `
    [CicadaIconFactory]::LastMarkWidth, [CicadaIconFactory]::LastMarkHeight, [CicadaIconFactory]::LastCanvasSize)

  # Standalone PNGs, drawn from the white master.
  $pngTargets = [ordered]@{
    (Join-Path $RepoRoot 'assets/icon.png')          = 1024
    (Join-Path $RepoRoot 'src/gui/assets/icon.png')  = 256
  }

  foreach ($dest in $pngTargets.Keys) {
    $size = $pngTargets[$dest]
    $resized = [CicadaIconFactory]::Resize($master, $size, 0.0, 1.0)
    try {
      New-Item -ItemType Directory -Force -Path (Split-Path -Parent $dest) | Out-Null
      [System.IO.File]::WriteAllBytes($dest, [CicadaIconFactory]::ToPngBytes($resized))
      Write-Host ("  wrote {0} ({1}px, {2:N0} bytes)" -f (Resolve-Path -Relative $dest), $size, (Get-Item $dest).Length)
    } finally { $resized.Dispose() }
  }

  # Dark-surface icon (white mark) — window/tray when the OS prefers dark.
  $icoPath = Join-Path $RepoRoot 'assets/icon.ico'
  New-IcoFromMaster -Master $master -Path $icoPath
  Write-Host ("  wrote {0} ({1} sizes, {2:N0} bytes)" -f (Resolve-Path -Relative $icoPath), $iconSizes.Count, (Get-Item $icoPath).Length)
} finally {
  $master.Dispose()
}

# Light-surface icon (slate ink) — window/tray when the OS prefers light.
$lightMaster = [CicadaIconFactory]::BuildMaster($SourcePath, $KeyLow, $KeyHigh, $Margin, $slateInk[0], $slateInk[1], $slateInk[2])
try {
  $lightIcoPath = Join-Path $RepoRoot 'assets/icon-light.ico'
  New-IcoFromMaster -Master $lightMaster -Path $lightIcoPath
  Write-Host ("  wrote {0} ({1} sizes, {2:N0} bytes)" -f (Resolve-Path -Relative $lightIcoPath), $iconSizes.Count, (Get-Item $lightIcoPath).Length)
} finally {
  $lightMaster.Dispose()
}

Write-Host 'Icon set regenerated.'

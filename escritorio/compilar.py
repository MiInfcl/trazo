"""Compila Trazo.exe con el csc.exe que trae Windows. Uso: python escritorio/compilar.py
Descarga una vez el paquete oficial de WebView2 desde NuGet y deja el resultado en entregables/."""
import hashlib
import io
import os
import subprocess
import tempfile
import urllib.request
import zipfile
from pathlib import Path

from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent
HERR = RAIZ / "herramientas" / "wv2"
SALIDA = RAIZ / "entregables" / "Trazo.exe"
VERSION = "1.0.4191.47"
CSC = Path(r"C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe")
WPF = Path(r"C:\Windows\Microsoft.NET\Framework64\v4.0.30319\WPF")
EDGE = Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe")
DLLS = {
    "lib/net462/Microsoft.Web.WebView2.Core.dll": "Microsoft.Web.WebView2.Core.dll",
    "lib/net462/Microsoft.Web.WebView2.WinForms.dll": "Microsoft.Web.WebView2.WinForms.dll",
    "runtimes/win-x64/native/WebView2Loader.dll": "WebView2Loader.dll",
}


def preparar_webview2():
    if all((HERR / n).exists() for n in DLLS.values()):
        return
    HERR.mkdir(parents=True, exist_ok=True)
    url = f"https://api.nuget.org/v3-flatcontainer/microsoft.web.webview2/{VERSION}/microsoft.web.webview2.{VERSION}.nupkg"
    print("Descargando WebView2", VERSION)
    with urllib.request.urlopen(url) as r:
        datos = r.read()
    (HERR / "paquete.sha256").write_text(hashlib.sha256(datos).hexdigest())
    with zipfile.ZipFile(io.BytesIO(datos)) as z:
        for origen, destino in DLLS.items():
            (HERR / destino).write_bytes(z.read(origen))


def comprimir_app(destino):
    with zipfile.ZipFile(destino, "w", zipfile.ZIP_DEFLATED) as z:
        for f in sorted((RAIZ / "app").rglob("*")):
            if f.is_file():
                z.write(f, f.relative_to(RAIZ / "app").as_posix())


def crear_icono(destino, tmp):
    """Dibuja icono.svg con Edge y arma un .ico de varias resoluciones."""
    html = Path(tmp) / "i.html"
    url = (RAIZ / "app" / "img" / "icono.svg").as_uri()
    html.write_text(f'<!doctype html><style>html,body{{margin:0;background:transparent}}img{{display:block;width:256px;height:256px}}</style><img src="{url}">')
    png = Path(tmp) / "i.png"
    subprocess.run([str(EDGE), "--headless=new", "--disable-gpu", "--allow-file-access-from-files", f"--user-data-dir={tmp}\\edge",
                    "--default-background-color=00000000", "--hide-scrollbars", "--window-size=256,256", f"--screenshot={png}", html.as_uri()],
                   check=True, capture_output=True, timeout=90)
    with Image.open(png) as im:
        im.convert("RGBA").save(destino, format="ICO", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])


def main():
    preparar_webview2()
    SALIDA.parent.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        zip_app = Path(tmp) / "app.zip"
        ico = Path(tmp) / "trazo.ico"
        comprimir_app(zip_app)
        crear_icono(ico, tmp)
        recursos = [f"/resource:{zip_app},app.zip"] + [f"/resource:{HERR / n},{n}" for n in DLLS.values()]
        refs = [f"/r:{HERR / 'Microsoft.Web.WebView2.Core.dll'}", f"/r:{HERR / 'Microsoft.Web.WebView2.WinForms.dll'}"]
        refs += ["/r:System.Windows.Forms.dll", "/r:System.Drawing.dll", "/r:System.Web.Extensions.dll", "/r:System.IO.Compression.dll",
                 f"/r:{WPF / 'PresentationCore.dll'}", f"/r:{WPF / 'WindowsBase.dll'}", "/r:System.Xaml.dll"]
        cmd = [str(CSC), "/nologo", "/target:winexe", "/platform:x64", "/optimize+", f"/out:{SALIDA}", f"/win32icon:{ico}", *refs, *recursos,
               str(RAIZ / "escritorio" / "Trazo.cs")]
        r = subprocess.run(cmd, capture_output=True, text=True, encoding="oem", errors="replace")
        print(r.stdout)
        if r.returncode:
            raise SystemExit(r.stderr or "csc falló")
    print("Listo:", SALIDA, f"{os.path.getsize(SALIDA) / 1048576:.1f} MB")


if __name__ == "__main__":
    main()

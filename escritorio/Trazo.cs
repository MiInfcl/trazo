// Trazo · ventana de escritorio. Muestra la app web con WebView2 y le da acceso a los archivos de Windows.
// Se compila con el csc.exe que trae Windows (C# 5); ver compilar.py.
using System;
using System.Collections;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using System.Windows.Media.Imaging;
using Microsoft.Win32;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

[assembly: AssemblyTitle("Trazo")]
[assembly: AssemblyProduct("Trazo")]
[assembly: AssemblyDescription("Editor de imágenes sin inteligencia artificial")]
[assembly: AssemblyVersion("1.0.0.0")]
[assembly: AssemblyFileVersion("1.0.0.0")]

static class Program
{
    public static string BaseDir;

    [STAThread]
    static void Main(string[] args)
    {
        AppDomain.CurrentDomain.AssemblyResolve += ResolveEmbedded;
        BaseDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Trazo");
        Directory.CreateDirectory(BaseDir);
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Start(args);
    }

    // En un método aparte: así las DLL de WebView2 se cargan después de instalar ResolveEmbedded.
    [MethodImpl(MethodImplOptions.NoInlining)]
    static void Start(string[] args) { Application.Run(new MainForm(args)); }

    static Assembly ResolveEmbedded(object sender, ResolveEventArgs e)
    {
        string name = new AssemblyName(e.Name).Name + ".dll";
        byte[] data = Resource(name);
        return data == null ? null : Assembly.Load(data);
    }

    public static byte[] Resource(string name)
    {
        using (Stream s = Assembly.GetExecutingAssembly().GetManifestResourceStream(name))
        {
            if (s == null) return null;
            using (MemoryStream m = new MemoryStream()) { s.CopyTo(m); return m.ToArray(); }
        }
    }

    /// Descomprime la app una vez por versión; devuelve su carpeta.
    public static string PrepareApp()
    {
        byte[] zip = Resource("app.zip");
        string hash;
        using (SHA1 sha = SHA1.Create()) hash = BitConverter.ToString(sha.ComputeHash(zip)).Replace("-", "").Substring(0, 12).ToLowerInvariant();
        string dir = Path.Combine(BaseDir, "app-" + hash);
        if (!Directory.Exists(dir))
        {
            string tmp = dir + ".tmp";
            if (Directory.Exists(tmp)) Directory.Delete(tmp, true);
            using (MemoryStream m = new MemoryStream(zip))
            using (ZipArchive a = new ZipArchive(m, ZipArchiveMode.Read))
                foreach (ZipArchiveEntry en in a.Entries)
                {
                    if (string.IsNullOrEmpty(en.Name)) continue;
                    string target = Path.Combine(tmp, en.FullName.Replace('/', '\\'));
                    Directory.CreateDirectory(Path.GetDirectoryName(target));
                    using (Stream i = en.Open())
                    using (FileStream o = File.Create(target)) i.CopyTo(o);
                }
            Directory.Move(tmp, dir);
        }
        foreach (string old in Directory.GetDirectories(BaseDir, "app-*"))
            if (!string.Equals(old, dir, StringComparison.OrdinalIgnoreCase))
                try { Directory.Delete(old, true); } catch (IOException) { } catch (UnauthorizedAccessException) { }
        return dir;
    }

    public static string PrepareLoader()
    {
        string dir = Path.Combine(BaseDir, "bin");
        Directory.CreateDirectory(dir);
        string path = Path.Combine(dir, "WebView2Loader.dll");
        byte[] data = Resource("WebView2Loader.dll");
        if (!File.Exists(path) || new FileInfo(path).Length != data.Length) File.WriteAllBytes(path, data);
        return dir;
    }
}

sealed class MainForm : Form
{
    const string Origin = "https://trazo.example/";
    readonly WebView2 web = new WebView2();
    readonly JavaScriptSerializer json = new JavaScriptSerializer { MaxJsonLength = int.MaxValue };
    readonly string[] args;
    bool ready, allowClose;

    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern bool SystemParametersInfo(uint action, uint param, string value, uint flags);
    [DllImport("dwmapi.dll")]
    static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int value, int size);

    public MainForm(string[] args)
    {
        this.args = args;
        Text = "Trazo";
        ClientSize = new Size(1280, 800);
        MinimumSize = new Size(640, 480);
        StartPosition = FormStartPosition.CenterScreen;
        try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch (ArgumentException) { }
        BackColor = SystemDark() ? Color.FromArgb(32, 32, 32) : Color.FromArgb(243, 243, 243);
        web.Dock = DockStyle.Fill;
        web.DefaultBackgroundColor = BackColor;
        Controls.Add(web);
        Load += async delegate { await Init(); };
    }

    static bool SystemDark()
    {
        object v = Registry.GetValue(@"HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize", "AppsUseLightTheme", 1);
        return v is int && (int)v == 0;
    }

    protected override void OnHandleCreated(EventArgs e)
    {
        base.OnHandleCreated(e);
        int on = SystemDark() ? 1 : 0;
        try { DwmSetWindowAttribute(Handle, 20, ref on, sizeof(int)); } catch (DllNotFoundException) { }
    }

    async System.Threading.Tasks.Task Init()
    {
        try
        {
            CoreWebView2Environment.SetLoaderDllFolderPath(Program.PrepareLoader());
            string app = Program.PrepareApp();
            CoreWebView2Environment env = await CoreWebView2Environment.CreateAsync(null, Path.Combine(Program.BaseDir, "datos"));
            await web.EnsureCoreWebView2Async(env);
            CoreWebView2 c = web.CoreWebView2;
            c.Settings.AreDevToolsEnabled = false;
            c.Settings.IsStatusBarEnabled = false;
            c.Settings.AreBrowserAcceleratorKeysEnabled = false;
            c.Settings.AreDefaultContextMenusEnabled = false;
            c.Settings.IsZoomControlEnabled = false;
            c.SetVirtualHostNameToFolderMapping("trazo.example", app, CoreWebView2HostResourceAccessKind.Deny);
            c.WebMessageReceived += OnMessage;
            c.NewWindowRequested += delegate (object s, CoreWebView2NewWindowRequestedEventArgs e) { e.Handled = true; };
            c.NavigationStarting += delegate (object s, CoreWebView2NavigationStartingEventArgs e)
            {
                if (!e.Uri.StartsWith(Origin, StringComparison.OrdinalIgnoreCase)) e.Cancel = true;
            };
            c.PermissionRequested += delegate (object s, CoreWebView2PermissionRequestedEventArgs e)
            {
                if (e.PermissionKind == CoreWebView2PermissionKind.ClipboardRead) e.State = CoreWebView2PermissionState.Allow;
            };
            c.Navigate(Origin + "index.html");
            ready = true;
        }
        catch (WebView2RuntimeNotFoundException)
        {
            MessageBox.Show(this, "Trazo necesita Microsoft Edge WebView2, que viene con Windows 11. Instálalo desde el sitio de Microsoft y vuelve a abrir la aplicación.", "Trazo", MessageBoxButtons.OK, MessageBoxIcon.Error);
            Close();
        }
    }

    protected override void OnFormClosing(FormClosingEventArgs e)
    {
        if (ready && !allowClose && e.CloseReason == CloseReason.UserClosing)
        {
            e.Cancel = true; // la página pregunta si hay cambios sin guardar
            Post(new Dictionary<string, object> { { "event", "close" } });
        }
        base.OnFormClosing(e);
    }

    void Post(object o) { web.CoreWebView2.PostWebMessageAsString(json.Serialize(o)); }

    void OnMessage(object sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        string text = e.TryGetWebMessageAsString();
        // Fuera del evento: abrir un diálogo modal dentro de él puede bloquear WebView2.
        BeginInvoke(new Action(delegate { Dispatch(text); }));
    }

    void Dispatch(string text)
    {
        Dictionary<string, object> msg = json.Deserialize<Dictionary<string, object>>(text);
        Dictionary<string, object> reply = new Dictionary<string, object>();
        reply["id"] = msg["id"];
        try { reply["result"] = Call((string)msg["method"], (Dictionary<string, object>)msg["args"]); }
        catch (Exception ex) { reply["error"] = ex.Message; }
        Post(reply);
    }

    static Dictionary<string, object> FileInfoOf(string path)
    {
        byte[] b = File.ReadAllBytes(path);
        return new Dictionary<string, object> {
            { "name", Path.GetFileName(path) }, { "path", path }, { "size", b.Length }, { "b64", Convert.ToBase64String(b) }
        };
    }

    object Call(string method, Dictionary<string, object> a)
    {
        switch (method)
        {
            case "openDialog":
                using (OpenFileDialog d = new OpenFileDialog { Filter = (string)a["filter"], Multiselect = (bool)a["multiple"] })
                {
                    ArrayList list = new ArrayList();
                    if (d.ShowDialog(this) == DialogResult.OK) foreach (string f in d.FileNames) list.Add(FileInfoOf(f));
                    return list;
                }
            case "saveDialog":
                using (SaveFileDialog d = new SaveFileDialog { Filter = (string)a["filter"], FileName = (string)a["name"], OverwritePrompt = true, AddExtension = true })
                {
                    if (d.ShowDialog(this) != DialogResult.OK) return null;
                    return new Dictionary<string, object> { { "name", Path.GetFileName(d.FileName) }, { "path", d.FileName } };
                }
            case "writeFile":
                {
                    string path = (string)a["path"], tmp = path + ".trazo-tmp";
                    File.WriteAllBytes(tmp, Convert.FromBase64String((string)a["b64"]));
                    if (File.Exists(path)) File.Replace(tmp, path, null); else File.Move(tmp, path);
                    return true;
                }
            case "readFile":
                return FileInfoOf((string)a["path"]);
            case "setTitle":
                Text = (string)a["title"];
                return true;
            case "startupFiles":
                {
                    ArrayList list = new ArrayList();
                    foreach (string f in args) if (File.Exists(f)) list.Add(FileInfoOf(Path.GetFullPath(f)));
                    return list;
                }
            case "decodeImage":
                return new Dictionary<string, object> { { "png", DecodeWithWindows((string)a["b64"]) } };
            case "setWallpaper":
                SetWallpaper(Convert.FromBase64String((string)a["b64"]), (string)a["mode"]);
                return true;
            case "forceClose":
                allowClose = true;
                BeginInvoke(new Action(Close));
                return true;
            default:
                throw new InvalidOperationException("Función desconocida: " + method);
        }
    }

    /// Abre con los códecs de Windows lo que el navegador no sabe leer (HEIC, si está instalada la extensión).
    static string DecodeWithWindows(string b64)
    {
        try
        {
            using (MemoryStream input = new MemoryStream(Convert.FromBase64String(b64)))
            {
                BitmapDecoder dec = BitmapDecoder.Create(input, BitmapCreateOptions.None, BitmapCacheOption.OnLoad);
                PngBitmapEncoder enc = new PngBitmapEncoder();
                enc.Frames.Add(BitmapFrame.Create(dec.Frames[0]));
                using (MemoryStream output = new MemoryStream()) { enc.Save(output); return Convert.ToBase64String(output.ToArray()); }
            }
        }
        catch (NotSupportedException) { throw new InvalidOperationException("Windows no tiene el códec de este formato. Para HEIC, instala «Extensiones de imagen HEIF» desde Microsoft Store."); }
        catch (FileFormatException) { throw new InvalidOperationException("Windows no pudo leer este archivo. Para HEIC, instala «Extensiones de imagen HEIF» desde Microsoft Store."); }
    }

    static void SetWallpaper(byte[] bmp, string mode)
    {
        string path = Path.Combine(Program.BaseDir, "fondo.bmp");
        File.WriteAllBytes(path, bmp);
        using (RegistryKey k = Registry.CurrentUser.OpenSubKey(@"Control Panel\Desktop", true))
        {
            k.SetValue("WallpaperStyle", mode == "fill" ? "10" : "0");
            k.SetValue("TileWallpaper", mode == "tile" ? "1" : "0");
        }
        if (!SystemParametersInfo(20, 0, path, 3)) throw new InvalidOperationException("Windows rechazó el cambio de fondo.");
    }
}

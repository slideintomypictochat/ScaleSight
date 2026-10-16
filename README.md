# ScaleSight – plugin project

A music-theory helper plugin (VST3 for FL Studio, Ableton and most other DAWs; AU too on a Mac).
It listens to the notes you play, shows the chord, the key and what fits, and passes the MIDI
straight through so your synth still plays. It makes no sound itself.

## What's in this folder

| File | What it is |
|---|---|
| `CMakeLists.txt` | The build recipe. It downloads JUCE (the plugin framework) automatically. |
| `Source/PluginProcessor.*` | The audio side: tracks held notes, passes MIDI through, saves your settings in the project. |
| `Source/PluginEditor.*` | The window: shows the interface and passes messages to and from it. |
| `ui/index.html` | The whole interface, baked into the plugin. You can also open it in Chrome as a preview. |
| `ui/plugin.html`, `ui/engine.js`, `ui/plugin-app.js` | The interface's source. `ui/build_ui.py` combines them into `index.html`. |
| `.github/workflows/build.yml` | Lets GitHub build the Windows plugin for you (Option A below). |

---

## Step 1: Build the plugin

### Option A – let GitHub build it (easiest, nothing to install)

1. Make a free account at github.com.
2. Click **+** (top right) → **New repository**. Name it `ScaleSight`, choose **Private**, click **Create repository**.
3. On the new page, click **uploading an existing file**. Drag in **everything inside this folder**,
   including the hidden `.github` folder. (On Windows, turn on *View → Show → Hidden items* to see it.)
   Click **Commit changes**.
4. Open the **Actions** tab. A build called "Build ScaleSight" starts by itself and takes about 10–15 minutes.
5. When it shows a green tick, click it and download **ScaleSight-Windows** at the bottom of the page.
   Unzip it. Inside is `VST3/ScaleSight.vst3` and `ScaleSight.exe`.

If the build fails (red cross), click it, copy the red error text and send it to Claude.

### Option B – build on your own PC

1. Install **Visual Studio 2022 Community** (free). In the installer, tick **Desktop development with C++**.
2. Install **Git for Windows** (git-scm.com), keeping the default options.
3. Open **PowerShell** and run these two lines once (they install the WebView2 package the window needs):
   ```
   Register-PackageSource -ProviderName NuGet -Name nugetRepository -Location https://www.nuget.org/api/v2 -Force
   Install-Package Microsoft.Web.WebView2 -Scope CurrentUser -RequiredVersion 1.0.1901.177 -Source nugetRepository -Force
   ```
4. Open **Developer PowerShell for VS 2022** from the Start menu, go to this folder (`cd path\to\ScaleSight`) and run:
   ```
   cmake -B build
   cmake --build build --config Release --target ScaleSight_VST3 ScaleSight_Standalone
   ```
   The first run downloads JUCE and takes a while. The plugin ends up in
   `build\ScaleSight_artefacts\Release\VST3\ScaleSight.vst3`.

## Step 2: Install it

Copy the whole `ScaleSight.vst3` folder into `C:\Program Files\Common Files\VST3`
(Windows will ask for permission; click **Continue**).

To try it without a DAW, run `ScaleSight.exe`, click **Options** → **Audio/MIDI Settings**
and tick your MIDI keyboard.

---

## Step 3: Use it in FL Studio

1. **Options → Manage plugins → Find plugins**. ScaleSight appears under *Generators*.
2. Add **ScaleSight** to the Channel Rack, plus the synth you want to play.

**Playing a MIDI keyboard into both at once**

1. **Options → MIDI Settings**: select your keyboard under *Input* and set its **Port** to `1`.
2. Open ScaleSight, click the **cog** (wrapper settings) → **MIDI** → set **Input port** to `1`.
3. Do the same on your synth. Both now hear your keyboard, whichever channel is selected.

**Using the piano roll** (notes go through ScaleSight to the synth)

1. ScaleSight's cog → **MIDI** → set **Output port** to `2`.
2. Your synth's cog → **MIDI** → set **Input port** to `2`.
3. Draw notes in ScaleSight's piano roll. ScaleSight shows them and passes them on to the synth.

Clicking keys on ScaleSight's on-screen keyboard also sends those notes out, so the synth plays them.

## Step 3 (alternative): Use it in Ableton Live

1. **Preferences → Plug-Ins**: turn on **Use VST3 Plug-In System Folders**, then **Rescan**.
2. Drag **ScaleSight** onto its own MIDI track. Put your synth on a second MIDI track.
3. **Playing your keyboard**: arm both tracks (Ctrl+click the arm buttons).
4. **Using clips**: put the clip on the ScaleSight track. On the synth track set
   **MIDI From** → the ScaleSight track → **ScaleSight**, and **Monitor** → **In**.

---

## Good to know

- **Settings are saved in your project**: mode, chosen key, one-octave view and window size.
- **The analysis runs in the window.** It needs the ScaleSight window to have been opened in the
  session. Moving the theory engine into the audio side is planned for the Launchkey stage.
- **Info for controller scripts**: ScaleSight publishes four read-only parameters
  (Key, Mode, Chord root, Chord type). A future FL Studio / Launchkey script will read these to
  put the key and chord on the keyboard's screen. They are hidden from automation.
- **Changing the interface**: edit the files in `ui/`, run `python ui/build_ui.py`, then rebuild.
- **Personal use**: JUCE is free for personal projects like this one.

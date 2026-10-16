#include "PluginEditor.h"
#include "BinaryData.h"

ScaleSightEditor::ScaleSightEditor (ScaleSightProcessor& p)
    : AudioProcessorEditor (&p), proc (p), web (makeOptions())
{
    addAndMakeVisible (web);

    setResizable (true, true);
    setResizeLimits (820, 560, 1800, 1200);
    setSize (proc.editorWidth, proc.editorHeight);

    web.goToURL (juce::WebBrowserComponent::getResourceProviderRoot());
    startTimerHz (30);
}

juce::WebBrowserComponent::Options ScaleSightEditor::makeOptions()
{
    using Options = juce::WebBrowserComponent::Options;

    // DAWs live in Program Files, which WebView2 can't write to, so give it a temp folder.
    const auto webviewData = juce::File::getSpecialLocation (juce::File::tempDirectory)
                                 .getChildFile ("ScaleSightWebView2");

    return Options{}
        .withBackend (Options::Backend::webview2)
        .withWinWebView2Options (Options::WinWebView2{}
                                     .withUserDataFolder (webviewData)
                                     .withBackgroundColour (juce::Colour (0xff0e131c)))
        .withNativeIntegrationEnabled()
        .withKeepPageLoadedWhenBrowserIsHidden()
        .withResourceProvider ([] (const juce::String& url) { return getResource (url); })

        .withEventListener ("ready", [this] (juce::var) { onPageReady(); })

        .withEventListener ("uiNote", [this] (juce::var v)
        {
            proc.addUiNote ((int) v.getProperty ("note", -1), (bool) v.getProperty ("on", false));
        })

        .withEventListener ("uiState", [this] (juce::var v)
        {
            proc.setUiState (juce::JSON::toString (v, true));
        })

        .withEventListener ("info", [this] (juce::var v)
        {
            proc.publishInfo ((int) v.getProperty ("key", 0),
                              (int) v.getProperty ("mode", 0),
                              (int) v.getProperty ("chordRoot", 0),
                              (int) v.getProperty ("chordType", 0));
        });
}

std::optional<juce::WebBrowserComponent::Resource> ScaleSightEditor::getResource (const juce::String& url)
{
    const auto path = url.fromFirstOccurrenceOf ("/", false, false);   // "" or "index.html"

    if (path.isEmpty() || path == "index.html")
    {
        const auto* bytes = reinterpret_cast<const std::byte*> (BinaryData::index_html);
        return juce::WebBrowserComponent::Resource {
            std::vector<std::byte> (bytes, bytes + BinaryData::index_htmlSize),
            "text/html; charset=utf-8" };
    }

    return std::nullopt;
}

void ScaleSightEditor::onPageReady()
{
    pageReady = true;

    // Restore the settings saved in your project.
    const auto saved = juce::JSON::parse (proc.getUiState());
    if (saved.isObject())
        web.emitEventIfBrowserIsVisible ("state", saved);

    sendHeldNotes();
}

void ScaleSightEditor::timerCallback()
{
    if (pageReady && proc.heldVersion.load() != lastVersion)
        sendHeldNotes();
}

void ScaleSightEditor::sendHeldNotes()
{
    lastVersion = proc.heldVersion.load();

    juce::Array<juce::var> notes;
    for (int n = 0; n < 128; ++n)
        if (proc.held[(size_t) n].load())
            notes.add (n);

    auto* obj = new juce::DynamicObject();
    obj->setProperty ("held", notes);
    web.emitEventIfBrowserIsVisible ("notes", juce::var (obj));
}

void ScaleSightEditor::paint (juce::Graphics& g)
{
    g.fillAll (juce::Colour (0xff0e131c));
}

void ScaleSightEditor::resized()
{
    web.setBounds (getLocalBounds());
    proc.editorWidth  = getWidth();
    proc.editorHeight = getHeight();
}

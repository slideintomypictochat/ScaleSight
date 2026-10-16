#pragma once
#include "PluginProcessor.h"

/*  ScaleSight's window.
    The interface is the same HTML/JavaScript as the browser prototype, shown in a built-in
    web view (Edge WebView2 on Windows, WebKit on Mac). This file just passes messages
    between that page and the audio side:
      plugin -> page : "notes" (held keys), "state" (saved settings)
      page -> plugin : "ready", "uiNote" (clicked keys), "uiState" (settings), "info" (key/chord)
*/
class ScaleSightEditor : public juce::AudioProcessorEditor,
                         private juce::Timer
{
public:
    explicit ScaleSightEditor (ScaleSightProcessor&);
    ~ScaleSightEditor() override = default;

    void paint (juce::Graphics&) override;
    void resized() override;

private:
    void timerCallback() override;
    void sendHeldNotes();
    void onPageReady();

    static std::optional<juce::WebBrowserComponent::Resource> getResource (const juce::String& url);
    juce::WebBrowserComponent::Options makeOptions();

    ScaleSightProcessor& proc;
    juce::WebBrowserComponent web;
    uint32_t lastVersion = 0;
    bool pageReady = false;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (ScaleSightEditor)
};

#pragma once
#include <juce_audio_utils/juce_audio_utils.h>
#include <array>
#include <atomic>

/*  ScaleSight's audio side.
    It makes no sound. Every block it:
      1. adds any notes you clicked on the plugin's keyboard to the MIDI stream,
      2. notes which keys are currently held, for the window to show,
      3. passes all MIDI straight through, so a synth after it still plays.
*/
class ScaleSightProcessor : public juce::AudioProcessor
{
public:
    ScaleSightProcessor();

    void prepareToPlay (double sampleRate, int) override;
    void releaseResources() override {}
    bool isBusesLayoutSupported (const BusesLayout&) const override;
    void processBlock (juce::AudioBuffer<float>&, juce::MidiBuffer&) override;
    using AudioProcessor::processBlock;

    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override                  { return true; }

    const juce::String getName() const override      { return "ScaleSight"; }
    bool acceptsMidi() const override                { return true; }
    bool producesMidi() const override               { return true; }
    bool isMidiEffect() const override               { return false; }
    double getTailLengthSeconds() const override     { return 0.0; }

    int getNumPrograms() override                    { return 1; }
    int getCurrentProgram() override                 { return 0; }
    void setCurrentProgram (int) override            {}
    const juce::String getProgramName (int) override { return {}; }
    void changeProgramName (int, const juce::String&) override {}

    void getStateInformation (juce::MemoryBlock&) override;
    void setStateInformation (const void*, int) override;

    //==== Shared with the window ===============================================
    /** Notes currently held (0-127). Written by the audio thread, read by the window. */
    std::array<std::atomic<bool>, 128> held {};
    std::atomic<uint32_t> heldVersion { 0 };

    /** Called by the window when you click a key, so the note is also sent on to your synth. */
    void addUiNote (int note, bool isOn);

    /** The window's settings (mode, chosen key, one-octave view...) saved in your project. */
    juce::String getUiState() const;
    void setUiState (const juce::String& json);

    /** Read-only values a DAW controller script can read (e.g. for the Launchkey screen). */
    void publishInfo (int key, int mode, int chordRoot, int chordType);

    int editorWidth = 980, editorHeight = 640;

private:
    juce::MidiMessageCollector uiNotes;
    std::atomic<bool> prepared { false };

    mutable juce::CriticalSection stateLock;
    juce::String uiState;

    juce::AudioParameterInt* pKey       = nullptr;   // 0 none, 1-12 major C..B, 13-24 minor C..B
    juce::AudioParameterInt* pMode      = nullptr;   // 0 Scale, 1 Key, 2 Flow
    juce::AudioParameterInt* pChordRoot = nullptr;   // 0 none, 1-12 C..B
    juce::AudioParameterInt* pChordType = nullptr;   // 0 none, else index in the chord list

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (ScaleSightProcessor)
};

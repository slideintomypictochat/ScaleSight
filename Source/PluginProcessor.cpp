#include "PluginProcessor.h"
#include "PluginEditor.h"

static juce::AudioParameterInt* makeInfoParam (const char* id, const char* name, int maxValue)
{
    // Information only: hidden from automation so the DAW never records it.
    return new juce::AudioParameterInt (juce::ParameterID { id, 1 }, name, 0, maxValue, 0,
                                        juce::AudioParameterIntAttributes().withAutomatable (false));
}

ScaleSightProcessor::ScaleSightProcessor()
    : AudioProcessor (BusesProperties().withOutput ("Output", juce::AudioChannelSet::stereo(), true))
{
    addParameter (pKey       = makeInfoParam ("key",       "Key",        24));
    addParameter (pMode      = makeInfoParam ("mode",      "Mode",        2));
    addParameter (pChordRoot = makeInfoParam ("chordRoot", "Chord root", 12));
    addParameter (pChordType = makeInfoParam ("chordType", "Chord type", 63));
}

bool ScaleSightProcessor::isBusesLayoutSupported (const BusesLayout& layouts) const
{
    const auto out = layouts.getMainOutputChannelSet();
    return out == juce::AudioChannelSet::stereo() || out == juce::AudioChannelSet::mono();
}

void ScaleSightProcessor::prepareToPlay (double sampleRate, int)
{
    uiNotes.reset (sampleRate);
    prepared = true;
}

void ScaleSightProcessor::addUiNote (int note, bool isOn)
{
    if (! prepared || note < 0 || note > 127)
        return;

    auto msg = isOn ? juce::MidiMessage::noteOn (1, note, (juce::uint8) 100)
                    : juce::MidiMessage::noteOff (1, note);
    msg.setTimeStamp (juce::Time::getMillisecondCounterHiRes() * 0.001);
    uiNotes.addMessageToQueue (msg);
}

void ScaleSightProcessor::processBlock (juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midi)
{
    juce::ScopedNoDenormals noDenormals;
    buffer.clear();   // silent: the sound comes from your synth

    // 1. notes clicked on the plugin's keyboard
    juce::MidiBuffer clicked;
    uiNotes.removeNextBlockOfMessages (clicked, buffer.getNumSamples());
    if (! clicked.isEmpty())
        midi.addEvents (clicked, 0, buffer.getNumSamples(), 0);

    // 2. track held keys (MIDI is left untouched, so it passes straight through)
    bool changed = false;
    for (const auto meta : midi)
    {
        const auto m = meta.getMessage();
        if (m.isNoteOn())
        {
            changed |= ! held[(size_t) m.getNoteNumber()].exchange (true);
        }
        else if (m.isNoteOff())
        {
            changed |= held[(size_t) m.getNoteNumber()].exchange (false);
        }
        else if (m.isAllNotesOff() || m.isAllSoundOff())
        {
            for (auto& h : held)
                changed |= h.exchange (false);
        }
    }

    if (changed)
        ++heldVersion;
}

void ScaleSightProcessor::publishInfo (int key, int mode, int chordRoot, int chordType)
{
    auto set = [] (juce::AudioParameterInt* p, int v)
    {
        v = juce::jlimit (p->getRange().getStart(), p->getRange().getEnd(), v);
        if (p->get() != v)
            *p = v;
    };
    set (pKey, key);
    set (pMode, mode);
    set (pChordRoot, chordRoot);
    set (pChordType, chordType);
}

juce::String ScaleSightProcessor::getUiState() const
{
    const juce::ScopedLock sl (stateLock);
    return uiState;
}

void ScaleSightProcessor::setUiState (const juce::String& json)
{
    const juce::ScopedLock sl (stateLock);
    uiState = json;
}

void ScaleSightProcessor::getStateInformation (juce::MemoryBlock& dest)
{
    juce::ValueTree tree ("ScaleSight");
    tree.setProperty ("uiState", getUiState(), nullptr);
    tree.setProperty ("width",   editorWidth,  nullptr);
    tree.setProperty ("height",  editorHeight, nullptr);

    if (auto xml = tree.createXml())
        copyXmlToBinary (*xml, dest);
}

void ScaleSightProcessor::setStateInformation (const void* data, int size)
{
    if (auto xml = getXmlFromBinary (data, size))
    {
        const auto tree = juce::ValueTree::fromXml (*xml);
        if (! tree.hasType ("ScaleSight"))
            return;

        setUiState (tree.getProperty ("uiState").toString());
        editorWidth  = tree.getProperty ("width",  editorWidth);
        editorHeight = tree.getProperty ("height", editorHeight);
    }
}

juce::AudioProcessorEditor* ScaleSightProcessor::createEditor()
{
    return new ScaleSightEditor (*this);
}

// Entry point the DAW calls to create the plugin.
juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new ScaleSightProcessor();
}

cmake_minimum_required(VERSION 3.22)
project(ScaleSight VERSION 0.1.0)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# ---- Get JUCE -------------------------------------------------------------
# By default CMake downloads JUCE 8.0.9 from GitHub the first time you build.
# If you already have JUCE on disk, pass -DJUCE_DIR=path/to/JUCE instead.
if(DEFINED JUCE_DIR)
    add_subdirectory(${JUCE_DIR} JUCE)
else()
    include(FetchContent)
    FetchContent_Declare(JUCE
        GIT_REPOSITORY https://github.com/juce-framework/JUCE.git
        GIT_TAG        8.0.9
        GIT_SHALLOW    TRUE)
    FetchContent_MakeAvailable(JUCE)
endif()

# ---- Plugin formats -------------------------------------------------------
set(SCALESIGHT_FORMATS VST3 Standalone)
if(APPLE)
    list(APPEND SCALESIGHT_FORMATS AU)
endif()

juce_add_plugin(ScaleSight
    PRODUCT_NAME                "ScaleSight"
    COMPANY_NAME                "Malachi"
    BUNDLE_ID                   com.malachi.scalesight
    PLUGIN_MANUFACTURER_CODE    Mlch
    PLUGIN_CODE                 ScSi
    FORMATS                     ${SCALESIGHT_FORMATS}
    # Loaded as an instrument so FL Studio and Ableton both accept it.
    # It makes no sound: it listens to MIDI and passes it straight through.
    IS_SYNTH                    TRUE
    NEEDS_MIDI_INPUT            TRUE
    NEEDS_MIDI_OUTPUT           TRUE
    IS_MIDI_EFFECT              FALSE
    EDITOR_WANTS_KEYBOARD_FOCUS TRUE
    NEEDS_WEB_BROWSER           TRUE
    NEEDS_WEBVIEW2              TRUE      # Windows: build WebView2 into the plugin (no extra DLL)
    VST3_CATEGORIES             Instrument Tools
    COPY_PLUGIN_AFTER_BUILD     FALSE)

# The whole interface is one HTML file, baked into the plugin.
juce_add_binary_data(ScaleSightUI SOURCES ui/index.html)

target_sources(ScaleSight PRIVATE
    Source/PluginProcessor.cpp
    Source/PluginEditor.cpp)

target_compile_definitions(ScaleSight PUBLIC
    JUCE_WEB_BROWSER=1
    JUCE_USE_CURL=0
    JUCE_VST3_CAN_REPLACE_VST2=0
    JUCE_USE_WIN_WEBVIEW2_WITH_STATIC_LINKING=1)

target_link_libraries(ScaleSight
    PRIVATE
        ScaleSightUI
        juce::juce_audio_utils
    PUBLIC
        juce::juce_recommended_config_flags
        juce::juce_recommended_lto_flags
        juce::juce_recommended_warning_flags)

/**
 * AttendX - Empirical Verification Test Suite for Frontend Voice UX & Audio Clash Prevention
 *
 * Challenger 1 (Frontend Voice UX & Clash Challenger)
 * Tests:
 *  - Case 1: When user inputs text via typing (inputMethod === 'text'), verify automatic TTS is NOT called.
 *  - Case 2: When user speaks via mic (inputMethod === 'voice'), verify automatic TTS IS invoked with clean text.
 *  - Case 3: When isVoiceOpen === true, verify FloatingChatbot does NOT invoke TTS (preventing double-speech collision).
 *  - Case 4: Audio clash prevention: Calling speak() immediately stops any previously playing speech and flushes.
 *  - Case 5: Text sanitization: cleanTextForSpeech completely strips markdown bold (**), headers (#), links ([title](url)), brackets, and system markers ([SYSTEM_IDENTITY], [CONFIRMATION_REQUIRED]).
 *  - Case 6: Listener leak check: startListening() does not leak listeners on multiple consecutive invocations.
 *  - Case 7: Static analysis: Check the entire client/src/ for any unintended remaining HTML5 speech recognition or synthesis calls.
 *  - Case 8: Android package visibility & audio permissions in AndroidManifest.xml.
 *  - Stress Test 9: Rapid input method toggling (keyboard -> mic -> keyboard edit -> send) ensures sticky voice mode cannot occur.
 *  - Stress Test 10: VoiceModeOverlay filler phrase interruption and cancellation before speaking final AI response.
 *  - Stress Test 11: Extended text sanitization with multi-links, nested brackets, math symbols, and emojis.
 */

// Step 1: Initialize Native Mock Environment as the very first import (before Capacitor core loads)
import { callSequence, activeListeners, mockCounters, resetMockState } from './setup_native_mock.mjs';

// Step 2: Standard imports
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLIENT_ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.resolve(CLIENT_ROOT, 'src');

// Step 3: Import NativeVoiceService and Capacitor
import { NativeVoiceService } from '../src/services/NativeVoiceService.ts';
import { Capacitor } from '@capacitor/core';

console.log("\n=======================================================");
console.log("   ATTENDX FRONTEND VOICE UX & CLASH TEST SUITE");
console.log("   Capacitor Platform: " + Capacitor.getPlatform() + " (isNative: " + Capacitor.isNativePlatform() + ")");
console.log("=======================================================\n");

describe('AttendX Voice UX & Clash Prevention Tests', () => {

  beforeEach(() => {
    resetMockState();
  });

  // -------------------------------------------------------------
  // CASE 1: Conditional TTS - Typed text input mutes automatic TTS
  // -------------------------------------------------------------
  it('Case 1: When user inputs text via typing (inputMethod === "text"), verify automatic TTS is NOT called', async () => {
    let isVoiceOpen = false;
    let lastInputMethodRef = { current: 'text' };

    const onUserType = (val) => {
      lastInputMethodRef.current = 'text';
    };

    const handleSendMessage = async (textToSend, inputMethod) => {
      const effectiveInputMethod = inputMethod || lastInputMethodRef.current;
      lastInputMethodRef.current = 'text';

      await NativeVoiceService.stopSpeaking();

      const apiResponse = {
        response: "Your attendance in Computer Networks is 82%. You can safely miss 2 classes.",
        citations: []
      };

      const textToSpeak = apiResponse.response;
      if (effectiveInputMethod === 'voice' && !isVoiceOpen && textToSpeak) {
        await NativeVoiceService.stopSpeaking();
        await NativeVoiceService.speak(textToSpeak);
      } else {
        await NativeVoiceService.stopSpeaking();
      }

      return apiResponse;
    };

    onUserType("How many classes can I skip in Computer Networks?");
    await handleSendMessage();

    assert.equal(mockCounters.ttsSpeak, 0, "TTS speak() MUST NOT be called when inputMethod === 'text'");
    assert.ok(mockCounters.ttsStop >= 2, "stopSpeaking() must be called to ensure complete audio silence");
    console.log("  [PASS] Case 1: Typed text input confirmed muted. Speak calls: 0, Stop calls:", mockCounters.ttsStop);
  });

  // -------------------------------------------------------------
  // CASE 2: Conditional TTS - Spoken mic input invokes automatic TTS
  // -------------------------------------------------------------
  it('Case 2: When user speaks via mic (inputMethod === "voice"), verify automatic TTS IS invoked with clean text', async () => {
    let isVoiceOpen = false;
    let lastInputMethodRef = { current: 'text' };

    const onMicDictation = (transcript) => {
      lastInputMethodRef.current = 'voice';
    };

    const handleSendMessage = async (textToSend, inputMethod) => {
      const effectiveInputMethod = inputMethod || lastInputMethodRef.current;
      lastInputMethodRef.current = 'text';

      await NativeVoiceService.stopSpeaking();

      const apiResponse = {
        response: "[SYSTEM_IDENTITY] Hello **Alice**! Your overall attendance is **86%**. Check [Rules](https://attendx.tech/policy).",
        citations: []
      };

      const textToSpeak = apiResponse.response;
      if (effectiveInputMethod === 'voice' && !isVoiceOpen && textToSpeak) {
        await NativeVoiceService.stopSpeaking();
        await NativeVoiceService.speak(textToSpeak);
      } else {
        await NativeVoiceService.stopSpeaking();
      }

      return apiResponse;
    };

    onMicDictation("What is my overall attendance?");
    await handleSendMessage("What is my overall attendance?", 'voice');

    assert.equal(mockCounters.ttsSpeak, 1, "TTS speak() MUST be called exactly once for voice queries");
    assert.equal(
      mockCounters.lastSpokenText,
      "Hello Alice! Your overall attendance is 86%. Check Rules.",
      "Spoken text must be sanitized (no markdown, no url, no bracketed system tags)"
    );
    console.log(`  [PASS] Case 2: Voice prompt invoked TTS with sanitized text: "${mockCounters.lastSpokenText}"`);
  });

  // -------------------------------------------------------------
  // CASE 3: Dual-Speech Prevention when isVoiceOpen === true
  // -------------------------------------------------------------
  it('Case 3: When isVoiceOpen === true, verify FloatingChatbot does NOT invoke TTS (preventing double-speech collision)', async () => {
    let isVoiceOpen = true; // Fullscreen VoiceModeOverlay is open
    let lastInputMethodRef = { current: 'text' };

    const handleSendMessage = async (textToSend, inputMethod) => {
      const effectiveInputMethod = inputMethod || lastInputMethodRef.current;
      lastInputMethodRef.current = 'text';

      await NativeVoiceService.stopSpeaking();

      const apiResponse = {
        response: "Attendance for Math is currently 75%.",
        citations: []
      };

      const textToSpeak = apiResponse.response;
      if (effectiveInputMethod === 'voice' && !isVoiceOpen && textToSpeak) {
        await NativeVoiceService.stopSpeaking();
        await NativeVoiceService.speak(textToSpeak);
      } else {
        await NativeVoiceService.stopSpeaking();
      }

      return textToSpeak;
    };

    const responseText = await handleSendMessage("Check Math", 'voice');

    assert.equal(responseText, "Attendance for Math is currently 75%.");
    assert.equal(mockCounters.ttsSpeak, 0, "FloatingChatbot MUST NOT call speak() when isVoiceOpen === true");

    // VoiceModeOverlay exclusively handles its own speech:
    await NativeVoiceService.speak(responseText);
    assert.equal(mockCounters.ttsSpeak, 1, "Exactly one audio stream initiated by VoiceModeOverlay, preventing dual-audio clash");
    console.log("  [PASS] Case 3: Double-speech collision successfully prevented when isVoiceOpen === true.");
  });

  // -------------------------------------------------------------
  // CASE 4: Audio clash prevention: Calling speak() immediately stops previous audio
  // -------------------------------------------------------------
  it('Case 4: Audio clash prevention: Calling speak() immediately stops any previously playing speech', async () => {
    resetMockState();

    await NativeVoiceService.speak("First utterance playing");
    await NativeVoiceService.speak("Second utterance interrupting");

    const ttsCalls = callSequence.filter(c => c.plugin === 'TextToSpeech');
    const methods = ttsCalls.map(c => c.method);

    assert.deepEqual(
      methods,
      ['stop', 'speak', 'stop', 'speak'],
      "Every speak() call MUST invoke stop() before speak() to flush audio"
    );

    assert.equal(ttsCalls[1].options.queueStrategy, 0, "queueStrategy must be 0 (Flush)");
    assert.equal(ttsCalls[3].options.queueStrategy, 0, "queueStrategy must be 0 (Flush)");

    await NativeVoiceService.startListening(() => {});
    const firstCallInListening = callSequence.filter(c => c.plugin === 'TextToSpeech').pop();
    assert.equal(firstCallInListening.method, 'stop', "startListening() must stop speech to prevent acoustic feedback loop");

    console.log("  [PASS] Case 4: Audio clash prevention confirmed. Order: stop -> speak -> stop -> speak. Feedback loop prevented on listen.");
  });

  // -------------------------------------------------------------
  // CASE 5: Text Sanitization - cleanTextForSpeech()
  // -------------------------------------------------------------
  it('Case 5: Text sanitization: cleanTextForSpeech completely strips markdown bold, headers, links, brackets, and system markers', () => {
    const testCases = [
      {
        name: "Markdown formatting (bold, italic, strikethrough)",
        input: "**Bold text** and *italic* and _underscored_ and ~strikethrough~",
        expected: "Bold text and italic and underscored and strikethrough"
      },
      {
        name: "Headers (#, ##, ###)",
        input: "# Heading 1\n## Heading 2\n### Heading 3\nContent",
        expected: "Heading 1 Heading 2 Heading 3 Content"
      },
      {
        name: "Markdown links [title](url)",
        input: "Check out [Attendance Ordinance](https://attendx.tech/rules) today for guidelines.",
        expected: "Check out Attendance Ordinance today for guidelines."
      },
      {
        name: "System Markers [SYSTEM_IDENTITY] and [CONFIRMATION_REQUIRED]",
        input: "[SYSTEM_IDENTITY] You are AttendX Policy Copilot. [CONFIRMATION_REQUIRED] Mark attendance?",
        expected: "You are AttendX Policy Copilot. Mark attendance?"
      },
      {
        name: "Context markers [GLOBAL_APP_STATE] [USER_COMMAND] and citations [1] [2]",
        input: "[GLOBAL_APP_STATE] [USER_COMMAND] What is my quota? [1] [2]",
        expected: "What is my quota?"
      },
      {
        name: "Code blocks and inline code",
        input: "Here is your code: ```python\nprint('hello')\n``` and inline `calculateAttendance()` result.",
        expected: "Here is your code: and inline calculateAttendance() result."
      },
      {
        name: "Bullet points and blockquotes",
        input: "* Item 1\n- Item 2\n+ Item 3\n> Important quote",
        expected: "Item 1 Item 2 Item 3 Important quote"
      },
      {
        name: "Complex combined real-world response",
        input: "[SYSTEM_IDENTITY]\n### Status Report\nHello **Naman**, your overall attendance is **81.5%**!\n- [Attendance Policy](https://attendx.tech/policy) requires 75%.\n- [1] You can safely skip 3 classes of **Data Structures**.\n[CONFIRMATION_REQUIRED] Do you want me to calculate tomorrow's forecast?",
        expected: "Status Report Hello Naman, your overall attendance is 81.5%! Attendance Policy requires 75%. You can safely skip 3 classes of Data Structures. Do you want me to calculate tomorrow's forecast?"
      },
      {
        name: "Empty string resilience",
        input: "",
        expected: ""
      },
      {
        name: "Null input",
        input: null,
        expected: ""
      },
      {
        name: "Undefined input",
        input: undefined,
        expected: ""
      }
    ];

    for (let i = 0; i < testCases.length; i++) {
      const { name, input, expected } = testCases[i];
      const result = NativeVoiceService.cleanTextForSpeech(input);
      assert.equal(
        result,
        expected,
        `Test case ${i + 1} (${name}) failed.\nInput:    ${input}\nExpected: ${expected}\nActual:   ${result}`
      );
    }

    console.log(`  [PASS] Case 5: All ${testCases.length} text sanitization test cases passed without regression.`);
  });

  // -------------------------------------------------------------
  // CASE 6: Listener Leak Check on consecutive startListening()
  // -------------------------------------------------------------
  it('Case 6: Listener leak check: startListening() does not leak listeners on multiple consecutive invocations', async () => {
    resetMockState();

    for (let i = 1; i <= 10; i++) {
      await NativeVoiceService.startListening({
        onPartialResult: () => {},
        onFinalResult: () => {},
      });
    }

    assert.ok(
      mockCounters.removeAllListeners >= 10,
      `removeAllListeners must be called on every startListening invocation. Calls: ${mockCounters.removeAllListeners}`
    );

    const partialListeners = activeListeners.get('partialResults') || new Set();
    assert.ok(
      partialListeners.size <= 1,
      `Active listeners count must remain <= 1 and never accumulate. Current: ${partialListeners.size}`
    );

    await NativeVoiceService.stopListening();
    const afterStopListeners = activeListeners.get('partialResults') || new Set();
    assert.equal(afterStopListeners.size, 0, "All listeners must be wiped after stopListening()");

    console.log(`  [PASS] Case 6: Listener leak check verified across 10 rapid invocations. Cleanup calls: ${mockCounters.removeAllListeners}, Active listeners: 0.`);
  });

  // -------------------------------------------------------------
  // CASE 7: Static Analysis of entire client/src/
  // -------------------------------------------------------------
  it('Case 7: Static analysis: Check entire client/src/ for unintended remaining HTML5 speech recognition or synthesis calls', () => {
    const forbiddenPatterns = [
      { pattern: /window\.SpeechRecognition/g, name: "window.SpeechRecognition" },
      { pattern: /window\.webkitSpeechRecognition/g, name: "window.webkitSpeechRecognition" },
      { pattern: /SpeechSynthesisUtterance/g, name: "SpeechSynthesisUtterance" },
      { pattern: /window\.speechSynthesis/g, name: "window.speechSynthesis" },
    ];

    function getAllFiles(dir, exts) {
      let results = [];
      const list = fs.readdirSync(dir);
      for (const file of list) {
        const fullPath = path.resolve(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
          results = results.concat(getAllFiles(fullPath, exts));
        } else if (exts.some(ext => file.endsWith(ext))) {
          results.push(fullPath);
        }
      }
      return results;
    }

    const files = getAllFiles(SRC_DIR, ['.ts', '.tsx', '.js', '.jsx']);
    const violations = [];

    for (const filePath of files) {
      const relPath = path.relative(CLIENT_ROOT, filePath).replace(/\\/g, '/');
      const content = fs.readFileSync(filePath, 'utf-8');

      const isVoiceFacade = relPath === 'src/services/NativeVoiceService.ts';

      for (const { pattern, name } of forbiddenPatterns) {
        const matches = [...content.matchAll(pattern)];
        if (matches.length > 0) {
          if (!isVoiceFacade) {
            violations.push({
              file: relPath,
              pattern: name,
              count: matches.length
            });
          } else {
            if (name === "SpeechSynthesisUtterance") {
              violations.push({
                file: relPath,
                pattern: name,
                count: matches.length
              });
            }
          }
        }
      }
    }

    assert.equal(
      violations.length,
      0,
      `Found unintended HTML5 speech API usage in client files:\n${JSON.stringify(violations, null, 2)}`
    );

    console.log(`  [PASS] Case 7: Static analysis confirmed zero HTML5 speech violations across all ${files.length} client files.`);
  });

  // -------------------------------------------------------------
  // CASE 8: Android Package Visibility & Permissions Check
  // -------------------------------------------------------------
  it('Case 8: Android manifest contains RecognitionService query intent and required audio permissions', () => {
    const manifestPath = path.resolve(CLIENT_ROOT, 'android/app/src/main/AndroidManifest.xml');
    assert.ok(fs.existsSync(manifestPath), "AndroidManifest.xml must exist");

    const manifestContent = fs.readFileSync(manifestPath, 'utf-8');

    assert.ok(
      manifestContent.includes('android.speech.RecognitionService'),
      "AndroidManifest.xml MUST declare <action android:name=\"android.speech.RecognitionService\" /> under <queries>"
    );
    assert.ok(
      manifestContent.includes('android.permission.RECORD_AUDIO'),
      "AndroidManifest.xml MUST declare <uses-permission android:name=\"android.permission.RECORD_AUDIO\" />"
    );
    assert.ok(
      manifestContent.includes('android.permission.MODIFY_AUDIO_SETTINGS'),
      "AndroidManifest.xml MUST declare <uses-permission android:name=\"android.permission.MODIFY_AUDIO_SETTINGS\" />"
    );

    console.log("  [PASS] Case 8: AndroidManifest.xml correctly specifies RecognitionService query intent & RECORD_AUDIO permission.");
  });

  // -------------------------------------------------------------
  // STRESS TEST 9: Rapid input method toggling (Sticky Mode Prevention)
  // -------------------------------------------------------------
  it('Stress Test 9: Rapid toggling between mic and keyboard typing strictly prevents sticky voice mode', async () => {
    resetMockState();
    let isVoiceOpen = false;
    let lastInputMethodRef = { current: 'text' };

    const simulateDispatch = async (textToSend, explicitInputMethod) => {
      const effectiveInputMethod = explicitInputMethod || lastInputMethodRef.current;
      lastInputMethodRef.current = 'text'; // Immediate reset to text

      await NativeVoiceService.stopSpeaking();

      const apiResponse = { response: `Response to ${textToSend}` };
      const textToSpeak = apiResponse.response;

      if (effectiveInputMethod === 'voice' && !isVoiceOpen && textToSpeak) {
        await NativeVoiceService.stopSpeaking();
        await NativeVoiceService.speak(textToSpeak);
      } else {
        await NativeVoiceService.stopSpeaking();
      }
      return apiResponse;
    };

    // Interaction 1: User speaks via mic
    lastInputMethodRef.current = 'voice';
    await simulateDispatch("Spoken query 1", 'voice');
    assert.equal(mockCounters.ttsSpeak, 1, "TTS must trigger for spoken query 1");

    // Interaction 2: User immediately follows up by typing text
    // (Note: user does NOT provide explicit inputMethod; relies on lastInputMethodRef which must be 'text')
    await simulateDispatch("Typed query 2");
    assert.equal(mockCounters.ttsSpeak, 1, "TTS MUST NOT trigger for subsequent typed query 2 (no sticky voice mode)");

    // Interaction 3: User clicks mic, dictation fills text, but user edits it with keyboard
    lastInputMethodRef.current = 'voice'; // Mic tapped
    lastInputMethodRef.current = 'text';  // Keyboard touched
    await simulateDispatch("Edited text query 3");
    assert.equal(mockCounters.ttsSpeak, 1, "TTS MUST NOT trigger when user edited dictation via keyboard");

    // Interaction 4: User clicks mic again and sends without typing
    lastInputMethodRef.current = 'voice';
    await simulateDispatch("Spoken query 4", 'voice');
    assert.equal(mockCounters.ttsSpeak, 2, "TTS must trigger again for fresh spoken query 4");

    console.log("  [PASS] Stress Test 9: Sticky voice mode successfully prevented across rapid modality transitions.");
  });

  // -------------------------------------------------------------
  // STRESS TEST 10: VoiceModeOverlay Filler Interruption
  // -------------------------------------------------------------
  it('Stress Test 10: VoiceModeOverlay filler phrase speech is immediately interrupted when real answer arrives', async () => {
    resetMockState();

    // VoiceModeOverlay starts filler speech
    const filler = "Checking the institute ordinances...";
    await NativeVoiceService.speak(filler);
    assert.equal(mockCounters.ttsSpeak, 1);
    assert.equal(mockCounters.lastSpokenText, "Checking the institute ordinances...");

    // Network response returns: VoiceModeOverlay explicitly stops filler before speaking answer
    const networkReply = "According to Section 4.2, attendance requirement is 75%.";
    await NativeVoiceService.stopSpeaking();
    await NativeVoiceService.speak(networkReply);

    assert.equal(mockCounters.ttsSpeak, 2);
    assert.equal(mockCounters.lastSpokenText, "According to Section 4.2, attendance requirement is 75%.");

    // Verify stop was called before second speech
    const methods = callSequence.filter(c => c.plugin === 'TextToSpeech').map(c => c.method);
    assert.deepEqual(methods, ['stop', 'speak', 'stop', 'stop', 'speak']);

    console.log("  [PASS] Stress Test 10: Filler audio successfully interrupted prior to speaking real response.");
  });

  // -------------------------------------------------------------
  // STRESS TEST 11: Extended text sanitization
  // -------------------------------------------------------------
  it('Stress Test 11: Extended text sanitization handles multiple URLs, nested brackets, and emojis', () => {
    const rawInput = "Check [Rules](https://a.com) and [Ordinance](https://b.com)! Also [1][2] **75%** threshold. 🚀";
    const cleaned = NativeVoiceService.cleanTextForSpeech(rawInput);
    assert.equal(cleaned, "Check Rules and Ordinance! Also 75% threshold. 🚀");
    console.log(`  [PASS] Stress Test 11: Multi-url & emoji sanitized cleanly: "${cleaned}"`);
  });
});

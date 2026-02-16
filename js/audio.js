// ====================================================
// AUDIO MODULE (Real Recording + Whisper STT + TTS)
// mit Geräteauswahl für Ein- und Ausgabe
// ====================================================

let mediaRecorder = null;
let audioChunks = [];
let recordedBlob = null;
let recordedUrl = null;
let recTimerInterval = null;
let recStartTs = 0;
let skipNextStopHandler = false;

// Ausgewählte Geräte (aus LocalStorage laden)
let selectedInputId = localStorage.getItem("rk-audio-input-id") || "";
let selectedOutputId = localStorage.getItem("rk-audio-output-id") || "";

// Audio mode: translate (HD→Dialekt) or chat (Dialekt-Chat answer)
let audioMode = localStorage.getItem("rk-audio-mode") || "translate";
let voiceChatHistory = [];

function initAudioModeControls() {
  const t = document.getElementById('audioModeTranslate');
  const c = document.getElementById('audioModeChat');
  if (!t && !c) return;

  // Restore
  if (audioMode === 'chat') {
    if (c) c.checked = true;
  } else {
    audioMode = 'translate';
    if (t) t.checked = true;
  }

  const onChange = () => {
    const val = (c && c.checked) ? 'chat' : 'translate';
    audioMode = val;
    localStorage.setItem('rk-audio-mode', audioMode);

    // Hard reset when switching modes to avoid confusion (old clip/transcription/output)
    // If a recording is running, stop it without creating a preview.
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      try {
        skipNextStopHandler = true;
        mediaRecorder.stop();
      } catch (_) {}
    }

    clearRecordingUI();
    notify(audioMode === 'chat'
      ? 'Audio-Modus: Chat-Antwort (zurückgesetzt).'
      : 'Audio-Modus: Übersetzen (zurückgesetzt).'
    );
  };

  if (t) t.addEventListener('change', onChange);
  if (c) c.addEventListener('change', onChange);
}


// Utility: Toast helper
function notify(msg) {
  if (typeof showToast === "function") {
    showToast(msg);
  } else {
    if (window.RK_DEBUG) console.log("[Toast]", msg);
}
}

// ----------------------------------------------------

function formatMs(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function setHidden(el, hidden) {
  if (!el) return;
  el.classList.toggle('hidden', !!hidden);
}

function safeRevoke(url) {
  try { if (url) URL.revokeObjectURL(url); } catch (_) {}
}
// DEVICE SELECTION (Input/Output)
// ----------------------------------------------------

async function initAudioDevices() {
  const inputSelect = document.getElementById("audioInputSelect");
  const outputSelect = document.getElementById("audioOutputSelect");

  // Wenn keine Selects im DOM sind, nichts tun
  if (!inputSelect && !outputSelect) return;

    try {
    // Einmalig Permission holen, sonst sind Labels leer
    const tmpStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    tmpStream.getTracks().forEach((t) => t.stop());
  } catch (err) {
    console.warn("Konnte kein Audio-Device öffnen:", err);
    notify("Hinweis: Mikrofon-Zugriff im Browser erlauben.");
  }

  let devices = [];
  try {
    devices = await navigator.mediaDevices.enumerateDevices();
  } catch (err) {
    console.error("enumerateDevices fehlgeschlagen:", err);
    return;
  }

  const audioInputs = devices.filter((d) => d.kind === "audioinput");
  const audioOutputs = devices.filter((d) => d.kind === "audiooutput");

  // Eingabegeräte befüllen
  if (inputSelect) {
    // Basis-Option stehen lassen, Rest löschen
    inputSelect.querySelectorAll("option:not([value=''])").forEach((o) => o.remove());

    audioInputs.forEach((dev) => {
      const opt = document.createElement("option");
      opt.value = dev.deviceId;
      opt.textContent = dev.label || `Mikrofon (${dev.deviceId.slice(0, 6)}…)`;
      if (dev.deviceId === selectedInputId) opt.selected = true;
      inputSelect.appendChild(opt);
    });

    inputSelect.addEventListener("change", () => {
      selectedInputId = inputSelect.value || "";
      localStorage.setItem("rk-audio-input-id", selectedInputId);
      notify("Eingabegerät geändert.");
    });
  }

  // Ausgabegeräte befüllen
  if (outputSelect) {
    outputSelect.querySelectorAll("option:not([value=''])").forEach((o) => o.remove());

    audioOutputs.forEach((dev) => {
      const opt = document.createElement("option");
      opt.value = dev.deviceId;
      opt.textContent = dev.label || `Ausgabe (${dev.deviceId.slice(0, 6)}…)`;
      if (dev.deviceId === selectedOutputId) opt.selected = true;
      outputSelect.appendChild(opt);
    });

    outputSelect.addEventListener("change", () => {
      selectedOutputId = outputSelect.value || "";
      localStorage.setItem("rk-audio-output-id", selectedOutputId);
      notify("Ausgabegerät geändert.");
    });
  }
}

// ----------------------------------------------------
// RECORDING
// ----------------------------------------------------

const recBtn = document.getElementById("recBtn");

const recTimerEl = document.getElementById("recTimer");
const recPreviewEl = document.getElementById("recPreview");
const recClearBtn = document.getElementById("recClearBtn");

function clearRecordingUI() {
  voiceChatHistory = []; // reset possible voice chat context

  if (recTimerInterval) { clearInterval(recTimerInterval); recTimerInterval = null; }
  recStartTs = 0;
  if (recTimerEl) recTimerEl.textContent = "00:00";
  setHidden(recTimerEl, true);
  safeRevoke(recordedUrl);
  recordedUrl = null;
  recordedBlob = null;
  audioChunks = [];
  if (recPreviewEl) { recPreviewEl.pause?.(); recPreviewEl.removeAttribute("src"); recPreviewEl.load?.(); }
  setHidden(recPreviewEl, true);
  setHidden(recClearBtn, true);
  if (recBtn) {
    recBtn.classList.remove("btn-recording");
    recBtn.textContent = "🔴 Aufnahme";
  }
  // Optional: reset outputs
  const sttOut = document.getElementById("sttText");
  const dialOut = document.getElementById("dialektText");
  if (sttOut) sttOut.textContent = "—";
  if (dialOut) dialOut.textContent = "—";
}

if (recClearBtn) {
  recClearBtn.addEventListener("click", () => {
    clearRecordingUI();
    notify("Aufnahme zurückgesetzt.");
  });
}

if (recBtn) {
  recBtn.addEventListener("click", async () => {
    if (!mediaRecorder || mediaRecorder.state === "inactive") {
      try {
        // Wenn ein bestimmtes Mikro gewählt ist, dieses verwenden
        const constraints = selectedInputId
          ? { audio: { deviceId: { exact: selectedInputId } } }
          : { audio: true };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        mediaRecorder = new MediaRecorder(stream);

        audioChunks = [];

        mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);

        mediaRecorder.onstop = () => {
          // When switching audio modes we may stop an active recording to reset the UI.
          // In that case, we intentionally skip preview creation to avoid confusing leftovers.
          if (skipNextStopHandler) {
            skipNextStopHandler = false;
            try { stream.getTracks().forEach((t) => t.stop()); } catch (_) {}
            return;
          }

          recordedBlob = new Blob(audioChunks, { type: "audio/webm" });

          // Preview
          safeRevoke(recordedUrl);
          recordedUrl = URL.createObjectURL(recordedBlob);
          if (recPreviewEl) {
            recPreviewEl.src = recordedUrl;
            recPreviewEl.currentTime = 0;
            setHidden(recPreviewEl, false);
          }

          // Stop timer + show reset
          if (recTimerInterval) { clearInterval(recTimerInterval); recTimerInterval = null; }
          if (recTimerEl) {
            recTimerEl.textContent = formatMs(Date.now() - recStartTs);
            setHidden(recTimerEl, false);
          }
          setHidden(recClearBtn, false);

          notify("Audio erfolgreich aufgenommen.");
          recBtn.classList.remove("btn-recording");
          recBtn.textContent = "🔴 Aufnahme";
          stream.getTracks().forEach((t) => t.stop());
        };

        mediaRecorder.start();
        recStartTs = Date.now();
        // Reset previous recording (so STT can't accidentally use the old one while recording)
        recordedBlob = null;
        safeRevoke(recordedUrl);
        recordedUrl = null;
        if (recPreviewEl) { recPreviewEl.removeAttribute("src"); recPreviewEl.load?.(); }

        if (recTimerEl) {
          recTimerEl.textContent = "00:00";
          setHidden(recTimerEl, false);
        }
        if (recTimerInterval) clearInterval(recTimerInterval);
        recTimerInterval = setInterval(() => {
          if (recTimerEl) recTimerEl.textContent = formatMs(Date.now() - recStartTs);
        }, 250);

        setHidden(recClearBtn, true);
        setHidden(recPreviewEl, true);

        recBtn.textContent = "⏹️ Stop";
        recBtn.classList.add("btn-recording");
        notify("Recording gestartet...");
} catch (err) {
        notify("Fehler: Kein Mikrofon oder Zugriff verweigert.");
        console.error(err);
      }
    } else {
      mediaRecorder.stop();
      notify("Recording wird beendet...");
}
  });
}

// ----------------------------------------------------
// SPEECH-TO-TEXT (OpenAI Whisper)
// ----------------------------------------------------

const sttBtn = document.getElementById("sttBtn");

if (sttBtn) {
  sttBtn.addEventListener("click", async () => {
    if (!recordedBlob) {
      notify("Keine Aufnahme vorhanden.");
      return;
    }

    let openaiKey = localStorage.getItem("rk-openai-key") || "";
    const apiUrl = (localStorage.getItem("rk-api-url") || "").toLowerCase();

    // If no dedicated OpenAI STT key is set, fall back to the main key only when the Base-URL is OpenAI.
    if (!openaiKey) {
      const mainKey = localStorage.getItem("rk-api-key") || "";
      if (mainKey && (!apiUrl || apiUrl.includes("openai.com"))) {
        openaiKey = mainKey;
      }
    }

    if (!openaiKey) {
      notify("Bitte OpenAI-Key für Whisper (STT) in den Einstellungen setzen.");
      return;
    }

    sttBtn.disabled = true;
    sttBtn.setAttribute("aria-busy", "true");

    const formData = new FormData();
    formData.append("file", recordedBlob, "audio.webm");
    formData.append("model", "whisper-1");
    formData.append("language", "de");

    notify("Transkription läuft...");

    try {
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: formData
    });

    if (!res.ok) {
      const errTxt = await res.text();
      notify(`STT-Fehler (${res.status}).`);
      console.error(errTxt);
      return;
    }

    const json = await res.json();
    const sttText = json.text || "";
    const sttDiv = document.getElementById("sttText");
    const dialektDiv = document.getElementById("dialektText");

    sttDiv.textContent = sttText;

    // --- Dialekt berechnen (je nach Modus) ---
    try {
      if (audioMode === 'chat') {
        // Keep a short context for a more natural conversation
        voiceChatHistory.push({ role: 'user', content: sttText });
        voiceChatHistory = voiceChatHistory.slice(-10);

        const answer = await chatWithDialect(voiceChatHistory);
        voiceChatHistory.push({ role: 'assistant', content: answer });
        voiceChatHistory = voiceChatHistory.slice(-10);

        dialektDiv.textContent = answer;

        if (window.RK_Eval && typeof window.RK_Eval.setLastSample === 'function') {
          window.RK_Eval.setLastSample({ mode: 'audio_chat', input: sttText, output: answer });
        }
      } else {
        const dialekt = await translateHDToDialekt(sttText);
        dialektDiv.textContent = dialekt;

        if (window.RK_Eval && typeof window.RK_Eval.setLastSample === 'function') {
          window.RK_Eval.setLastSample({ mode: 'audio_translate', input: sttText, output: dialekt });
        }
      }
    } catch (e) {
      console.warn('LLM nicht verfügbar. Fallback wird genutzt.', e);

      // Fallback: simple transform (translate) or canned answer (chat)
      if (audioMode === 'chat' && typeof replyFor === 'function') {
        const fb = replyFor(sttText) || toKaerntnerisch(sttText);
        dialektDiv.textContent = (window.RK_Lexicon ? window.RK_Lexicon.apply(fb) : fb);
        if (window.RK_Eval && typeof window.RK_Eval.setLastSample === 'function') {
          window.RK_Eval.setLastSample({ mode: 'audio_chat_fallback', input: sttText, output: dialektDiv.textContent });
        }
      } else {
        const fb = toKaerntnerisch(sttText);
        dialektDiv.textContent = (window.RK_Lexicon ? window.RK_Lexicon.apply(fb) : fb);
        if (window.RK_Eval && typeof window.RK_Eval.setLastSample === 'function') {
          window.RK_Eval.setLastSample({ mode: 'audio_translate_fallback', input: sttText, output: dialektDiv.textContent });
        }
      }
    }

    notify(audioMode === 'chat' ? 'Transkription + Chat-Antwort bereit.' : 'Transkription + Dialekt bereit.');

  } catch (err) {
    console.error("STT Exception:", err);
    notify("Fehler bei der Transkription. Siehe Konsole.");
  } finally {
    sttBtn.disabled = false;
    sttBtn.removeAttribute("aria-busy");
  }
});

}

// ----------------------------------------------------
// TEXT-TO-SPEECH (ElevenLabs)
// ----------------------------------------------------

const ttsBtn = document.getElementById("ttsBtn");

if (ttsBtn) {
  ttsBtn.addEventListener("click", async () => {
    const text = (document.getElementById("dialektText")?.textContent || "").trim();

    if (!text || text === "—") {
      notify("Kein Text zum Vorlesen vorhanden.");
      return;
    }

    ttsBtn.disabled = true;
    ttsBtn.setAttribute("aria-busy", "true");

    try {
      const elevenKey = localStorage.getItem("rk-eleven-key");
      const voiceId = localStorage.getItem("rk-eleven-voice") || "EXAVITQu4vr4xnSDxMaL";

      if (!elevenKey) {
        notify("Kein ElevenLabs API-Key gesetzt (Einstellungen).");
        return;
      }

      notify("TTS wird generiert...");

      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: {
          "xi-api-key": elevenKey,
          "Content-Type": "application/json",
          "Accept": "audio/mpeg"
        },
        body: JSON.stringify({
          text,
          voice_settings: { stability: 0.4, similarity_boost: 0.85 },
          model_id: "eleven_multilingual_v2"
        })
      });

      if (!res.ok) {
        const errTxt = await res.text();
        console.error("ElevenLabs TTS error", res.status, errTxt);
        notify(`TTS-Fehler (${res.status}). API-Key/Voice-ID prüfen.`);
        return;
      }

      const audioBuffer = await res.arrayBuffer();
      const audioBlob = new Blob([audioBuffer], { type: "audio/mpeg" });
      const url = URL.createObjectURL(audioBlob);

      const audio = new Audio(url);
      const revoke = () => { try { URL.revokeObjectURL(url); } catch (_) {} };
      audio.addEventListener("ended", revoke, { once: true });
      audio.addEventListener("error", revoke, { once: true });

      // Ausgabe-Gerät setzen, wenn unterstützt
      if (selectedOutputId && typeof audio.setSinkId === "function") {
        try {
          await audio.setSinkId(selectedOutputId);
        } catch (e) {
          console.warn("setSinkId (TTS) fehlgeschlagen:", e);
        }
      }

      try {
        await audio.play();
        notify("Dialekt-Audio abgespielt.");
      } catch (e) {
        console.warn("Audio play blocked:", e);
        notify("Audio konnte nicht automatisch abgespielt werden (Browser-Policy). Bitte manuell starten.");
      }
    } catch (err) {
      console.error("TTS Exception:", err);
      notify("Fehler bei der TTS-Ausgabe. Siehe Konsole.");
    } finally {
      ttsBtn.disabled = false;
      ttsBtn.removeAttribute("aria-busy");
    }
  });
}


// ----------------------------------------------------
// Init aufrufen
// ----------------------------------------------------

initAudioModeControls();
initAudioDevices().catch((e) => console.error("initAudioDevices error:", e));

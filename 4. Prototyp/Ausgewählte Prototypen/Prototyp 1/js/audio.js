// ====================================================
// AUDIO MODULE (Real Recording + Whisper STT + TTS)
// mit Geräteauswahl für Ein- und Ausgabe
// ====================================================

let mediaRecorder = null;
let audioChunks = [];
let recordedBlob = null;

// Ausgewählte Geräte (aus LocalStorage laden)
let selectedInputId = localStorage.getItem("rk-audio-input-id") || "";
let selectedOutputId = localStorage.getItem("rk-audio-output-id") || "";

// Utility: Toast helper
function notify(msg) {
  if (typeof showToast === "function") {
    showToast(msg);
  } else {
    console.log("[Toast]", msg);
  }
}

// ----------------------------------------------------
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
          recordedBlob = new Blob(audioChunks, { type: "audio/webm" });
          notify("Audio erfolgreich aufgenommen.");
          recBtn.textContent = "Record";
          stream.getTracks().forEach((t) => t.stop());
        };

        mediaRecorder.start();
        recBtn.textContent = "Stop";
        notify("Recording gestartet...");
      } catch (err) {
        notify("Fehler: Kein Mikrofon oder Zugriff verweigert.");
        console.error(err);
      }
    } else {
      mediaRecorder.stop();
      notify("Recording gestoppt.");
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

  const apiKey = localStorage.getItem("rk-api-key");
  if (!apiKey) {
    notify("Bitte OpenAI API-Key eintragen.");
    return;
  }

  const formData = new FormData();
  formData.append("file", recordedBlob, "audio.webm");
  formData.append("model", "whisper-1");
  formData.append("language", "de");

  notify("Transkription läuft...");

  try {
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
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

    // --- WICHTIG: Jetzt Dialekt berechnen ---
    try {
      const dialekt = await translateHDToDialekt(sttText);
      dialektDiv.textContent = dialekt;
    } catch (e) {
      console.warn("LLM-Dialekt nicht verfügbar. Fallback wird genutzt.", e);
      dialektDiv.textContent = toKaerntnerisch(sttText);
    }

    notify("Transkription + Dialekt erfolgreich!");

  } catch (err) {
    console.error("STT Exception:", err);
    notify("Fehler bei der Transkription. Siehe Konsole.");
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

    if (!text) {
      notify("Kein Text zum Vorlesen vorhanden.");
      return;
    }

    const elevenKey = localStorage.getItem("rk-eleven-key");
    const voiceId = localStorage.getItem("rk-eleven-voice") || "EXAVITQu4vr4xnSDxMaL";

    if (!elevenKey) {
      notify("Bitte ElevenLabs-Key eintragen.");
      return;
    }

    notify("TTS wird generiert...");

    try {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: {
          "xi-api-key": elevenKey,
          "Content-Type": "application/json",
          accept: "audio/mpeg"
        },
        body: JSON.stringify({
          text,
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
      // Ausgabe-Gerät setzen, wenn unterstützt
      if (selectedOutputId && typeof audio.setSinkId === "function") {
        try {
          await audio.setSinkId(selectedOutputId);
        } catch (e) {
          console.warn("setSinkId (TTS) fehlgeschlagen:", e);
        }
      }

      audio.play();
      notify("Dialekt-Audio abgespielt.");
    } catch (err) {
      console.error("TTS Exception:", err);
      notify("Fehler bei der TTS-Ausgabe. Siehe Konsole.");
    }
  });
}

// ----------------------------------------------------
// Init aufrufen
// ----------------------------------------------------

initAudioDevices().catch((e) => console.error("initAudioDevices error:", e));

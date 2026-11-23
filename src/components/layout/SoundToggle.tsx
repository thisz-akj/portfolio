"use client";

import { useEffect, useState } from "react";
import { sound } from "@/lib/sound";

/** Four little bars that dance while sound is on; click to mute / unmute. */
export function SoundToggle({ className = "" }: { className?: string }) {
  const [on, setOn] = useState(true);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const s = sound();
    setOn(s.enabled);
    setLive(s.unlocked);
    return s.onChange((v) => {
      setOn(v);
      setLive(s.unlocked);
    });
  }, []);

  const toggle = () => {
    const s = sound();
    const wasUnlocked = s.unlocked;
    s.unlock();
    setLive(true);
    // first click while armed-but-silent just starts the sound
    if (!wasUnlocked && s.enabled) return;
    s.setEnabled(!s.enabled);
  };

  const playing = on && live;
  return (
    <button
      type="button"
      className={`sound-toggle ${playing ? "on" : ""} ${className}`}
      onClick={toggle}
      aria-pressed={playing}
      aria-label={playing ? "Mute sound" : "Turn sound on"}
      title={playing ? "Sound on" : "Sound off"}
    >
      <span className="st-bars" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
      <span className="st-label">{playing ? "Sound" : "Sound off"}</span>
    </button>
  );
}

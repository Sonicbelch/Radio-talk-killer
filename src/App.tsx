import { useEffect, useMemo, useRef, useState } from "react";
import stationsData from "./stations.json";
import { computeSpeechRatio, createSpeechAnalyzer, SpeechAnalyzer } from "./lib/audioDetect";
import {
  loadFallbacks,
  loadFavorites,
  loadSettings,
  saveFallbacks,
  saveFavorites,
  saveSettings
} from "./lib/storage";

type Station = {
  id: string;
  name: string;
  location: string;
  genre: string;
  streamUrl: string;
};

type SwitchState = "idle" | "listening" | "cooldown";

const stations = stationsData as Station[];

function formatSeconds(seconds: number) {
  return `${seconds.toFixed(1)}s`;
}

export default function App() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const analyzerRef = useRef<SpeechAnalyzer | null>(null);
  const switchTimerRef = useRef<number | null>(null);
  const lastSwitchRef = useRef<number>(0);
  const speechTimerRef = useRef<number>(0);

  const [currentStationId, setCurrentStationId] = useState(stations[0]?.id ?? "");
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [favorites, setFavorites] = useState<string[]>(() => loadFavorites());
  const [fallbacks, setFallbacks] = useState<string[]>(() => loadFallbacks());
  const [settings, setSettings] = useState(loadSettings());
  const [speechRatio, setSpeechRatio] = useState(0);
  const [switchState, setSwitchState] = useState<SwitchState>("idle");
  const [status, setStatus] = useState("Ready");

  const currentStation = useMemo(
    () => stations.find((station) => station.id === currentStationId) ?? stations[0],
    [currentStationId]
  );

  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);
  const fallbackSet = useMemo(() => new Set(fallbacks), [fallbacks]);

  useEffect(() => {
    saveFavorites(favorites);
  }, [favorites]);

  useEffect(() => {
    saveFallbacks(fallbacks);
  }, [fallbacks]);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (!audioRef.current || !currentStation) return;
    audioRef.current.src = currentStation.streamUrl;
    audioRef.current.load();
    if (isPlaying) {
      void audioRef.current.play();
    }
  }, [currentStation, isPlaying]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    if (!isPlaying) {
      setSwitchState("idle");
      if (switchTimerRef.current) {
        window.clearInterval(switchTimerRef.current);
        switchTimerRef.current = null;
      }
      return;
    }

    if (!audioRef.current) return;

    if (!analyzerRef.current) {
      analyzerRef.current = createSpeechAnalyzer(audioRef.current);
    }

    void analyzerRef.current.audioContext.resume();
    setSwitchState("listening");

    switchTimerRef.current = window.setInterval(() => {
      const analyzer = analyzerRef.current;
      if (!analyzer) return;

      const ratio = computeSpeechRatio(
        analyzer.analyser,
        analyzer.data,
        analyzer.audioContext.sampleRate
      );
      setSpeechRatio(ratio);

      const now = Date.now();
      if (ratio >= settings.sensitivity) {
        speechTimerRef.current += 0.5;
      } else {
        speechTimerRef.current = Math.max(0, speechTimerRef.current - 0.5);
      }

      if (
        speechTimerRef.current >= settings.speechDuration &&
        now - lastSwitchRef.current >= settings.cooldown * 1000
      ) {
        const nextId = getNextFallback(currentStationId, fallbacks);
        if (nextId) {
          setStatus(`Speech detected · switching to ${getStationName(nextId)}`);
          lastSwitchRef.current = now;
          speechTimerRef.current = 0;
          setSwitchState("cooldown");
          setCurrentStationId(nextId);
        }
      } else if (now - lastSwitchRef.current < settings.cooldown * 1000) {
        setSwitchState("cooldown");
      } else {
        setSwitchState("listening");
      }
    }, 500);

    return () => {
      if (switchTimerRef.current) {
        window.clearInterval(switchTimerRef.current);
        switchTimerRef.current = null;
      }
    };
  }, [fallbacks, isPlaying, currentStationId, settings]);

  const handlePlayToggle = async () => {
    if (!audioRef.current) return;

    if (!isPlaying) {
      try {
        await audioRef.current.play();
        setIsPlaying(true);
        setStatus(`Playing ${currentStation?.name ?? ""}`);
      } catch (error) {
        setStatus("Playback blocked. Click play again.");
      }
      return;
    }

    audioRef.current.pause();
    setIsPlaying(false);
    setStatus("Paused");
  };

  const handleStationSelect = (id: string) => {
    setCurrentStationId(id);
    setStatus(`Tuned to ${getStationName(id)}`);
  };

  const toggleFavorite = (id: string) => {
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleFallback = (id: string) => {
    setFallbacks((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const currentSpeechTime = formatSeconds(speechTimerRef.current);
  const cooldownRemaining = Math.max(0, settings.cooldown - (Date.now() - lastSwitchRef.current) / 1000);

  return (
    <div className="app">
      <header className="app__header">
        <div>
          <p className="app__eyebrow">Radio Talk Killer</p>
          <h1>Quiet the chatter, keep the music.</h1>
          <p className="app__subhead">
            Listen to online radio stations with automatic speech detection and fallback switching.
          </p>
        </div>
        <div className="now-playing">
          <span className="now-playing__label">Now playing</span>
          <strong className="now-playing__title">{currentStation?.name ?? ""}</strong>
          <span className="now-playing__meta">
            {currentStation?.location} · {currentStation?.genre}
          </span>
          <span className="now-playing__status">{status}</span>
        </div>
      </header>

      <main className="app__grid">
        <section className="panel">
          <div className="panel__header">
            <h2>Player</h2>
            <span className={`pill pill--${switchState}`}>
              {switchState === "idle" && "Idle"}
              {switchState === "listening" && "Listening"}
              {switchState === "cooldown" && "Cooldown"}
            </span>
          </div>

          <div className="player">
            <button className="button button--primary" onClick={handlePlayToggle}>
              {isPlaying ? "Pause" : "Play"}
            </button>
            <div className="player__volume">
              <label htmlFor="volume">Volume</label>
              <input
                id="volume"
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={(event) => setVolume(Number(event.target.value))}
              />
              <span>{Math.round(volume * 100)}%</span>
            </div>
            <div className="meter">
              <div className="meter__label">Speech ratio</div>
              <div className="meter__bar">
                <div
                  className="meter__fill"
                  style={{ width: `${Math.min(100, speechRatio * 60)}%` }}
                />
              </div>
              <span>{speechRatio.toFixed(2)}</span>
            </div>
          </div>

          <div className="panel__section">
            <h3>Speech detection</h3>
            <div className="field">
              <label htmlFor="sensitivity">Sensitivity</label>
              <input
                id="sensitivity"
                type="range"
                min={0.6}
                max={2.4}
                step={0.05}
                value={settings.sensitivity}
                onChange={(event) =>
                  setSettings((prev) => ({
                    ...prev,
                    sensitivity: Number(event.target.value)
                  }))
                }
              />
              <span>{settings.sensitivity.toFixed(2)}×</span>
            </div>
            <div className="field">
              <label htmlFor="speechDuration">Speech duration threshold</label>
              <input
                id="speechDuration"
                type="number"
                min={1}
                max={12}
                step={0.5}
                value={settings.speechDuration}
                onChange={(event) =>
                  setSettings((prev) => ({
                    ...prev,
                    speechDuration: Number(event.target.value)
                  }))
                }
              />
              <span>{formatSeconds(settings.speechDuration)}</span>
            </div>
            <div className="field">
              <label htmlFor="cooldown">Cooldown</label>
              <input
                id="cooldown"
                type="number"
                min={4}
                max={45}
                step={1}
                value={settings.cooldown}
                onChange={(event) =>
                  setSettings((prev) => ({
                    ...prev,
                    cooldown: Number(event.target.value)
                  }))
                }
              />
              <span>{formatSeconds(settings.cooldown)}</span>
            </div>
            <div className="hint">
              <p>
                Speech time detected: <strong>{currentSpeechTime}</strong>
              </p>
              <p>
                Cooldown remaining: <strong>{formatSeconds(cooldownRemaining)}</strong>
              </p>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <h2>Stations</h2>
            <span className="pill">{stations.length} total</span>
          </div>
          <div className="stations">
            {stations.map((station) => (
              <div
                key={station.id}
                className={`station ${station.id === currentStationId ? "station--active" : ""}`}
              >
                <div className="station__info">
                  <h3>{station.name}</h3>
                  <p>
                    {station.location} · {station.genre}
                  </p>
                </div>
                <div className="station__actions">
                  <button className="button" onClick={() => handleStationSelect(station.id)}>
                    Tune
                  </button>
                  <button
                    className={`button button--ghost ${
                      favoriteSet.has(station.id) ? "button--active" : ""
                    }`}
                    onClick={() => toggleFavorite(station.id)}
                  >
                    {favoriteSet.has(station.id) ? "★ Favorite" : "☆ Favorite"}
                  </button>
                  <button
                    className={`button button--ghost ${
                      fallbackSet.has(station.id) ? "button--active" : ""
                    }`}
                    onClick={() => toggleFallback(station.id)}
                  >
                    {fallbackSet.has(station.id) ? "Fallback" : "Set fallback"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <h2>Favorites & Fallbacks</h2>
          </div>
          <div className="panel__section">
            <h3>Favorites</h3>
            {favorites.length === 0 ? (
              <p className="empty">Pick favorites to reach them quickly.</p>
            ) : (
              <ul className="tag-list">
                {favorites.map((id) => (
                  <li key={id} className="tag">
                    {getStationName(id)}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="panel__section">
            <h3>Fallback queue</h3>
            {fallbacks.length === 0 ? (
              <p className="empty">Assign fallback stations for auto-switching.</p>
            ) : (
              <ol className="queue">
                {fallbacks.map((id) => (
                  <li key={id}>{getStationName(id)}</li>
                ))}
              </ol>
            )}
          </div>
          <p className="hint">
            Auto-switches rotate through your fallback queue when speech dominates the audio for
            several seconds.
          </p>
        </section>
      </main>

      <audio ref={audioRef} preload="none" />
    </div>
  );
}

function getNextFallback(currentId: string, fallbackIds: string[]) {
  if (fallbackIds.length === 0) return null;
  const currentIndex = fallbackIds.indexOf(currentId);
  if (currentIndex === -1) return fallbackIds[0];
  return fallbackIds[(currentIndex + 1) % fallbackIds.length];
}

function getStationName(id: string) {
  return stations.find((station) => station.id === id)?.name ?? "Unknown";
}

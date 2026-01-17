export type SpeechAnalyzer = {
  audioContext: AudioContext;
  analyser: AnalyserNode;
  data: Uint8Array;
};

export function createSpeechAnalyzer(audio: HTMLAudioElement): SpeechAnalyzer {
  const audioContext = new AudioContext();
  const source = audioContext.createMediaElementSource(audio);
  const analyser = audioContext.createAnalyser();

  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.85;

  source.connect(analyser);
  analyser.connect(audioContext.destination);

  return {
    audioContext,
    analyser,
    data: new Uint8Array(analyser.frequencyBinCount)
  };
}

export function computeSpeechRatio(
  analyser: AnalyserNode,
  data: Uint8Array,
  sampleRate: number
): number {
  analyser.getByteFrequencyData(data);
  const binSize = sampleRate / analyser.fftSize;
  let speechEnergy = 0;
  let musicEnergy = 0;

  for (let i = 0; i < data.length; i += 1) {
    const frequency = i * binSize;
    const normalized = data[i] / 255;
    const power = normalized * normalized;

    if (frequency >= 300 && frequency <= 3400) {
      speechEnergy += power;
    } else if (frequency < 200 || (frequency > 3400 && frequency < 8000)) {
      musicEnergy += power;
    }
  }

  return speechEnergy / (musicEnergy + 0.0001);
}

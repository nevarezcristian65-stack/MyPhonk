export interface Track {
  id: string;
  title: string;
  artist: string;
  duration: string; // e.g. "2:45"
  durationSeconds: number; // e.g. 165
  url: string; // playable audio URL (or base64 blob URL)
  coverUrl: string; // album cover artwork
  genre: string; // e.g. "Drift Phonk", "Phonk House", "Memphis", "Wave Phonk"
  mood: string; // e.g. "Agressivo", "Oscuro", "Cósmico", "Chill", "Hype"
  downloadUrl: string; // direct mp3 download URL
  flacDownloadUrl: string; // lossless flac download URL/generator
  lyrics?: string; // real-time syncable or standard text lyrics
  likesCount: number;
  playsCount: number;
  isUserUploaded?: boolean;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  trackIds: string[];
  createdAt: string;
}

export interface UserLibrary {
  favorites: string[]; // List of track IDs
  playlists: Playlist[];
  listeningHistory: { trackId: string; playedAt: string }[];
  accentColor: string; // Custom Accent Color
  glowIntensity: "low" | "medium" | "high"; // Custom neon intensity
}

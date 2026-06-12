import React, { useState } from "react";
import { FolderHeart, Plus, Trash2, Play, Check, Library } from "lucide-react";
import { Playlist, Track } from "../types";

interface PlaylistsSectionProps {
  playlists: Playlist[];
  allTracks: Track[];
  onPlayPlaylist: (playlist: Playlist) => void;
  onCreatePlaylist: (name: string, description?: string) => void;
  onDeletePlaylist: (id: string) => void;
  onToggleTrackInPlaylist: (playlistId: string, trackId: string) => void;
  accentColor: string;
}

export default function PlaylistsSection({
  playlists,
  allTracks,
  onPlayPlaylist,
  onCreatePlaylist,
  onDeletePlaylist,
  onToggleTrackInPlaylist,
  accentColor
}: PlaylistsSectionProps) {
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [newPlaylistDesc, setNewPlaylistDesc] = useState("");
  const [showCreator, setShowCreator] = useState(false);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;
    onCreatePlaylist(newPlaylistName.trim(), newPlaylistDesc.trim());
    setNewPlaylistName("");
    setNewPlaylistDesc("");
    setShowCreator(false);
  };

  const activePlaylist = playlists.find((p) => p.id === selectedPlaylistId);

  return (
    <div id="playlists-section" className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Playlists Sidemenu */}
      <div className="md:col-span-1 rounded-2xl bg-[#0a0a0a] border border-white/5 p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Library size={18} className="text-zinc-400" style={{ color: accentColor }} />
            <h4 className="text-xs uppercase tracking-[0.2em] font-display text-white">Playlists</h4>
          </div>
          <button
            onClick={() => setShowCreator(!showCreator)}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-all cursor-pointer border border-white/5"
          >
            <Plus size={16} />
          </button>
        </div>

        {/* Create playlist mini formulation */}
        {showCreator && (
          <form onSubmit={handleSubmit} className="p-3.5 rounded-xl bg-[#050505] border border-white/5 flex flex-col gap-3">
            <input
              type="text"
              placeholder="Nombre de la Playlist..."
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              className="px-3 py-1.5 bg-white/5 border border-white/10 text-xs rounded-lg text-white font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
              style={{ focusRingColor: accentColor }}
              required
            />
            <input
              type="text"
              placeholder="Descripción breve..."
              value={newPlaylistDesc}
              onChange={(e) => setNewPlaylistDesc(e.target.value)}
              className="px-3 py-1.5 bg-white/5 border border-white/10 text-xs rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              style={{ focusRingColor: accentColor }}
            />
            <div className="flex items-center gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowCreator(false)}
                className="px-2.5 py-1 text-[10px] uppercase font-bold text-white/40 hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-lg text-[10px] font-bold text-black uppercase tracking-wider cursor-pointer transition-transform hover:scale-105"
                style={{ backgroundColor: accentColor }}
              >
                Crear
              </button>
            </div>
          </form>
        )}

        {/* Playlist List */}
        <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
          {playlists.length === 0 ? (
            <p className="text-xs text-white/30 italic text-center py-6">No has creado playlists todavía.</p>
          ) : (
            playlists.map((pl) => (
              <button
                key={pl.id}
                onClick={() => setSelectedPlaylistId(pl.id)}
                className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                  selectedPlaylistId === pl.id
                    ? "bg-[#050505]/60 border-blue-500/50"
                    : "bg-[#050505] border-transparent hover:border-white/5"
                }`}
                style={{ borderColor: selectedPlaylistId === pl.id ? accentColor : undefined }}
              >
                <div className="truncate pr-2">
                  <span className="text-xs font-bold text-white block truncate">{pl.name}</span>
                  <span className="text-[10px] text-white/40 font-mono block mt-0.5">{pl.trackIds.length} tracks</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 select-none">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlayPlaylist(pl);
                    }}
                    disabled={pl.trackIds.length === 0}
                    className="p-1.5 rounded-md bg-white/5 text-white/80 hover:bg-white/10 hover:text-white transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none border border-white/5"
                    style={{ color: pl.trackIds.length > 0 ? accentColor : undefined }}
                    title="Reproducir Playlist"
                  >
                    <Play size={11} fill="currentColor" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeletePlaylist(pl.id);
                      if (selectedPlaylistId === pl.id) setSelectedPlaylistId(null);
                    }}
                    className="p-1.5 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all cursor-pointer border border-red-550/10"
                    title="Eliminar Playlist"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Playlist Tracks details and manager */}
      <div className="md:col-span-2 rounded-2xl bg-[#0a0a0a] border border-white/5 p-5 flex flex-col gap-4">
        {activePlaylist ? (
          <>
            <div>
              <div className="flex items-center gap-2">
                <FolderHeart size={18} className="text-purple-400" style={{ color: accentColor }} />
                <h4 className="text-sm font-bold font-display text-white">{activePlaylist.name}</h4>
              </div>
              <p className="text-xs text-white/50 mt-1">
                {activePlaylist.description || "Organiza y administra las canciones de tu playlist de Phonk."}
              </p>
            </div>

            {/* Song Grid Adder/Remover */}
            <div className="border-t border-white/5 pt-4">
              <span className="block text-xs font-mono font-bold text-white/40 mb-2 uppercase tracking-wide">
                Añadir / Quitar canciones de la plataforma:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                {allTracks.map((tr) => {
                  const isInPlaylist = activePlaylist.trackIds.includes(tr.id);
                  return (
                    <button
                      key={tr.id}
                      onClick={() => onToggleTrackInPlaylist(activePlaylist.id, tr.id)}
                      className={`flex items-center justify-between p-2 rounded-lg text-left transition-all text-xs ${
                        isInPlaylist 
                          ? "bg-white/10 border border-white/10 text-white" 
                          : "bg-[#050505] border border-white/5 text-white/50 hover:border-white/10"
                      }`}
                    >
                      <div className="truncate pr-2">
                        <span className="font-semibold block truncate" style={{ color: isInPlaylist ? accentColor : undefined }}>
                          {tr.title}
                        </span>
                        <span className="text-[10px] text-white/40 block truncate">{tr.artist}</span>
                      </div>
                      <div className={`p-1 rounded-md transition-all shrink-0 ${
                        isInPlaylist ? "bg-[#3b82f6] text-black" : "bg-white/5 text-white/20"
                      }`}
                      style={{ backgroundColor: isInPlaylist ? accentColor : undefined }}
                      >
                        <Check size={10} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Playlist Tracklist Preview */}
            <div className="border-t border-white/5 pt-4 flex flex-col gap-2">
              <span className="block text-xs font-mono font-bold text-white/40 uppercase tracking-wide">
                Tracks en esta Playlist ({activePlaylist.trackIds.length})
              </span>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {activePlaylist.trackIds.length === 0 ? (
                  <p className="text-xs text-white/30 italic py-4">Selecciona pistas arriba para agregarlas.</p>
                ) : (
                  activePlaylist.trackIds.map((tid) => {
                    const track = allTracks.find((t) => t.id === tid);
                    if (!track) return null;
                    return (
                      <div key={track.id} className="flex items-center justify-between p-2 rounded-lg bg-[#050505] border border-white/5">
                        <div className="truncate pr-2">
                          <span className="text-xs font-semibold text-white block truncate">{track.title}</span>
                          <span className="text-[10px] text-white/50 block truncate">{track.artist}</span>
                        </div>
                        <span className="text-[10px] font-mono text-white/40">{track.duration}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center py-12 text-zinc-500">
            <FolderHeart size={36} className="text-zinc-600 mb-2 animate-bounce" />
            <p className="text-xs font-medium text-white/40">Selecciona una playlist de la izquierda para administrar sus canciones o crea una nueva.</p>
          </div>
        )}
      </div>
    </div>
  );
}

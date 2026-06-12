import React, { useState, useEffect } from "react";
import { 
  Search, SlidersHorizontal, Plus, Disc, Sparkles, Heart, 
  Trash2, Play, CheckCircle, Flame, Shield, HelpCircle, ArrowUpRight
} from "lucide-react";
import { Track, Playlist, UserLibrary } from "./types";
import { initialTracks, genres, moods } from "./tracksData";

// Firebase imports
import { 
  auth, db, googleProvider, handleFirestoreError, OperationType 
} from "./lib/firebase";
import { 
  onAuthStateChanged, signInWithPopup, signOut, User 
} from "firebase/auth";
import { 
  doc, getDoc, setDoc, updateDoc, collection, onSnapshot, query, where, deleteDoc 
} from "firebase/firestore";

// Components imports
import Player from "./components/Player";
import UploadModal from "./components/UploadModal";
import PlaylistsSection from "./components/PlaylistsSection";
import Recommendations from "./components/Recommendations";
import CustomizationPanel from "./components/CustomizationPanel";
import PremiumPage from "./components/PremiumPage";

const LOCAL_STORAGE_LIBRARY_KEY = "myphonk_user_library";
const LOCAL_STORAGE_TRACKS_KEY = "myphonk_custom_tracks";

export default function App() {
  // --- States ---
  const [tracks, setTracks] = useState<Track[]>(initialTracks);
  const [search, setSearch] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("Todos");
  const [selectedMood, setSelectedMood] = useState("Todos");
  const [showFilters, setShowFilters] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Active track inside the audio runner state
  const [currentTrack, setCurrentTrack] = useState<Track | null>(initialTracks[0]);

  // Network and Connectivity States
  const [isOffline, setIsOffline] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"synced" | "saving" | "offline">("synced");

  // Custom user library, preferences and playlists
  const [library, setLibrary] = useState<UserLibrary>({
    favorites: [],
    playlists: [],
    listeningHistory: [],
    accentColor: "#3b82f6", // Professional Polish Blue default
    glowIntensity: "medium"
  });

  // --- Firebase Authentication States ---
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // --- Premium Subscription States ---
  const [activeTab, setActiveTab] = useState<"library" | "premium">("library");
  const [subscription, setSubscription] = useState<{
    status: string;
    plan: string;
    currentPeriodEnd: string;
    subscriptionId?: string;
  } | null>(null);

  const isPremium = subscription 
    ? (subscription.status === "active" || subscription.status === "trialing") 
    : false;

  // Auto-switch to premium tab if returning from Stripe payment
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment_success") === "true" || params.get("payment_canceled") === "true") {
      setActiveTab("premium");
    }
  }, []);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Auth Operations
  const handleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error("Authentication popup error:", err);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Sign-out failure:", err);
    }
  };

  // --- Real-Time Firestore Sync Hooks ---
  useEffect(() => {
    if (!user) {
      // Offline/Guest mode: Load states from localStorage
      try {
        const storedLib = localStorage.getItem(LOCAL_STORAGE_LIBRARY_KEY);
        if (storedLib) {
          setLibrary(JSON.parse(storedLib));
        } else {
          setLibrary({
            favorites: [],
            playlists: [],
            listeningHistory: [],
            accentColor: "#3b82f6",
            glowIntensity: "medium"
          });
        }

        const storedTracks = localStorage.getItem(LOCAL_STORAGE_TRACKS_KEY);
        if (storedTracks) {
          const parsedCustom = JSON.parse(storedTracks);
          setTracks([...initialTracks, ...parsedCustom]);
        } else {
          setTracks(initialTracks);
        }
        setSyncStatus("synced");
      } catch (e) {
        console.error("Offline local restoration failure:", e);
      }
      return;
    }

    setSyncStatus("saving");

    // 1. Listen to root UserLibrary document
    const libRef = doc(db, "userLibraries", user.uid);
    const unsubscribeLib = onSnapshot(libRef, async (docSnap) => {
      try {
        if (docSnap.exists()) {
          const cloudData = docSnap.data();
          setLibrary((prev) => ({
            ...prev,
            favorites: cloudData.favorites || [],
            listeningHistory: cloudData.listeningHistory || [],
            accentColor: cloudData.accentColor || "#8B5CF6",
            glowIntensity: cloudData.glowIntensity || "medium"
          }));
        } else {
          // Document does not exist yet. Initialize cloud record with current state
          const storedLib = localStorage.getItem(LOCAL_STORAGE_LIBRARY_KEY);
          const localSettings = storedLib ? JSON.parse(storedLib) : null;
          const freshLibrary = {
            favorites: localSettings?.favorites || [],
            listeningHistory: localSettings?.listeningHistory || [],
            accentColor: localSettings?.accentColor || "#3b82f6",
            glowIntensity: localSettings?.glowIntensity || "medium",
            userId: user.uid,
            updatedAt: new Date().toISOString()
          };
          await setDoc(libRef, freshLibrary);
        }
        setSyncStatus(isOffline ? "offline" : "synced");
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `userLibraries/${user.uid}`);
      }
    });

    // 2. Listen to custom Playlists subcollection under the user
    const playlistsColRef = collection(db, "userLibraries", user.uid, "playlists");
    const unsubscribePlaylists = onSnapshot(playlistsColRef, (snap) => {
      const dbPlaylists: Playlist[] = [];
      snap.forEach((d) => {
        const pData = d.data();
        dbPlaylists.push({
          id: pData.id,
          name: pData.name,
          description: pData.description || "",
          trackIds: pData.trackIds || [],
          createdAt: pData.createdAt
        });
      });
      setLibrary((prev) => ({
        ...prev,
        playlists: dbPlaylists
      }));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, `userLibraries/${user.uid}/playlists`);
    });

    // 3. Listen to users' own uploaded Custom Tracks
    const q = query(
      collection(db, "tracks"),
      where("userId", "==", user.uid),
      where("isUserUploaded", "==", true)
    );

    const unsubscribeTracks = onSnapshot(q, (snapshot) => {
      const customTracks: Track[] = [];
      snapshot.forEach((doc) => {
        customTracks.push(doc.data() as Track);
      });
      setTracks([...initialTracks, ...customTracks]);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, "tracks");
    });

    // 4. Listen to users' Stripe Premium subscription state in real-time
    const subRef = doc(db, "subscriptions", user.uid);
    const unsubscribeSub = onSnapshot(subRef, (docSnap) => {
      if (docSnap.exists()) {
        const subData = docSnap.data();
        setSubscription({
          status: subData.status || "",
          plan: subData.plan || "",
          currentPeriodEnd: subData.currentPeriodEnd || "",
          subscriptionId: subData.subscriptionId || ""
        });
      } else {
        setSubscription(null);
      }
    }, (err) => {
      console.warn("Real-time subscription listening status unvailable (Guest/New user):", err);
    });

    return () => {
      unsubscribeLib();
      unsubscribePlaylists();
      unsubscribeTracks();
      unsubscribeSub();
    };
  }, [user, isOffline]);

  // Save changes to cloud / local cache
  const saveToPreferences = async (updatedLib: UserLibrary) => {
    setLibrary(updatedLib);
    setSyncStatus("saving");

    if (user) {
      try {
        const path = `userLibraries/${user.uid}`;
        await setDoc(doc(db, "userLibraries", user.uid), {
          favorites: updatedLib.favorites,
          listeningHistory: updatedLib.listeningHistory,
          accentColor: updatedLib.accentColor,
          glowIntensity: updatedLib.glowIntensity,
          userId: user.uid,
          updatedAt: new Date().toISOString()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `userLibraries/${user.uid}`);
      }
    } else {
      localStorage.setItem(LOCAL_STORAGE_LIBRARY_KEY, JSON.stringify(updatedLib));
    }

    setTimeout(() => {
      setSyncStatus(isOffline ? "offline" : "synced");
    }, 800);
  };

  // Toggle Offline listening mode
  const handleToggleOffline = () => {
    const isNextOffline = !isOffline;
    setIsOffline(isNextOffline);
    setSyncStatus(isNextOffline ? "offline" : "synced");
  };

  // Upload custom song
  const handleNewUpload = async (newTrack: Track) => {
    if (user) {
      try {
        const path = `tracks/${newTrack.id}`;
        await setDoc(doc(db, "tracks", newTrack.id), {
          id: newTrack.id,
          title: newTrack.title,
          artist: newTrack.artist,
          duration: newTrack.duration,
          durationSeconds: newTrack.durationSeconds,
          url: newTrack.url,
          coverUrl: newTrack.coverUrl,
          genre: newTrack.genre,
          mood: newTrack.mood,
          downloadUrl: newTrack.downloadUrl,
          flacDownloadUrl: newTrack.flacDownloadUrl,
          lyrics: newTrack.lyrics || "",
          likesCount: newTrack.likesCount,
          playsCount: newTrack.playsCount,
          isUserUploaded: true,
          userId: user.uid,
          createdAt: new Date().toISOString()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `tracks/${newTrack.id}`);
      }
    } else {
      const customTracks = tracks.filter((t) => t.isUserUploaded);
      const updatedCustom = [...customTracks, newTrack];
      localStorage.setItem(LOCAL_STORAGE_TRACKS_KEY, JSON.stringify(updatedCustom));
      setTracks([...initialTracks, ...updatedCustom]);
    }
    
    // Auto-play uploaded tracks
    setCurrentTrack(newTrack);
  };

  // --- Favorites Management ---
  const handleToggleFavorite = (trackId: string) => {
    const isFav = library.favorites.includes(trackId);
    let updatedFavs: string[];
    if (isFav) {
      updatedFavs = library.favorites.filter((id) => id !== trackId);
    } else {
      updatedFavs = [...library.favorites, trackId];
    }
    saveToPreferences({
      ...library,
      favorites: updatedFavs
    });
  };

  // --- Playlists Management ---
  const handleCreatePlaylist = async (name: string, description?: string) => {
    const newPl: Playlist = {
      id: `playlist-${Date.now()}`,
      name,
      description,
      trackIds: [],
      createdAt: new Date().toISOString()
    };

    if (user) {
      try {
        const path = `userLibraries/${user.uid}/playlists/${newPl.id}`;
        await setDoc(doc(db, "userLibraries", user.uid, "playlists", newPl.id), {
          id: newPl.id,
          name: newPl.name,
          description: newPl.description || "",
          trackIds: newPl.trackIds,
          createdAt: newPl.createdAt,
          userId: user.uid
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `userLibraries/${user.uid}/playlists/${newPl.id}`);
      }
    } else {
      saveToPreferences({
        ...library,
        playlists: [...library.playlists, newPl]
      });
    }
  };

  const handleDeletePlaylist = async (id: string) => {
    if (user) {
      try {
        await deleteDoc(doc(db, "userLibraries", user.uid, "playlists", id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `userLibraries/${user.uid}/playlists/${id}`);
      }
    } else {
      const updated = library.playlists.filter((p) => p.id !== id);
      saveToPreferences({
        ...library,
        playlists: updated
      });
    }
  };

  const handleToggleTrackInPlaylist = async (playlistId: string, trackId: string) => {
    const targetPlaylist = library.playlists.find(p => p.id === playlistId);
    if (!targetPlaylist) return;
    const exists = targetPlaylist.trackIds.includes(trackId);
    const updatedTrackIds = exists 
      ? targetPlaylist.trackIds.filter(tid => tid !== trackId)
      : [...targetPlaylist.trackIds, trackId];

    if (user) {
      try {
        await updateDoc(doc(db, "userLibraries", user.uid, "playlists", playlistId), {
          trackIds: updatedTrackIds
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `userLibraries/${user.uid}/playlists/${playlistId}`);
      }
    } else {
      const updatedPLs = library.playlists.map((pl) => {
        if (pl.id !== playlistId) return pl;
        return {
          ...pl,
          trackIds: updatedTrackIds
        };
      });
      saveToPreferences({
        ...library,
        playlists: updatedPLs
      });
    }
  };

  const handlePlayPlaylist = (playlist: Playlist) => {
    if (playlist.trackIds.length === 0) return;
    const plTracks = tracks.filter((t) => playlist.trackIds.includes(t.id));
    if (plTracks.length > 0) {
      setCurrentTrack(plTracks[0]);
    }
  };

  // --- Queue navigation elements ---
  const getFilteredTracks = () => {
    return tracks.filter((tr) => {
      // Offline mode limits view to only those with ready cached state or local uploads
      if (isOffline && !tr.isUserUploaded && tr.id !== "drift-anthem" && tr.id !== "neon-tokyo") {
        return false;
      }
      
      const matchSearch = tr.title.toLowerCase().includes(search.toLowerCase()) || 
                          tr.artist.toLowerCase().includes(search.toLowerCase());
      const matchGenre = selectedGenre === "Todos" || tr.genre === selectedGenre;
      const matchMood = selectedMood === "Todos" || tr.mood === selectedMood;

      return matchSearch && matchGenre && matchMood;
    });
  };

  const filteredTracks = getFilteredTracks();

  const handlePrevTrack = () => {
    if (!currentTrack) return;
    const idx = filteredTracks.findIndex((t) => t.id === currentTrack.id);
    if (idx > 0) {
      setCurrentTrack(filteredTracks[idx - 1]);
    } else {
      setCurrentTrack(filteredTracks[filteredTracks.length - 1]);
    }
  };

  const handleNextTrack = () => {
    if (!currentTrack) return;
    const idx = filteredTracks.findIndex((t) => t.id === currentTrack.id);
    if (idx !== -1 && idx < filteredTracks.length - 1) {
      setCurrentTrack(filteredTracks[idx + 1]);
    } else {
      setCurrentTrack(filteredTracks[0]);
    }
  };

  // Play recommendations dynamically
  const handlePlayRecommendation = (suggested: { title: string; artist: string; genre: string }) => {
    const simulatedTrack: Track = {
      id: `sim-${Date.now()}`,
      title: suggested.title,
      artist: suggested.artist,
      duration: "5:20",
      durationSeconds: 320,
      url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3", // high quality fallback
      coverUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&auto=format&fit=crop&q=80",
      genre: suggested.genre,
      mood: "Hype",
      downloadUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
      flacDownloadUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3?download=flac",
      likesCount: 1,
      playsCount: 1,
      lyrics: `🎵 [Letras generadas para la recomendación]\n[Track: ${suggested.title}]\n\nEstás sintonizando tu recomendación de IA con reproducción en tiempo real.`
    };
    setCurrentTrack(simulatedTrack);
  };

  // Popular Custom Hit list ("Listas de Éxitos") - Curated tracks sorted by playsCount
  const trendingTracks = [...tracks].sort((a, b) => b.playsCount - a.playsCount).slice(0, 4);

  return (
    <div 
      id="main-app-shell" 
      className="min-h-screen pb-44 text-zinc-200 select-none antialiased"
      style={{ 
        "--neon-glow": library.accentColor,
        background: `radial-gradient(circle at top, ${library.accentColor}05 0%, #050505 100%)`
      } as React.CSSProperties}
    >
      
      {/* Top Banner & Navigation Header */}
      <header className="sticky top-0 z-30 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-white/5 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          
          {/* Logo Title */}
          <div className="flex items-center gap-2.5">
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center font-bold font-display text-lg text-black transition-all cursor-pointer"
              style={{ backgroundColor: library.accentColor, boxShadow: `0 0 10px ${library.accentColor}50` }}
              onClick={() => setActiveTab("library")}
            >
              MP
            </div>
            <div>
              <h1 className="text-xl font-bold font-display tracking-tight text-white flex items-center gap-1.5 cursor-pointer" onClick={() => setActiveTab("library")}>
                MyPhonk 
                <span className="text-[10px] font-mono border px-1.5 py-0.2 rounded border-purple-500/30 text-purple-400 capitalize" style={{ color: library.accentColor, borderColor: `${library.accentColor}30` }}>
                  V2.8 Master
                </span>
              </h1>
              <p className="text-[10px] text-zinc-500 font-mono tracking-widest uppercase">Lossless Cowbell Player</p>
            </div>
          </div>

          {/* Central responsive navigation tab bar */}
          <nav className="flex items-center gap-1 border border-white/5 bg-[#050505]/40 backdrop-blur-md p-1 rounded-2xl">
            <button 
              onClick={() => setActiveTab("library")}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${activeTab === "library" ? "text-black" : "text-white/60 hover:text-white"}`}
              style={{ backgroundColor: activeTab === "library" ? library.accentColor : undefined }}
            >
              🎵 Reproductor
            </button>
            <button 
              onClick={() => setActiveTab("premium")}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all relative cursor-pointer flex items-center gap-1.5 ${activeTab === "premium" ? "text-black" : "text-white/60 hover:text-white"}`}
              style={{ backgroundColor: activeTab === "premium" ? library.accentColor : undefined }}
            >
              <span>💎 Premium VIP</span>
              {!isPremium && (
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              )}
            </button>
          </nav>

          {/* Sync status and User Auth */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/5">
              <div 
                className={`w-2 h-2 rounded-full ${
                  syncStatus === "synced" 
                    ? "bg-green-400" 
                    : syncStatus === "saving" 
                    ? "bg-yellow-400 animate-pulse" 
                    : "bg-red-500"
                }`} 
              />
              <span className="text-[10px] font-mono tracking-wide uppercase text-white/60 md:inline hidden">
                {syncStatus === "synced" && "Sincronizado"}
                {syncStatus === "saving" && "Sincronizando..."}
                {syncStatus === "offline" && "Trabajando Offline"}
              </span>
              <span className="text-[10px] font-mono tracking-wide uppercase text-white/60 md:hidden inline">
                {syncStatus === "synced" && "Cloud"}
                {syncStatus === "saving" && "Sinc..."}
                {syncStatus === "offline" && "Local"}
              </span>
            </div>

            {/* User Profile Auth Section */}
            {!authLoading && (
              user ? (
                <div className="flex items-center gap-2 p-1.5 rounded-full bg-white/5 border border-white/10">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.displayName || "Usuario"} className="w-6 h-6 rounded-full border border-white/10" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-white border border-white/10">
                      {user.displayName ? user.displayName.slice(0, 2).toUpperCase() : "US"}
                    </div>
                  )}
                  <span className="text-xs font-semibold text-white max-w-[80px] truncate hidden md:inline">{user.displayName || "Premium"}</span>
                  <button
                    onClick={handleSignOut}
                    className="px-2.5 py-1.5 rounded-lg bg-[#050505] hover:bg-white/10 text-[10px] font-bold text-red-400 hover:text-red-300 transition-colors uppercase tracking-wider cursor-pointer"
                  >
                    Salir
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleSignIn}
                  className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-200 border border-white/10 text-xs font-semibold hover:text-white transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <HelpCircle size={13} className="text-blue-400" style={{ color: library.accentColor }} />
                  <span>Iniciar Sesión</span>
                </button>
              )
            )}

            {/* Upload Track button trigger */}
            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-500 hover:scale-105 active:scale-95 text-black font-semibold text-xs rounded-xl transition-all cursor-pointer shadow-lg shadow-purple-500/10"
              style={{ backgroundColor: library.accentColor }}
            >
              <Plus size={14} />
              <span className="hidden sm:inline">Subir Música</span>
              <span className="sm:hidden inline">Subir</span>
            </button>
          </div>

        </div>
      </header>

      {/* Primary Container Layout */}
      <main className="max-w-7xl mx-auto px-6 py-8 flex flex-col gap-8">
        
        {/* Offline active warning bar */}
        {isOffline && (
          <div className="rounded-2xl bg-red-500/10 border border-red-550/20 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <span className="text-sm font-bold text-red-400 block leading-tight">Modo Offline Activo</span>
              <span className="text-xs text-white/50 mt-1 block">Mostrando solo canciones descargadas localmente y subidas por ti. Letras de IA están en caché.</span>
            </div>
            <button 
              onClick={handleToggleOffline}
              className="px-4 py-2 rounded-xl bg-white/5 border border-white/15 text-xs font-semibold text-white hover:bg-white/10 transition-all cursor-pointer shrink-0"
            >
              Conectar a la Nube
            </button>
          </div>
        )}

        {activeTab === "premium" ? (
          <PremiumPage 
            user={user}
            subscription={subscription}
            onSignIn={handleSignIn}
            accentColor={library.accentColor}
          />
        ) : (
          <>
            {/* AI Recommendations Dashboard section */}
            <Recommendations 
              favorites={tracks.filter(t => library.favorites.includes(t.id))}
              currentMood={selectedMood}
              onPlayRecommendation={handlePlayRecommendation}
              accentColor={library.accentColor}
              isOffline={isOffline}
              isPremium={isPremium}
              userId={user?.uid}
              onOpenPremiumTab={() => setActiveTab("premium")}
            />

            {/* Advanced Filter, Search and Main Song shelf */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
              
              {/* Main List and filtering (col-span-3) */}
              <section className="lg:col-span-3 flex flex-col gap-6">
                
                {/* Control Bar containing Search & Filter Toggles */}
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <div className="relative w-full">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                    <input
                      type="text"
                      placeholder="Buscar canciones, ritmos, productores..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full rounded-2xl bg-white/5 border border-white/10 pl-11 pr-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      style={{ focusRingColor: library.accentColor }}
                    />
                  </div>

                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-semibold border transition-all cursor-pointer shrink-0 ${
                      showFilters || selectedGenre !== "Todos" || selectedMood !== "Todos"
                        ? "bg-white/10 border-white/20 text-white"
                        : "bg-[#0a0a0a] border-white/10 text-white/70 hover:text-white"
                    }`}
                    style={{ 
                      color: showFilters || selectedGenre !== "Todos" || selectedMood !== "Todos" ? "#fff" : undefined,
                      borderColor: showFilters || selectedGenre !== "Todos" || selectedMood !== "Todos" ? `${library.accentColor}40` : undefined,
                      backgroundColor: showFilters || selectedGenre !== "Todos" || selectedMood !== "Todos" ? `${library.accentColor}10` : undefined
                    }}
                  >
                    <SlidersHorizontal size={14} />
                    Filtros
                  </button>
                </div>

                {/* Advanced Filters Expandable Drawer */}
                {(showFilters || selectedGenre !== "Todos" || selectedMood !== "Todos") && (
                  <div className="rounded-2xl bg-[#0a0a0a] border border-white/5 p-5 grid grid-cols-1 sm:grid-cols-2 gap-5 animate-fade-in">
                    {/* Subgenres filter */}
                    <div>
                      <span className="block text-xs font-semibold text-white/40 mb-2.5 uppercase font-mono tracking-wider">Subgénero Popular</span>
                      <div className="flex flex-wrap gap-2">
                        {genres.map((g) => (
                          <button
                            key={g}
                            onClick={() => setSelectedGenre(g)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                              selectedGenre === g
                                ? "text-black font-bold"
                                : "bg-white/5 text-white/60 hover:text-white border border-white/5"
                            }`}
                            style={{ backgroundColor: selectedGenre === g ? library.accentColor : undefined }}
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Mood filter */}
                    <div>
                      <span className="block text-xs font-semibold text-white/40 mb-2.5 uppercase font-mono tracking-wider">Filtrar por Estado de Ánimo</span>
                      <div className="flex flex-wrap gap-2">
                        {moods.map((m) => (
                          <button
                            key={m}
                            onClick={() => setSelectedMood(m)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                              selectedMood === m
                                ? "text-white font-bold border-2"
                                : "bg-white/5 text-white/60 hover:text-white border border-white/5"
                            }`}
                            style={{ 
                              borderColor: selectedMood === m ? library.accentColor : undefined,
                              color: selectedMood === m ? "#fff" : undefined,
                              backgroundColor: selectedMood === m ? `${library.accentColor}15` : undefined
                            }}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Clean Tracklist View */}
                <div className="flex flex-col gap-3">
                  <h3 className="text-sm uppercase tracking-[0.2em] text-white/40 font-display">Canciones Disponibles ({filteredTracks.length})</h3>

                  {filteredTracks.length === 0 ? (
                    <div className="py-16 text-center border border-dashed border-white/5 rounded-2xl bg-[#0a0a0a]/40">
                      <Disc size={36} className="text-white/20 mx-auto mb-2.5 animate-spin [animation-duration:12s]" />
                      <p className="text-sm font-semibold text-white/50">Ningún track coincide con tu búsqueda o filtros.</p>
                      <p className="text-xs text-white/30 mt-1">Intenta restablecer tus filtros o sube tu propia canción.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2.5">
                      {filteredTracks.map((tr) => {
                        const isFav = library.favorites.includes(tr.id);
                        const isPlaying = currentTrack?.id === tr.id;
                        return (
                          <div
                            key={tr.id}
                            className={`group flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                              isPlaying 
                                ? "bg-[#0a0a0a] border-white/10 shadow-[0_0_15px_rgba(255,255,255,0.02)]" 
                                : "bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10"
                            }`}
                            style={{ borderColor: isPlaying ? `${library.accentColor}40` : undefined }}
                          >
                            <div className="flex items-center gap-4 min-w-0">
                              {/* Play circle trigger or dynamic active indicator */}
                              <button
                                onClick={() => setCurrentTrack(tr)}
                                className={`p-2.5 rounded-xl transition-all cursor-pointer shrink-0 ${
                                  isPlaying ? "bg-white text-black" : "bg-white/10 hover:bg-white/20 hover:scale-105"
                                }`}
                                style={{ 
                                  backgroundColor: isPlaying ? library.accentColor : undefined,
                                  color: isPlaying ? "#000" : undefined 
                                }}
                              >
                                <Play size={14} fill="currentColor" />
                              </button>

                              <img src={tr.coverUrl} alt={tr.title} className="w-11 h-11 rounded-lg object-cover border border-white/5 shrink-0" />

                              <div className="min-w-0">
                                <h4 className="text-sm font-semibold text-white truncate leading-tight group-hover:text-blue-400" style={{ groupHover: { color: library.accentColor } }}>
                                  {tr.title}
                                </h4>
                                <div className="flex items-center gap-2 mt-1 truncate">
                                  <span className="text-xs text-white/60 truncate">{tr.artist}</span>
                                  <span className="text-[10px] text-white/30 font-mono shrink-0">•</span>
                                  <span className="text-[10px] text-white/40 font-mono shrink-0 uppercase tracking-wider">{tr.genre}</span>
                                </div>
                              </div>
                            </div>

                            {/* Right tags and actions */}
                            <div className="flex items-center gap-4 shrink-0">
                              <span className="hidden sm:inline-block px-2 py-0.5 rounded-md bg-white/5 border border-white/5 text-[9px] text-white/40 font-mono tracking-wider">
                                {tr.mood}
                              </span>

                              <span className="text-xs font-mono text-white/60">{tr.duration}</span>

                              {/* Fav heart trigger */}
                              <button
                                onClick={() => handleToggleFavorite(tr.id)}
                                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                  isFav ? "text-red-500 bg-red-500/5 hover:bg-red-500/10" : "text-white/40 hover:text-white"
                                }`}
                              >
                                <Heart size={16} fill={isFav ? "currentColor" : "none"} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Custom Interactive Playlists Workspace */}
                <div className="border-t border-white/5 pt-8">
                  <PlaylistsSection 
                    playlists={library.playlists}
                    allTracks={tracks}
                    onPlayPlaylist={handlePlayPlaylist}
                    onCreatePlaylist={handleCreatePlaylist}
                    onDeletePlaylist={handleDeletePlaylist}
                    onToggleTrackInPlaylist={handleToggleTrackInPlaylist}
                    accentColor={library.accentColor}
                  />
                </div>

              </section>

              {/* Right Sidebar panels (Customization, Trending, Offline copy) */}
              <aside className="lg:col-span-1 flex flex-col gap-6">
                
                {/* Customizer */}
                <CustomizationPanel 
                  library={library}
                  onChangeLibrary={saveToPreferences}
                  isOffline={isOffline}
                  onToggleOffline={handleToggleOffline}
                  accentColor={library.accentColor}
                />

                {/* Trending Success Charts list (Listas de Éxitos) */}
                <div className="rounded-2xl bg-[#0a0a0a] border border-white/5 p-5 flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <Flame size={18} className="text-orange-500 shrink-0" />
                    <h4 className="text-xs uppercase tracking-[0.2em] text-white/40 font-display">Listas de Éxitos MyPhonk</h4>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    {trendingTracks.map((tr, index) => (
                      <div 
                        key={tr.id}
                        onClick={() => setCurrentTrack(tr)}
                        className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 cursor-pointer transition-colors"
                      >
                        <span className="text-xs font-mono font-bold text-white/30 hover:text-white w-4 shrink-0">0{index+1}</span>
                        <img src={tr.coverUrl} alt={tr.title} className="w-10 h-10 rounded-lg object-cover border border-white/5 shrink-0" />
                        <div className="min-w-0">
                          <span className="text-xs font-semibold text-white block truncate">{tr.title}</span>
                          <span className="text-[10px] text-white/40 block truncate">{tr.artist}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Static secure user guide card */}
                <div className="rounded-2xl border border-white/5 bg-[#0a0a0a] p-4 relative overflow-hidden">
                  <span className="text-[9px] font-mono uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded" style={{ color: library.accentColor, borderColor: `${library.accentColor}30`, backgroundColor: `${library.accentColor}10` }}>Seguridad Premium</span>
                  <p className="text-xs text-white/60 mt-2.5 leading-relaxed font-sans">
                    MyPhonk se ejecuta bajo un modelo híbrido seguro. Tus llaves de integración y datos del usuario están totalmente aislados de fuentes externas vulnerables.
                  </p>
                </div>

              </aside>

            </div>
          </>
        )}

      </main>

      {/* Embedded Player Bar HUD */}
      <Player 
        currentTrack={currentTrack}
        onPrevTrack={handlePrevTrack}
        onNextTrack={handleNextTrack}
        accentColor={library.accentColor}
        glowIntensity={library.glowIntensity}
        isOffline={isOffline}
        isPremium={isPremium}
        userId={user?.uid}
        onOpenPremiumTab={() => setActiveTab("premium")}
      />

      {/* Uploding track popup modal */}
      {showUploadModal && (
        <UploadModal 
          onClose={() => setShowUploadModal(false)}
          onUpload={handleNewUpload}
          accentColor={library.accentColor}
        />
      )}

    </div>
  );
}

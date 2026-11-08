import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, MotionConfig, useReducedMotion } from 'framer-motion'
import { X, Check } from 'lucide-react'
import { request } from './lib/api.js'
import { getDownloads, getDownload, getDownloadedAudio, markNativeDownload, downloadTrack, removeDownload, updateDownloadedLyrics, getStorageEstimate } from './lib/offline.js'
import { hasNativePlayer, nativeCommand, subscribeNativePlayer, cacheNativeDownload } from './lib/native-player.mjs'
import { nativeTrack, nativeQueue } from './lib/native-queue.mjs'
import { parseLrc, getActiveLyricIndex } from './lib/lyrics.mjs'
import { motionTokens, springs } from './lib/motion.js'
import TrackRow from './components/TrackRow.jsx'
import Sidebar, { MobileNavigation } from './components/Sidebar.jsx'
import Header from './components/Header.jsx'
import PlayerDock from './components/PlayerDock.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import PwaUpdateNotice from './components/PwaUpdateNotice.jsx'
import SmoothScroll from './components/SmoothScroll.jsx'
import GuestPrompt from './components/GuestPrompt.jsx'
import { defaultSettings, readSettings, saveSettings, applySettings, normalizeSettings } from './lib/preferences.js'
import { LanguageProvider } from './lib/i18n.jsx'
import { translate, formatDate } from './lib/i18n.mjs'
import { useAtmosphere } from './lib/useAtmosphere.js'
import { isSpotifyFeed, readSpotifyFeed, chooseTrendingRecommendations } from './lib/trending-recommendations.mjs'
import { rotatePodcastRecommendations } from './lib/recommendation-rotation.mjs'
import { isPodcastEpisode, mediaPath, mediaDetailPath, podcastPathId, readPodcastProgress, savePodcastProgress, creatorEpisodes } from './lib/podcasts.mjs'
import { PodcastEpisodeRow, PodcastResults } from './components/PodcastCards.jsx'
import ChartSource from './components/ChartSource.jsx'
const AppDialogs = lazy(() => import('./components/AppDialogs.jsx'))
const HomePage = lazy(() => import('./pages/HomePage.jsx'))
const SearchPage = lazy(() => import('./pages/SearchPage.jsx'))
const SearchResults = lazy(() => import('./pages/SearchPage.jsx').then(module => ({ default: module.SearchResults })))
const PublicProfilePage = lazy(() => import('./pages/PublicProfilePage.jsx'))
const PublicPlaylistPage = lazy(() => import('./pages/PublicPlaylistPage.jsx'))
const NowPlayingPage = lazy(() => import('./pages/NowPlayingPage.jsx'))
const LibraryPage = lazy(() => import('./pages/LibraryPage.jsx'))
const DownloadsPage = lazy(() => import('./pages/DownloadsPage.jsx'))
const FriendsPage = lazy(() => import('./pages/FriendsPage.jsx'))
const SettingsPage = lazy(() => import('./pages/SettingsPage.jsx'))
const ProfilePage = lazy(() => import('./pages/ProfilePage.jsx'))
const AuthPage = lazy(() => import('./pages/AuthPage.jsx'))
const PodcastsPage = lazy(() => import('./pages/PodcastsPage.jsx'))
const PodcastCreatorPage = lazy(() => import('./pages/PodcastCreatorPage.jsx'))
const PodcastEpisodePage = lazy(() => import('./pages/PodcastEpisodePage.jsx'))
const ArtistPage = lazy(() => import('./pages/ArtistPage.jsx'))
const AlbumPage = lazy(() => import('./pages/AlbumPage.jsx'))

const emptyLibrary = { playlists: [], favoriteIds: [], tracks: [] }
const emptyFriends = { friends: [], incoming: [], outgoing: [] }
const emptyLyrics = { plainLyrics: '', syncedLyrics: '', instrumental: false, source: '' }
const emptyTrending = { tracks: [], updatedAt: null, stale: false, source: '', region: 'ZZ' }
const emptyPodcasts = { creators: [], shows: [], episodes: [], source: '', updatedAt: 0, stale: true }

function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback }
}

function sharedPathId() {
  try { return decodeURIComponent(location.pathname.split('/')[2] || '') } catch { return '' }
}

function pageFromPath() {
  if(location.pathname.startsWith('/u/'))return 'public-profile'
  if(location.pathname.startsWith('/playlist/'))return 'public-playlist'
  if (location.pathname.startsWith('/podcasts/creator/')) return 'podcast-creator'
  if (location.pathname.startsWith('/podcasts/episode/')) return 'podcast-episode'
  if (location.pathname === '/podcasts') return 'podcasts'
  if (location.pathname.startsWith('/track/')) return 'now-playing'
  if (location.pathname.startsWith('/artist/')) return 'artist'
  if (location.pathname.startsWith('/album/')) return 'album'
  if (location.pathname === '/search') return 'search'
  if (location.pathname === '/library') return 'library'
  if (location.pathname === '/downloads') return 'downloads'
  if (location.pathname === '/friends') return 'friends'
  if (location.pathname === '/trending') return 'trending'
  if (location.pathname === '/settings') return 'settings'
  if (location.pathname === '/profile') return 'profile'
  if (location.pathname === '/login') return 'login'
  if (location.pathname === '/register') return 'register'
  return 'discover'
}

function trackFromPath() {
  if (!location.pathname.startsWith('/track/')) return null
  try {
    const id = decodeURIComponent(location.pathname.slice(7))
    return /^yt:[A-Za-z0-9_-]{11}$/.test(id) ? id : null
  } catch { return null }
}

function catalogFromPath(kind) {
  if (!location.pathname.startsWith(`/${kind}/`)) return null
  try {
    const id = decodeURIComponent(location.pathname.slice(kind.length + 2))
    return (kind === 'artist' ? /^UC[A-Za-z0-9_-]{22}$/ : /^MPRE[A-Za-z0-9_-]{4,124}$/).test(id) ? id : null
  } catch { return null }
}

function playlistFromPath() { return new URLSearchParams(location.search).get('playlist') }

function bytes(value = 0) {
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(1)} GB`
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1)} MB`
  return `${Math.ceil((value || 0) / 1024)} KB`
}

function errorMessage(error) { return error?.message || 'Ada kendala. Coba lagi.' }

export default function App() {
  const reduced = useReducedMotion()
  const [view, setView] = useState(pageFromPath)
  const [settings, setSettings] = useState(readSettings)
  const [nativePlayer] = useState(hasNativePlayer)
  const [nativeReady, setNativeReady] = useState(false)
  const t = (text, values) => translate(settings.language, text, values)
  const atmosphere = useAtmosphere()
  const [artistId, setArtistId] = useState(() => catalogFromPath('artist'))
  const [albumId, setAlbumId] = useState(() => catalogFromPath('album'))
  const [artistProfile, setArtistProfile] = useState(null)
  const [albumDetail, setAlbumDetail] = useState(null)
  const [catalogBusy, setCatalogBusy] = useState(false)
  const [artistError, setArtistError] = useState('')
  const [albumError, setAlbumError] = useState('')
  const [followingArtist, setFollowingArtist] = useState(false)
  const [followBusy, setFollowBusy] = useState(false)
  const [followError, setFollowError] = useState('')
  const [followedArtists, setFollowedArtists] = useState([])
  const [catalogRetry, setCatalogRetry] = useState(0)
  const [detailId, setDetailId] = useState(trackFromPath)
  const [detail, setDetail] = useState(null)
  const [detailBusy, setDetailBusy] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [podcastCreatorId, setPodcastCreatorId] = useState(() => podcastPathId(location.pathname, 'creator'))
  const [podcastEpisodeId, setPodcastEpisodeId] = useState(() => podcastPathId(location.pathname, 'episode'))
  const [podcastCreator, setPodcastCreator] = useState(null)
  const [podcastEpisode, setPodcastEpisode] = useState(null)
  const [podcastTranscriptId, setPodcastTranscriptId] = useState(null)
  const [podcastDetailBusy, setPodcastDetailBusy] = useState(false)
  const [podcastDetailError, setPodcastDetailError] = useState('')
  const [podcastDiscovery, setPodcastDiscovery] = useState(() => {
    const cached = read('mi-tune-podcasts', null)
    return cached && Array.isArray(cached.creators) && Array.isArray(cached.episodes) && cached.episodes.every(isPodcastEpisode) ? { ...cached, stale: true } : emptyPodcasts
  })
  const [podcastResults, setPodcastResults] = useState(emptyPodcasts)
  const [podcastQuery, setPodcastQuery] = useState('')
  const [podcastSearched, setPodcastSearched] = useState('')
  const [podcastBusy, setPodcastBusy] = useState(false)
  const [podcastError, setPodcastError] = useState('')
  const [podcastRetry, setPodcastRetry] = useState(0)
  const [searchPodcastData, setSearchPodcastData] = useState(emptyPodcasts)
  const [searchPodcastBusy, setSearchPodcastBusy] = useState(false)
  const [searchPodcastError, setSearchPodcastError] = useState('')
  const [podcastProgress, setPodcastProgress] = useState(() => readPodcastProgress(localStorage))
  const [query, setQuery] = useState('')
  const [searched, setSearched] = useState('')
  const [results, setResults] = useState([])
  const [searchArtists, setSearchArtists] = useState([])
  const [searchAlbums, setSearchAlbums] = useState([])
  const [searchWarnings, setSearchWarnings] = useState([])
  const [searchBusy, setSearchBusy] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [publicPlaylists,setPublicPlaylists]=useState([])
  const [sharedId,setSharedId]=useState(sharedPathId)
  const [sharedData,setSharedData]=useState(null)
  const [sharedBusy,setSharedBusy]=useState(false)
  const [sharedError,setSharedError]=useState('')
  const [sharedRetry,setSharedRetry]=useState(0)
  const [visibilityBusy,setVisibilityBusy]=useState(false)
  const [discovery, setDiscovery] = useState(() => readSpotifyFeed('mi-tune-discovery:spotify-v1', { ...emptyTrending, updatedAt: 0, stale: true }, localStorage))
  const [trending, setTrending] = useState(() => readSpotifyFeed('mi-tune-trending:spotify-v1', emptyTrending, localStorage))
  const [rotation, setRotation] = useState(()=>({ seed:Date.now(), music:read('mi-tune-recent-music',[]), creators:read('mi-tune-recent-creators',[]), episodes:read('mi-tune-recent-episodes',[]) }))
  const [trendingError, setTrendingError] = useState('')
  const [initialBusy, setInitialBusy] = useState(navigator.onLine)
  const [refreshBusy, setRefreshBusy] = useState(false)
  const [user, setUser] = useState(() => read('mi-tune-user', null))
  const [authReady, setAuthReady] = useState(!navigator.onLine)

  const [accountLibrary, setAccountLibrary] = useState(() => {
    const storedUser = read('mi-tune-user', null)
    return storedUser ? read(`mi-tune-library:${storedUser.id}`, emptyLibrary) : emptyLibrary
  })
  const [libraryError, setLibraryError] = useState('')
  const [selectedPlaylist, setSelectedPlaylist] = useState(playlistFromPath)
  const [downloads, setDownloads] = useState([])
  const [storage, setStorage] = useState(null)
  const [friends, setFriends] = useState(emptyFriends)
  const [friendQuery, setFriendQuery] = useState('')
  const [friendResults, setFriendResults] = useState([])
  const [friendBusy, setFriendBusy] = useState(false)
  const [friendSearched, setFriendSearched] = useState(false)
  const [friendActionBusy, setFriendActionBusy] = useState(null)
  const [friendError, setFriendError] = useState('')
  const [online, setOnline] = useState(navigator.onLine)
  const [toast, setToast] = useState(null)
  const [modal, setModal] = useState(null)
  const [authMode, setAuthMode] = useState('login')
  const [authError, setAuthError] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [playlistName, setPlaylistName] = useState('')
  const [playlistBusy, setPlaylistBusy] = useState(false)
  const [playlistError, setPlaylistError] = useState('')
  const [rename, setRename] = useState('')
  const [current, setCurrent] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [queue, setQueue] = useState([])
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(() => Math.max(0, Math.min(1, Number(read('mi-tune-volume', 0.65)) || 0)))
  const [muted, setMuted] = useState(false)
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState('off')
  const [playerLoading, setPlayerLoading] = useState(false)
  const [showLoading, setShowLoading] = useState(false)
  const [playerStatus, setPlayerStatus] = useState('')
  const [playerError, setPlayerError] = useState('')
  const [lyrics, setLyrics] = useState(emptyLyrics)
  const [lyricsBusy, setLyricsBusy] = useState(false)
  const [lyricsError, setLyricsError] = useState('')
  const [lyricRefresh, setLyricRefresh] = useState(0)
  const [preparing, setPreparing] = useState({})
  const [downloadProgress, setDownloadProgress] = useState({})
  const [rightsConfirmed, setRightsConfirmed] = useState(false)
  const [installPrompt, setInstallPrompt] = useState(window.miTuneInstallPrompt || null)
  const [installed, setInstalled] = useState(hasNativePlayer() || matchMedia('(display-mode: standalone)').matches || navigator.standalone === true)
  const audio = useRef(null)
  const playRequest = useRef(0)
  const searchRequest = useRef(0)
  const searchAbort = useRef(null)
  const podcastListAbort = useRef(null)
  const podcastFetchedAt = useRef(0)
  const podcastProgressSavedAt = useRef(0)
  const catalogTarget = useRef(null)
  const toastTimer = useRef(null)
  const loadingTimer = useRef(null)
  const warmAudio = useRef(null)
  const preloaded = useRef(null)
  const authReturn = useRef(new URLSearchParams(location.search).get('next') || '/')
  const settingsRef = useRef(settings)
  const downloadControllers = useRef(new Map())
  const currentRef = useRef(null)
  const queueRef = useRef(queue)
  const routeRef = useRef({ view, detailId, podcastEpisodeId })
  const nativePending = useRef(null)
  const nativeWantsPlay = useRef(false)
  const nativeLoading = useRef(false)
  const ownerRef = useRef('guest')
  const lyricsTargetRef = useRef(null)
  const lyricRefreshTarget = useRef(null)
  const lyricCache = useRef(new Map())
  const known = useRef(new Map())
  const alive = useRef(true)
  const library = user ? accountLibrary : emptyLibrary
  const offlineOwner = user?.id || 'guest'
  ownerRef.current = offlineOwner
  currentRef.current = current
  queueRef.current = queue
  routeRef.current = { view, detailId, podcastEpisodeId }
  settingsRef.current = settings
  catalogTarget.current = { view, artistId, albumId }

  const notify = useCallback((message, tone = 'info', values = {}) => {
    clearTimeout(toastTimer.current)
    setToast({ message, tone, values })
    toastTimer.current = setTimeout(() => setToast(null), 5200)
  }, [])

  const remember = useCallback(tracks => {
    for (const track of tracks || []) if (track?.id) known.current.set(track.id, track)
  }, [])

  useEffect(() => {
    if (!nativePlayer) return
    const receive = state => {
      if (!alive.current) return
      setNativeReady(true)
      if (typeof state.playWhenReady === 'boolean') nativeWantsPlay.current = state.playWhenReady
      if (typeof state.playing === 'boolean') setPlaying(state.playing)
      if (typeof state.loading === 'boolean') {
        nativeLoading.current = state.loading
        setPlayerLoading(state.loading || Boolean(nativePending.current))
        setShowLoading(state.loading || Boolean(nativePending.current))
      }
      if (nativePending.current && state.track?.id !== nativePending.current) return
      if (state.track && (isPodcastEpisode(state.track) || /^yt:[A-Za-z0-9_-]{11}$/.test(state.track.id || ''))) {
        const previous = currentRef.current
        const nextTrack = { ...known.current.get(state.track.id), ...state.track }
        remember([nextTrack])
        currentRef.current = nextTrack
        setCurrent(nextTrack)
        if (nativePending.current === nextTrack.id) nativePending.current = null
        const route = routeRef.current
        if (previous && previous.id !== nextTrack.id && ((route.view === 'now-playing' && route.detailId === previous.id) || (route.view === 'podcast-episode' && route.podcastEpisodeId === previous.id))) openTrack(nextTrack)
      } else if (Object.hasOwn(state, 'track') && state.track === null) { currentRef.current = null; setCurrent(null) }
      if (Array.isArray(state.queue)) {
        const nextQueue = state.queue.map(track => ({ ...known.current.get(track.id), ...track }))
        remember(nextQueue)
        if (nextQueue.map(track => track.id).join('|') !== queueRef.current.map(track => track.id).join('|')) { queueRef.current = nextQueue; setQueue(nextQueue) }
      }
      if (Number.isFinite(state.position)) setPosition(Math.max(0, state.position))
      if (Number.isFinite(state.duration) && state.duration > 0) setDuration(state.duration)
      if (typeof state.error === 'string') setPlayerError(state.error)
      if (typeof state.shuffle === 'boolean') setShuffle(state.shuffle)
      if (['off', 'one', 'all'].includes(state.repeat)) setRepeat(state.repeat)
      if (Number.isFinite(state.volume) && state.volume >= 0 && state.volume <= 1 && state.track) setVolume(state.volume)
      if (typeof state.muted === 'boolean' && state.track) setMuted(state.muted)
      if (state.sleepActive === false && settingsRef.current.sleepMinutes) setSettings(value => ({ ...value, sleepMinutes: 0 }))
      if (Number.isFinite(state.sleepMinutes) && state.sleepMinutes > 0 && settingsRef.current.sleepMinutes !== state.sleepMinutes) setSettings(value => ({ ...value, sleepMinutes: state.sleepMinutes }))
    }
    const unsubscribe = subscribeNativePlayer(receive)
    const restore = () => { if (!document.hidden) nativeCommand('state').catch(error => notify(errorMessage(error), 'error')) }
    document.addEventListener('visibilitychange', restore)
    restore()
    return () => { unsubscribe(); document.removeEventListener('visibilitychange', restore) }
  }, [nativePlayer, notify, remember])

  useEffect(() => {
    if (!nativePlayer || !nativeReady) return
    nativeCommand('preferences', { volume, muted, shuffle, repeat, autoplayNext: settings.autoplayNext, preloadNext: settings.preloadNext, dataSaver: settings.dataSaver, textColor: document.documentElement.style.getPropertyValue('--color-ink'), backgroundColor: document.documentElement.style.getPropertyValue('--color-canvas') }).catch(error => notify(errorMessage(error), 'error'))
  }, [nativePlayer, nativeReady, volume, muted, shuffle, repeat, settings.autoplayNext, settings.preloadNext, settings.dataSaver, settings.textColor, settings.backgroundColor, settings.theme, notify])

  const rotateSuggestions = useCallback(()=>setRotation({seed:Date.now(),music:read('mi-tune-recent-music',[]),creators:read('mi-tune-recent-creators',[]),episodes:read('mi-tune-recent-episodes',[])}),[])
  const recommended = useMemo(()=>chooseTrendingRecommendations(trending,rotation.seed,rotation.music),[trending,rotation])
  const podcastSuggestions = useMemo(()=>rotatePodcastRecommendations(podcastDiscovery,rotation.seed,rotation),[podcastDiscovery,rotation])
  const recommendations = { ...recommended, busy:initialBusy||refreshBusy,stale:trending.stale,error:trendingError,refresh:()=>{rotateSuggestions();loadTrending()} }
  useEffect(()=>{
    if(view!=='discover'&&view!=='podcasts')return
    rotateSuggestions()
    const timer=setInterval(rotateSuggestions,600000)
    return ()=>clearInterval(timer)
  },[view,rotateSuggestions])
  useEffect(()=>{
    try {
      if(view==='discover'&&recommended.tracks.length)localStorage.setItem('mi-tune-recent-music',JSON.stringify(recommended.tracks.map(track=>track.id)))
      if((view==='discover'||view==='podcasts')&&podcastSuggestions.episodes?.length){
        localStorage.setItem('mi-tune-recent-creators',JSON.stringify(podcastSuggestions.creators.slice(0,3).map(creator=>creator.id)))
        localStorage.setItem('mi-tune-recent-episodes',JSON.stringify(podcastSuggestions.episodes.slice(0,view==='discover'?3:12).map(episode=>episode.id)))
      }
    }catch{}
  },[view,recommended,podcastSuggestions])

  useEffect(() => {
    const update = () => applySettings(settings)
    const scheme = matchMedia('(prefers-color-scheme: dark)')
    const motionPreference = matchMedia('(prefers-reduced-motion: reduce)')
    update()
    scheme.addEventListener('change', update)
    motionPreference.addEventListener('change', update)
    return () => {
      scheme.removeEventListener('change', update)
      motionPreference.removeEventListener('change', update)
    }
  }, [settings])

  useEffect(() => {
    const changed = event => {
      if (event.key === 'mi-tune-settings') setSettings(current => ({ ...readSettings(), sleepMinutes: current.sleepMinutes }))
    }
    window.addEventListener('storage', changed)
    return () => window.removeEventListener('storage', changed)
  }, [])

  useEffect(() => {
    const changed = () => { document.documentElement.dataset.documentHidden = String(document.hidden) }
    document.addEventListener('visibilitychange', changed)
    changed()
    return () => document.removeEventListener('visibilitychange', changed)
  }, [])

  useEffect(() => {
    const title = view === 'podcasts' ? t('Podcast') : view === 'podcast-creator' ? podcastCreator?.name || t('Kreator podcast') : view === 'podcast-episode' ? podcastEpisode?.title || t('Episode podcast') : view === 'now-playing' ? detail?.title || t('Lagu') : view === 'artist' ? artistProfile?.name || t('Artis') : view === 'album' ? albumDetail?.title || t('Album') : view === 'search' ? t('Cari musik') : view === 'library' ? t('Koleksi') : view === 'downloads' ? t('Unduhan') : view === 'friends' ? t('Teman') : view === 'settings' ? t('Pengaturan') : view === 'profile' ? t('Profilmu') : view === 'login' ? t('Masuk') : view === 'register' ? t('Daftar') : view === 'trending' ? t('Sedang ramai') : t('Musik untuk ritme harimu')
    document.title = `${title} · Mi Tune`
    const description = document.querySelector('meta[name="description"]')
    if (description) description.content = t('Mi Tune — musik, podcast, dan kreator favoritmu.')
  }, [settings.language, view, detail?.title, artistProfile?.name, albumDetail?.title, podcastCreator?.name, podcastEpisode?.title])

  useEffect(() => {
    const update = event => {
      if (event.key !== 'mi-tune-settings') return
      try {
        const value = { ...normalizeSettings(JSON.parse(event.newValue)), sleepMinutes: settingsRef.current.sleepMinutes }
        settingsRef.current = value
        setSettings(value)
        applySettings(value)
      } catch { }
    }
    window.addEventListener('storage', update)
    return () => window.removeEventListener('storage', update)
  }, [])

  function changeSettings(patch) {
    const nextSettings = normalizeSettings({ ...settingsRef.current, ...patch })
    try {
      const saved = saveSettings(nextSettings)
      applySettings(nextSettings)
      settingsRef.current = nextSettings
      setSettings(nextSettings)
      if (saved === false) notify('Pengaturan diterapkan untuk sesi ini, tetapi belum dapat disimpan di perangkatmu.', 'error')
    } catch {
      applySettings(nextSettings)
      settingsRef.current = nextSettings
      setSettings(nextSettings)
      notify('Pengaturan diterapkan untuk sesi ini, tetapi belum dapat disimpan di perangkatmu.', 'error')
    }
    if (nativePlayer && Object.hasOwn(patch, 'sleepMinutes')) nativeCommand('preferences', { sleepMinutes: nextSettings.sleepMinutes }).catch(error => notify(errorMessage(error), 'error'))
  }

  useEffect(() => {
    remember(discovery.tracks)
    remember(trending.tracks)
    remember(results)
    remember(library.tracks)
    remember(downloads.map(item => item.track))
    remember(podcastDiscovery.episodes)
    remember(podcastResults.episodes)
  }, [discovery, trending, results, library.tracks, downloads, podcastDiscovery, podcastResults, remember])


  useEffect(() => {
    try { localStorage.setItem('mi-tune-user', JSON.stringify(user)) } catch { }
  }, [user])

  const refreshDownloads = useCallback(async () => {
    const owner = ownerRef.current
    try {
      const entries = await getDownloads(owner)
      if (ownerRef.current !== owner) return
      setDownloads(entries)
      setStorage(await getStorageEstimate())
    } catch (error) { notify(errorMessage(error), 'error') }
  }, [notify])

  const refreshLibrary = useCallback(async () => {
    const owner = ownerRef.current
    const data = await request('/library')
    if (ownerRef.current !== owner || owner === 'guest') return data
    setAccountLibrary(data)
    remember(data.tracks)
    setLibraryError('')
    try { localStorage.setItem(`mi-tune-library:${owner}`, JSON.stringify(data)) } catch { }
    return data
  }, [remember])

  const refreshFriends = useCallback(async (strict = false) => {
    const owner = ownerRef.current
    try {
      const data = await request('/friends')
      if (ownerRef.current !== owner || owner === 'guest') return null
      setFriends(data)
      setFriendError('')
      return data
    } catch (error) { setFriendError(errorMessage(error)); if (strict) throw error }
  }, [])

  const refreshFollowedArtists = useCallback(async (strict = false) => {
    const owner = ownerRef.current
    if (owner === 'guest') return []
    try {
      const data = await request('/followed-artists')
      const artists = data.artists || []
      if (ownerRef.current !== owner) return []
      setFollowedArtists(artists)
      try { localStorage.setItem(`mi-tune-followed-artists:${owner}`, JSON.stringify(artists)) } catch { }
      return artists
    } catch (error) { if (strict) throw error; return [] }
  }, [])

  useEffect(() => {
    if (!user) { setFollowedArtists([]); setFollowingArtist(false); return }
    setFollowedArtists(read(`mi-tune-followed-artists:${user.id}`, []))
    if (online && authReady) refreshFollowedArtists()
  }, [user?.id, online, authReady, refreshFollowedArtists])

  useEffect(() => {
    if (view !== 'artist' && view !== 'album') return
    const id = view === 'artist' ? artistId : albumId
    const setError = view === 'artist' ? setArtistError : setAlbumError
    setError('')
    setFollowError('')
    if (!id) { setError(view === 'artist' ? 'Alamat ini tidak berisi ID artis yang valid.' : 'Alamat ini tidak berisi ID album yang valid.'); setCatalogBusy(false); return }
    const controller = new AbortController()
    setCatalogBusy(true)
    request(`/${view === 'artist' ? 'artists' : 'albums'}/${encodeURIComponent(id)}`, { signal: controller.signal }).then(data => {
      if (controller.signal.aborted) return
      const value = view === 'artist' ? data.artist : data.album
      if (value?.id !== id) throw new Error('Data katalog belum dapat dikonfirmasi. Coba lagi.')
      remember(value.tracks)
      if (view === 'artist') { setArtistProfile(value); setFollowingArtist(Boolean(data.following)) }
      else setAlbumDetail(value)
    }).catch(error => { if (!controller.signal.aborted) setError(errorMessage(error)) }).finally(() => { if (!controller.signal.aborted) setCatalogBusy(false) })
    return () => controller.abort()
  }, [view, artistId, albumId, user?.id, authReady, catalogRetry, remember])

  const loadPodcasts = useCallback(async (term = '', refresh = false) => {
    podcastListAbort.current?.abort()
    const controller = new AbortController()
    podcastListAbort.current = controller
    setPodcastBusy(true)
    setPodcastError('')
    const endpoint = term ? `/podcasts/search?q=${encodeURIComponent(term)}` : `/podcasts/discover${refresh ? '?refresh=1' : ''}`
    try {
      const data = await request(endpoint, { signal: controller.signal })
      if (controller.signal.aborted) return
      if (!Array.isArray(data.creators) || !Array.isArray(data.episodes) || !data.episodes.every(isPodcastEpisode)) throw new Error('Podcast belum bisa dimuat. Coba lagi nanti.')
      remember(data.episodes)
      if (term) setPodcastResults(data)
      else {
        setPodcastDiscovery(data)
        podcastFetchedAt.current = Date.now()
        try { localStorage.setItem('mi-tune-podcasts', JSON.stringify(data)) } catch { }
      }
    } catch (error) {
      if (!controller.signal.aborted) setPodcastError(errorMessage(error))
    } finally { if (!controller.signal.aborted) setPodcastBusy(false) }
  }, [remember])

  useEffect(() => {
    if (!online || (view !== 'discover' && view !== 'podcasts')) return
    if (Date.now() - podcastFetchedAt.current < 900000) return
    loadPodcasts()
    return () => podcastListAbort.current?.abort()
  }, [view, online, loadPodcasts])

  useEffect(() => {
    if (view !== 'podcast-creator' && view !== 'podcast-episode') return
    const creatorPage = view === 'podcast-creator'
    const id = creatorPage ? podcastCreatorId : podcastEpisodeId
    setPodcastDetailError('')
    if (!id) { setPodcastDetailError('Alamat podcast ini tidak valid.'); setPodcastDetailBusy(false); return }
    const controller = new AbortController()
    setPodcastDetailBusy(true)
    request(`/podcasts/${creatorPage ? 'creators' : 'episodes'}/${encodeURIComponent(id)}${podcastRetry ? '?refresh=1' : ''}`, { signal: controller.signal }).then(data => {
      if (controller.signal.aborted) return
      const value = creatorPage ? data.creator : data.episode
      if (value?.id !== id || (!creatorPage && !isPodcastEpisode(value))) throw new Error('Podcast belum bisa dimuat. Coba lagi nanti.')
      if (creatorPage) { setPodcastCreator(value); remember(creatorEpisodes(value)) }
      else { setPodcastEpisode(value); remember([value]) }
    }).catch(error => { if (!controller.signal.aborted) setPodcastDetailError(errorMessage(error)) }).finally(() => { if (!controller.signal.aborted) setPodcastDetailBusy(false) })
    return () => controller.abort()
  }, [view, podcastCreatorId, podcastEpisodeId, podcastRetry, online, remember])

  useEffect(() => {
    if (!settings.rememberHistory || !isPodcastEpisode(current)) return
    if (playing && Date.now() - podcastProgressSavedAt.current < 30000) return
    if (savePodcastProgress(current, position, duration || current.duration, localStorage)) {
      podcastProgressSavedAt.current = Date.now()
      setPodcastProgress(readPodcastProgress(localStorage))
    }
  }, [current?.id, position, duration, playing, settings.rememberHistory])

  const loadTrending = useCallback(async () => {
    try {
      const data = await request('/trending')
      if (!alive.current) return
      if (!isSpotifyFeed(data)) throw new Error('Daftar trending belum bisa dimuat. Coba lagi nanti.')
      setTrending(data)
      setDiscovery(data)
      remember(data.tracks)
      setTrendingError('')
      try { localStorage.setItem('mi-tune-trending:spotify-v1', JSON.stringify(data)) } catch { }
    } catch (error) {
      if (!alive.current) return
      setTrendingError(errorMessage(error))
      setTrending(previous => ({ ...previous, stale: true }))
    }
  }, [remember])

  useEffect(()=>{
    const update=()=>{if(navigator.onLine&&document.visibilityState==='visible')loadTrending()}
    const timer=setInterval(update,300000)
    window.addEventListener('focus',update)
    return ()=>{clearInterval(timer);window.removeEventListener('focus',update)}
  },[loadTrending])

  useEffect(() => {
    alive.current = true
    if (navigator.onLine) {
      request('/discover').then(data => {
        if (!alive.current) return
        if (!isSpotifyFeed(data)) throw new Error('Daftar trending belum bisa dimuat. Coba lagi nanti.')
        setDiscovery(data)
        remember(data.tracks)
        try { localStorage.setItem('mi-tune-discovery:spotify-v1', JSON.stringify(data)) } catch { }
      }).catch(error => { if (alive.current) notify(errorMessage(error), 'error') }).finally(() => { if (alive.current) setInitialBusy(false) })
      request('/auth/me').then(data => { if (alive.current) setUser(data.user) }).catch(error => { if (alive.current) notify(errorMessage(error), 'error') }).finally(() => { if (alive.current) setAuthReady(true) })
      loadTrending()
    }
    const connectivity = () => {
      setOnline(navigator.onLine)
      if (navigator.onLine) {
        request('/auth/me').then(data => setUser(data.user)).catch(() => {})
        loadTrending()
      } else setTrending(previous => ({ ...previous, stale: true }))
    }
    const pop = () => {
      setView(pageFromPath())
      setSharedId(sharedPathId())
      setDetailId(trackFromPath())
      setArtistId(catalogFromPath('artist'))
      setAlbumId(catalogFromPath('album'))
      setPodcastCreatorId(podcastPathId(location.pathname, 'creator'))
      setPodcastEpisodeId(podcastPathId(location.pathname, 'episode'))
      setSelectedPlaylist(playlistFromPath())
      setModal(null)
      setAuthError('')
      window.dispatchEvent(new Event('mi-tune:navigate'))
    }
    const install = event => { event.preventDefault();setInstalled(false);setInstallPrompt(event);try{localStorage.removeItem('mi-tune-installed')}catch{} }
    const installReady = () => {const prompt=window.miTuneInstallPrompt||null;setInstallPrompt(prompt);if(prompt&&!nativePlayer){setInstalled(false);try{localStorage.removeItem('mi-tune-installed')}catch{}}}
    const installedEvent = () => {setInstalled(true);setInstallPrompt(null);try{localStorage.setItem('mi-tune-installed','true')}catch{}}
    const displayMode=matchMedia('(display-mode: standalone)')
    const modeChanged=()=>{if(displayMode.matches)installedEvent()}
    displayMode.addEventListener('change',modeChanged)
    const expired = () => {
      setUser(null)
      setAccountLibrary(emptyLibrary)
      setFriends(emptyFriends)
      for (const controller of downloadControllers.current.values()) controller.abort()
      setModal({ type: 'guest', feature: 'session' })
    }
    window.addEventListener('online', connectivity)
    window.addEventListener('offline', connectivity)
    window.addEventListener('popstate', pop)
    window.addEventListener('beforeinstallprompt', install)
    window.addEventListener('mi-tune:install-ready', installReady)
    window.addEventListener('mi-tune:installed', installedEvent)
    window.addEventListener('appinstalled', installedEvent)
    window.addEventListener('mi-tune:auth-required', expired)
    return () => {
      alive.current = false
      playRequest.current += 1
      searchRequest.current += 1
      searchAbort.current?.abort()
      clearTimeout(toastTimer.current)
      clearTimeout(loadingTimer.current)
      for (const controller of downloadControllers.current.values()) controller.abort()
      window.removeEventListener('online', connectivity)
      window.removeEventListener('offline', connectivity)
      window.removeEventListener('popstate', pop)
      window.removeEventListener('beforeinstallprompt', install)
      window.removeEventListener('mi-tune:install-ready', installReady)
      window.removeEventListener('mi-tune:installed', installedEvent)
      window.removeEventListener('appinstalled', installedEvent)
      window.removeEventListener('mi-tune:auth-required', expired)
      displayMode.removeEventListener('change',modeChanged)
    }
  }, [loadTrending, notify, remember])

  useEffect(() => {
    setDownloads([])
    refreshDownloads()
    if (user) {
      setAccountLibrary(read(`mi-tune-library:${user.id}`, emptyLibrary))
      if (online && authReady) {
        refreshLibrary().catch(error => setLibraryError(errorMessage(error)))
        refreshFriends()
      }
    } else { setAccountLibrary(emptyLibrary); setFriends(emptyFriends) }
    window.addEventListener('mi-tune:downloads-changed', refreshDownloads)
    return () => window.removeEventListener('mi-tune:downloads-changed', refreshDownloads)
  }, [user?.id, online, authReady, refreshFriends, refreshLibrary, refreshDownloads])

  useEffect(() => {
    if (!online || !authReady) return
    const events = new EventSource('/api/events')
    events.addEventListener('catalogue', () => {
      request('/discover').then(data => {
        setDiscovery(data)
        remember(data.tracks)
        try { localStorage.setItem('mi-tune-discovery:spotify-v1', JSON.stringify(data)) } catch { }
      }).catch(() => {})
    })
    events.addEventListener('library', () => { if (user) refreshLibrary().catch(() => {}) })
    events.addEventListener('friends', () => refreshFriends())
    events.addEventListener('artists', () => refreshFollowedArtists())
    events.addEventListener('profile', () => {
      if (user) request('/auth/me').then(data => setUser(data.user)).catch(() => {})
    })
    events.addEventListener('job', event => {
      try { const job = JSON.parse(event.data); if (job.track) remember([job.track]) } catch { }
    })
    return () => events.close()
  }, [online, authReady, user?.id, refreshLibrary, refreshFriends, refreshFollowedArtists, remember])

  useEffect(() => {
    if (view !== 'now-playing') return
    let cancelled = false
    setDetailError('')
    if (!detailId) { setDetail(null); setDetailError('Alamat ini tidak berisi ID lagu yang valid.'); setDetailBusy(false); return }
    const local = known.current.get(detailId) || (current?.id === detailId ? current : null) || downloads.find(item => item.track.id === detailId)?.track
    if (local) { setDetail(local); setDetailBusy(false); return }
    setDetail(null)
    setDetailBusy(true)
    request(`/tracks/${encodeURIComponent(detailId)}`, { mediaProof: known.current.get(detailId)?.playbackToken }).then(track => {
      if (!cancelled) { remember([track]); setDetail(track) }
    }).catch(error => { if (!cancelled) setDetailError(errorMessage(error)) }).finally(() => { if (!cancelled) setDetailBusy(false) })
    return () => { cancelled = true }
  }, [view, detailId, downloads, current?.id, remember])

  useEffect(()=>{
    let cancelled=false
    setPublicPlaylists([])
    if(!online||searched.trim().length<2)return
    request(`/public/playlists/search?q=${encodeURIComponent(searched)}`).then(data=>{if(!cancelled){setPublicPlaylists(data.playlists||[]);remember((data.playlists||[]).flatMap(playlist=>playlist.tracks||[]))}}).catch(()=>{})
    return ()=>{cancelled=true}
  },[searched,online,remember])
  useEffect(()=>{
    let cancelled=false
    if(view!=='public-profile'&&view!=='public-playlist')return
    setSharedData(null);setSharedError('');setSharedBusy(true)
    const route=view==='public-profile'?`/public/profiles/${encodeURIComponent(sharedId)}`:`/public/playlists/${encodeURIComponent(sharedId)}`
    request(route).then(data=>{if(!cancelled){setSharedData(data);remember([...(data.favoriteTracks||[]),...(data.playlist?.tracks||[]),...(data.playlists||[]).flatMap(playlist=>playlist.tracks||[])])}}).catch(error=>{if(!cancelled)setSharedError(errorMessage(error))}).finally(()=>{if(!cancelled)setSharedBusy(false)})
    return ()=>{cancelled=true}
  },[view,sharedId,sharedRetry,online,remember])

  const lyricCandidate = view === 'now-playing' ? detail : current
  const lyricTrack = isPodcastEpisode(lyricCandidate) ? null : lyricCandidate
  useEffect(() => {
    let cancelled = false
    const track = lyricTrack
    lyricsTargetRef.current = track?.id || null
    setLyrics(emptyLyrics)
    setLyricsError('')
    if (!track) { setLyricsBusy(false); return }
    setLyricsBusy(true)
    async function load() {
      const imported = read(`mi-tune-lyrics:${offlineOwner}:${track.id}`, null)
      if (imported) return imported
      const local = await getDownload(track.id, offlineOwner).catch(() => null)
      if (local?.lyrics) return local.lyrics
      if (!online) return emptyLyrics
      const refresh = lyricRefreshTarget.current === track.id
      const cached = lyricCache.current.get(track.id)
      if (!refresh && cached && Date.now() - cached.time < (cached.data.matched ? 3600000 : 120000)) return cached.data
      const data = await request(`/tracks/${encodeURIComponent(track.id)}/lyrics${refresh ? '?refresh=1' : ''}`, { mediaProof: track.playbackToken })
      if (data.trackId && data.trackId !== track.id) return emptyLyrics
      lyricCache.current.set(track.id, { data, time: Date.now() })
      if (lyricRefreshTarget.current === track.id) lyricRefreshTarget.current = null
      return data
    }
    load().then(data => { if (!cancelled) setLyrics(data || emptyLyrics) }).catch(error => { if (!cancelled) { setLyrics(emptyLyrics); setLyricsError(errorMessage(error)) } }).finally(() => { if (!cancelled) setLyricsBusy(false) })
    return () => { cancelled = true }
  }, [lyricTrack?.id, online, offlineOwner, lyricRefresh])

  const lines = useMemo(() => parseLrc(lyrics.syncedLyrics || ''), [lyrics.syncedLyrics])
  const activeLine = getActiveLyricIndex(lines, position + settings.lyricOffset)

  useEffect(()=>{
    const complete=()=>request('/auth/me').then(data=>{if(!data.user)throw new Error('Login Google belum berhasil. Coba lagi.');setUser(data.user);if(view==='login'||view==='register')returnFromAuth()}).catch(error=>notify(errorMessage(error),'error'))
    window.addEventListener('mi-tune:google-auth',complete)
    return()=>window.removeEventListener('mi-tune:google-auth',complete)
  },[view,notify])

  function openUserProfile(person) {
    if(!/^[A-Za-z0-9_]{3,24}$/.test(person?.username||''))return
    history.pushState({},'',`/u/${encodeURIComponent(person.username)}`)
    setSharedId(person.username);setSharedRetry(value=>value+1);setView('public-profile');setModal(null);window.scrollTo({top:0,behavior:'instant'})
    window.dispatchEvent(new Event('mi-tune:navigate'))
  }
  function openPublicPlaylist(playlist) {
    const id=typeof playlist==='string'?playlist:playlist?.id
    if(!/^[a-f0-9-]{36}$/.test(id||''))return
    history.pushState({},'',`/playlist/${id}`)
    setSharedId(id);setSharedRetry(value=>value+1);setView('public-playlist');setModal(null);window.scrollTo({top:0,behavior:'instant'})
    window.dispatchEvent(new Event('mi-tune:navigate'))
  }
  async function changeVisibility(id,value) {
    if(!requireAccount('playlist')||visibilityBusy)return
    setVisibilityBusy(true)
    try {
      if(id==='favorites'){
        await request('/profile',{method:'PATCH',body:{likesVisibility:value}})
        const saved=await request('/profile')
        if(saved.user?.likesVisibility!==value)throw new Error('Privasi belum tersimpan. Coba lagi.')
        setUser(saved.user)
      }else{
        await request(`/playlists/${id}`,{method:'PATCH',body:{visibility:value}})
        const saved=await refreshLibrary()
        if(saved?.playlists.find(playlist=>playlist.id===id)?.visibility!==value)throw new Error('Privasi belum tersimpan. Coba lagi.')
      }
      notify('Privasi koleksi diperbarui.')
    }catch(error){notify(errorMessage(error),'error')}finally{setVisibilityBusy(false)}
  }

  function navigate(next, playlist = null) {
    const path = next === 'discover' ? '/' : `/${next}`
    const url = next === 'library' && playlist ? `${path}?playlist=${encodeURIComponent(playlist)}` : path
    if (location.pathname + location.search !== url) history.pushState({}, '', url)
    setView(next)
    setSelectedPlaylist(playlist)
    setModal(null)
    setDetailId(null)
    setArtistId(null)
    setAlbumId(null)
    setPodcastCreatorId(null)
    setPodcastEpisodeId(null)
    window.scrollTo({ top: 0, behavior: 'instant' })
    window.dispatchEvent(new Event('mi-tune:navigate'))
  }

  function goAuth(mode = 'login') {
    if (view !== 'login' && view !== 'register') authReturn.current = location.pathname + location.search
    setAuthMode(mode)
    setAuthError('')
    const next = authReturn.current.startsWith('/') && !authReturn.current.startsWith('//') ? authReturn.current : '/'
    history.pushState({}, '', `/${mode}?next=${encodeURIComponent(next)}`)
    setView(mode)
    setModal(null)
    window.scrollTo({ top: 0, behavior: 'instant' })
    window.dispatchEvent(new Event('mi-tune:navigate'))
  }

  function returnFromAuth() {
    const target = new URL(authReturn.current || '/', location.origin)
    const valid = target.origin === location.origin && /^\/(?:search|library|downloads|friends|profile|settings|trending|u\/[A-Za-z0-9_]{3,24}|playlist\/[a-f0-9-]{36}|podcasts(?:\/(?:creator|episode)\/[^/]+)?|track\/[^/]+|artist\/[^/]+|album\/[^/]+)?$/.test(target.pathname)
    history.pushState({}, '', valid ? target.pathname + target.search : '/')
    setView(pageFromPath())
    setSharedId(sharedPathId())
    setDetailId(trackFromPath())
    setArtistId(catalogFromPath('artist'))
    setAlbumId(catalogFromPath('album'))
    setPodcastCreatorId(podcastPathId(location.pathname, 'creator'))
    setPodcastEpisodeId(podcastPathId(location.pathname, 'episode'))
    setSelectedPlaylist(playlistFromPath())
    setModal(null)
    window.scrollTo({ top: 0, behavior: 'instant' })
    window.dispatchEvent(new Event('mi-tune:navigate'))
  }

  function requireAccount(feature) {
    if (user && authReady) return true
    setModal({ type: 'guest', feature })
    return false
  }

  function choosePlaylist(track) {
    if (requireAccount('playlist')) setModal({ type: 'add-playlist', track })
  }

  function openTrack(track) {
    if (!track) return
    if (isPodcastEpisode(track)) { openPodcastEpisode(track); return }
    remember([track])
    const url = `/track/${encodeURIComponent(track.id)}`
    if (location.pathname !== url) history.pushState({}, '', url)
    setDetailId(track.id)
    setDetail(track)
    setView('now-playing')
    setModal(null)
    window.scrollTo({ top: 0, behavior: 'instant' })
    window.dispatchEvent(new Event('mi-tune:navigate'))
  }

  function openArtist(artist) {
    const id = typeof artist === 'string' ? artist : artist?.id
    if (!/^UC[A-Za-z0-9_-]{22}$/.test(id || '')) { notify('Profil artis belum tersedia dari sumber.'); return }
    const url = `/artist/${encodeURIComponent(id)}`
    if (location.pathname !== url) history.pushState({ miTune: true }, '', url)
    setArtistId(id)
    setAlbumId(null)
    setArtistProfile(previous => previous?.id === id ? previous : null)
    setFollowingArtist(followedArtists.some(item => item.id === id))
    setArtistError('')
    setView('artist')
    setModal(null)
    window.scrollTo({ top: 0, behavior: 'instant' })
    window.dispatchEvent(new Event('mi-tune:navigate'))
  }

  function openAlbum(album) {
    const id = typeof album === 'string' ? album : album?.id
    if (!/^MPRE[A-Za-z0-9_-]{4,124}$/.test(id || '')) { notify('Album belum tersedia dari sumber.'); return }
    const url = `/album/${encodeURIComponent(id)}`
    if (location.pathname !== url) history.pushState({ miTune: true }, '', url)
    setAlbumId(id)
    setArtistId(null)
    setAlbumDetail(previous => previous?.id === id ? previous : null)
    setAlbumError('')
    setView('album')
    setModal(null)
    window.scrollTo({ top: 0, behavior: 'instant' })
    window.dispatchEvent(new Event('mi-tune:navigate'))
  }

  function catalogBack() {
    if (history.state?.miTune && history.length > 1) history.back()
    else navigate('search')
  }

  function openPodcastCreator(creator) {
    const id = typeof creator === 'string' ? creator : creator?.id
    if (!/^UC[A-Za-z0-9_-]{22}$/.test(id || '')) { notify('Profil kreator ini belum tersedia.'); return }
    const url = `/podcasts/creator/${encodeURIComponent(id)}`
    if (location.pathname !== url) history.pushState({ miTune: true }, '', url)
    setPodcastCreatorId(id)
    setPodcastEpisodeId(null)
    setPodcastCreator(previous => previous?.id === id ? previous : null)
    setPodcastDetailError('')
    setView('podcast-creator')
    setModal(null)
    window.scrollTo({ top: 0, behavior: 'instant' })
    window.dispatchEvent(new Event('mi-tune:navigate'))
  }

  function openPodcastEpisode(episode) {
    if (!isPodcastEpisode(episode)) return
    remember([episode])
    const url = mediaDetailPath(episode)
    if (location.pathname !== url) history.pushState({ miTune: true }, '', url)
    setPodcastEpisodeId(episode.id)
    setPodcastCreatorId(null)
    setPodcastEpisode(episode)
    setPodcastDetailError('')
    setView('podcast-episode')
    setModal(null)
    window.scrollTo({ top: 0, behavior: 'instant' })
    window.dispatchEvent(new Event('mi-tune:navigate'))
  }

  function searchPodcasts(term) {
    const trimmed = String(term || '').trim()
    if (trimmed && trimmed.length < 2) { notify('Ketik minimal dua huruf untuk mencari podcast.'); return }
    setPodcastQuery(trimmed)
    setPodcastSearched(trimmed)
    setPodcastResults(emptyPodcasts)
    loadPodcasts(trimmed)
  }

  async function toggleArtistFollow() {
    const id = artistId
    if (!id || followBusy || !requireAccount('artist')) return
    const owner = ownerRef.current
    const following = !followingArtist
    setFollowBusy(true)
    setFollowError('')
    try {
      await request(`/artists/${encodeURIComponent(id)}/follow`, { method: following ? 'PUT' : 'DELETE', ...(following ? { body: {} } : {}) })
      const confirmed = await request(`/artists/${encodeURIComponent(id)}`)
      if (confirmed.artist?.id !== id || confirmed.following !== following) throw new Error('Perubahan mengikuti artis belum dapat dikonfirmasi. Coba lagi.')
      const artists = await refreshFollowedArtists(true)
      if (artists.some(artist => artist.id === id) !== following) throw new Error('Koleksi artis belum diperbarui. Coba lagi.')
      if (ownerRef.current !== owner) return
      if (catalogTarget.current?.artistId === id) { setArtistProfile(confirmed.artist); setFollowingArtist(following) }
      notify(following ? 'Sekarang kamu mengikuti {name}.' : 'Berhenti mengikuti {name}.', 'info', { name: confirmed.artist.name })
    } catch (error) { if (ownerRef.current === owner && catalogTarget.current?.artistId === id) setFollowError(errorMessage(error)) }
    finally { setFollowBusy(false) }
  }

  async function searchMusic(eventOrQuery) {
    const term = typeof eventOrQuery === 'string' ? eventOrQuery : query
    if (typeof eventOrQuery !== 'string') eventOrQuery?.preventDefault()
    if (typeof term !== 'string' || term.trim().length < 2) { notify('Ketik minimal dua huruf untuk mencari musik.'); return }
    const trimmed = term.trim()
    const token = ++searchRequest.current
    searchAbort.current?.abort()
    const controller = new AbortController()
    searchAbort.current = controller
    setQuery(trimmed)
    setSearched(trimmed)
    setSearchBusy(true)
    setSearchError('')
    setSearchPodcastData(emptyPodcasts)
    setSearchPodcastBusy(true)
    setSearchPodcastError('')
    request(`/podcasts/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal }).then(data => {
      if (token !== searchRequest.current || controller.signal.aborted) return
      setSearchPodcastData(data)
      remember(data.episodes)
    }).catch(error => { if (token === searchRequest.current && !controller.signal.aborted) setSearchPodcastError(errorMessage(error)) }).finally(() => { if (token === searchRequest.current && !controller.signal.aborted) setSearchPodcastBusy(false) })
    if (view !== 'now-playing' && view !== 'podcast-episode') navigate('search')
    try {
      const data = await request(`/search/discovery?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal })
      if (token !== searchRequest.current) return
      setResults(data.tracks || [])
      setSearchArtists(data.artists || [])
      setSearchAlbums(data.albums || [])
      setSearchWarnings(data.warnings || [])
      remember(data.tracks)
    } catch (error) {
      if (token === searchRequest.current && error.name !== 'AbortError') { setResults([]); setSearchArtists([]); setSearchAlbums([]); setSearchWarnings([]); setSearchError(errorMessage(error)) }
    } finally { if (token === searchRequest.current) setSearchBusy(false) }
  }

  async function refreshDiscovery() {
    setRefreshBusy(true)
    try {
      const data = await request('/discover/refresh', { method: 'POST' })
      setDiscovery(data)
      remember(data.tracks)
      try { localStorage.setItem('mi-tune-discovery:spotify-v1', JSON.stringify(data)) } catch { }
      await loadTrending()
      notify('Katalog berhasil diperbarui.')
    } catch (error) { notify(errorMessage(error), 'error') } finally { setRefreshBusy(false) }
  }

  function clearLoading() {
    clearTimeout(loadingTimer.current)
    setPlayerLoading(false)
    setShowLoading(false)
    setPlayerStatus('')
  }

  function markLoading() {
    clearTimeout(loadingTimer.current)
    setPlayerLoading(true)
    loadingTimer.current = setTimeout(() => {
      if (nativePlayer ? nativePending.current || nativeLoading.current : audio.current?.src && audio.current.readyState < 3 && !audio.current.paused) setShowLoading(true)
    }, 650)
  }

  async function play(track, list = queue, toggleSame = true) {
    if (!track) return
    if (settingsRef.current.rememberHistory && isPodcastEpisode(currentRef.current)) savePodcastProgress(currentRef.current, audio.current?.currentTime || position, duration, localStorage)
    openTrack(track)
    if (nativePlayer) {
      if (nativePending.current === track.id) return
      if (toggleSame && currentRef.current?.id === track.id && !playerError) { await togglePlayback(); return }
      const token = ++playRequest.current
      nativePending.current = track.id
      markLoading()
      setPlayerError('')
      setPlayerStatus(isPodcastEpisode(track) ? 'Memuat episode…' : 'Memuat lagumu…')
      remember([track])
      try {
        if (currentRef.current) await nativeCommand('pause')
        const downloaded = downloads.some(item => item.available !== false && item.track.id === track.id)
        if (downloaded) await syncNativeDownload(track, offlineOwner)
        if (token !== playRequest.current) return
        if (!online && !downloaded) throw new Error(isPodcastEpisode(track) ? 'Episode ini perlu internet untuk diputar.' : 'Lagu ini belum tersimpan offline. Sambungkan internet dulu, ya.')
        nativeWantsPlay.current = true
        const state = await nativeCommand('play', { track: nativeTrack(track), queue: nativeQueue(list, track), volume, muted, shuffle, repeat, autoplayNext: settingsRef.current.autoplayNext, owner: offlineOwner, position: isPodcastEpisode(track) && settingsRef.current.rememberHistory ? readPodcastProgress(localStorage)[track.id]?.position || 0 : 0 })
        if (state?.track?.id !== track.id) throw new Error('Player Android belum bisa menjalankan perintah ini.')
      } catch (error) {
        nativePending.current = null
        if (token === playRequest.current) { setPlayerError(errorMessage(error)); notify(errorMessage(error), 'error'); nativeCommand('state').catch(() => {}) }
      } finally {
        if (token === playRequest.current) { nativePending.current = null; if (!nativeLoading.current) clearLoading() }
      }
      return
    }
    const element = audio.current
    if (toggleSame && currentRef.current?.id === track.id && element.src && !playerError) {
      await togglePlayback()
      return
    }
    const token = ++playRequest.current
    element.pause()
    setCurrent(track)
    currentRef.current = track
    setQueue(list?.some(item => item.id === track.id) ? list : [track])
    setPosition(0)
    setDuration(track.duration || 0)
    setPlayerError('')
    setPlayerStatus('Memuat lagumu…')
    setShowLoading(false)
    remember([track])
    try {
      const downloaded = downloads.some(item => item.available !== false && item.track.id === track.id)
      if (!navigator.onLine && !downloaded) throw new Error(isPodcastEpisode(track) ? 'Episode ini perlu internet untuk diputar.' : 'Lagu ini belum tersimpan offline. Sambungkan internet dulu, ya.')
      const prepared = known.current.get(track.id) || track
      element.dataset.track = prepared.id
      element.src = mediaPath(prepared, downloaded)
      element.load()
      const resumeAt = isPodcastEpisode(prepared) && settingsRef.current.rememberHistory ? readPodcastProgress(localStorage)[prepared.id]?.position || 0 : 0
      if (resumeAt > 0) element.addEventListener('loadedmetadata', () => { if (element.dataset.track === prepared.id && Number.isFinite(element.duration)) element.currentTime = Math.min(resumeAt, Math.max(0, element.duration - 15)) }, { once: true })
      setCurrent(prepared)
      currentRef.current = prepared
      setDetail(prepared)
      markLoading()
      await element.play()
      if (token === playRequest.current) setPlayerStatus('')
    } catch (error) {
      if (token === playRequest.current && error.name !== 'AbortError') {
        setPlayerError(error.name === 'NotAllowedError' ? 'Audio belum diizinkan di perangkatmu. Tekan Putar untuk melanjutkan.' : error.name === 'NotSupportedError' || element.error ? 'Lagu belum bisa diputar. Cek koneksi, lalu coba lagi.' : errorMessage(error))
        setPlayerStatus('')
      }
    } finally { if (token === playRequest.current) clearLoading() }
  }

  async function openAndPlay(track, list = queue) {
    if (!track) return
    if (nativePlayer && currentRef.current?.id === track.id && !playerError) { openTrack(track); if (!nativeWantsPlay.current) await togglePlayback(); return }
    if (currentRef.current?.id === track.id && audio.current?.src && !playerError) {
      openTrack(track)
      if (audio.current.paused) await togglePlayback()
      return
    }
    await play(track, list, false)
  }

  async function togglePlayback() {
    if (!currentRef.current) return
    if (nativePlayer) {
      if (playerError) { await play(currentRef.current, queue, false); return }
      playRequest.current += 1
      nativePending.current = null
      try { await nativeCommand(nativeWantsPlay.current ? 'pause' : 'resume') } catch (error) { setPlayerError(errorMessage(error)) }
      return
    }
    if (!audio.current.src || playerError) { await play(currentRef.current, queue, false); return }
    if (audio.current.paused) {
      const token = ++playRequest.current
      try { markLoading(); await audio.current.play(); setPlayerError('') } catch (error) { if (token === playRequest.current && error.name !== 'AbortError') setPlayerError(errorMessage(error)) }
      finally { if (token === playRequest.current) clearLoading() }
    } else { playRequest.current += 1; audio.current.pause(); clearLoading() }
  }

  function seek(value) {
    if (nativePlayer) { if (currentRef.current && Number.isFinite(value)) nativeCommand('seek', { position: Math.max(0, Math.min(value, duration || currentRef.current.duration || 0)) }).catch(error => setPlayerError(errorMessage(error))); return }
    if (!audio.current.src || audio.current.readyState === 0 || !Number.isFinite(value)) return
    const end = Number.isFinite(audio.current.duration) ? audio.current.duration : duration
    audio.current.currentTime = Math.max(0, Math.min(value, end || 0))
    setPosition(audio.current.currentTime)
  }

  function next(direction = 1, ended = false) {
    if (!queue.length) return
    if (nativePlayer) {
      if (direction === -1 && position > 3) { seek(0); return }
      playRequest.current += 1
      nativePending.current = null
      nativeCommand(direction === -1 ? 'previous' : 'next').then(state => { if (state?.track) openTrack({ ...known.current.get(state.track.id), ...state.track }) }).catch(error => setPlayerError(errorMessage(error)))
      return
    }
    if (direction === -1 && position > 3) { seek(0); return }
    const index = queue.findIndex(track => track.id === currentRef.current?.id)
    if (ended && !shuffle && index === queue.length - 1 && repeat === 'off') { setPlaying(false); return }
    const target = (index + direction + queue.length) % queue.length
    if (shuffle && queue.length > 1) {
      const choices = queue.filter(track => track.id !== currentRef.current?.id)
      play(choices[Math.floor(Math.random() * choices.length)], queue, false)
    } else play(queue[target], queue, false)
  }

  function cycleRepeat() { setRepeat(previous => previous === 'off' ? 'all' : previous === 'all' ? 'one' : 'off') }
  function changeVolume(value) { setVolume(value); if (value > 0) setMuted(false) }


  useEffect(() => {
    if (nativePlayer || !playing || isPodcastEpisode(current) || !online || !settings.preloadNext || settings.dataSaver || navigator.connection?.saveData || shuffle || repeat === 'one' || queue.length < 2) {
      if (warmAudio.current?.getAttribute('src')) { warmAudio.current.removeAttribute('src'); warmAudio.current.load() }
      preloaded.current = null
      return
    }
    const index = queue.findIndex(track => track.id === current?.id)
    if (index < 0 || (index === queue.length - 1 && repeat === 'off')) return
    const nextTrack = queue[(index + 1) % queue.length]
    if (isPodcastEpisode(nextTrack)) return
    if (nextTrack.id === current?.id || preloaded.current === nextTrack.id) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        if (downloads.some(item => item.available !== false && item.track.id === nextTrack.id)) return
        const result = await request('/media/preload', { method: 'POST', body: { trackId: nextTrack.id }, mediaProof: nextTrack.playbackToken, signal: controller.signal })
        if (controller.signal.aborted || !result.ready) return
        preloaded.current = nextTrack.id
        if (warmAudio.current) {
          warmAudio.current.src = mediaPath(nextTrack)
          warmAudio.current.load()
        }
      } catch { }
    }, 1800)
    return () => { clearTimeout(timer); controller.abort() }
  }, [current?.id, playing, queue, online, shuffle, repeat, settings.preloadNext, settings.dataSaver, downloads])

  useEffect(() => {
    if (nativePlayer || !settings.sleepMinutes) return
    const timer = setTimeout(() => {
      audio.current?.pause()
      changeSettings({ sleepMinutes: 0 })
      notify('Musik dijeda. Selamat istirahat.')
    }, settings.sleepMinutes * 60000)
    return () => clearTimeout(timer)
  }, [settings.sleepMinutes])

  useEffect(() => {
    if (!nativePlayer && audio.current) { audio.current.volume = volume; audio.current.muted = muted }
    try { localStorage.setItem('mi-tune-volume', JSON.stringify(volume)) } catch { }
  }, [volume, muted])

  useEffect(() => {
    if (nativePlayer || !current || !('mediaSession' in navigator)) return
    navigator.mediaSession.metadata = new MediaMetadata({ title: current.title, artist: current.artist, album: current.album || '', artwork: current.thumbnail ? [{ src: new URL(current.coverUrl, location.origin).href }] : [] })
    const handlers = { play: () => { if (audio.current?.paused) togglePlayback() }, pause: () => audio.current?.pause(), previoustrack: () => next(-1), nexttrack: () => next(1), seekto: event => seek(event.seekTime), seekbackward: event => seek(audio.current.currentTime - (event.seekOffset || 10)), seekforward: event => seek(audio.current.currentTime + (event.seekOffset || 10)) }
    for (const [action, handler] of Object.entries(handlers)) { try { navigator.mediaSession.setActionHandler(action, handler) } catch { } }
    navigator.mediaSession.playbackState = playing ? 'playing' : 'paused'
    return () => { for (const action of Object.keys(handlers)) { try { navigator.mediaSession.setActionHandler(action, null) } catch { } } }
  }, [current?.id, current?.title, current?.artist, current?.coverUrl, playing, queue, repeat, shuffle, playerLoading, playerError])

  useEffect(() => {
    if (nativePlayer || !current || !('mediaSession' in navigator) || !navigator.mediaSession.setPositionState || !Number.isFinite(duration) || duration <= 0) return
    try { navigator.mediaSession.setPositionState({ duration, playbackRate: 1, position: Math.max(0, Math.min(position, duration)) }) } catch { }
  }, [current?.id, position, duration])

  useEffect(() => {
    const keydown = event => {
      if (!settings.keyboardShortcuts || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || document.activeElement?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(document.activeElement?.tagName) || modal) return
      if (event.code === 'Space' && current) { event.preventDefault(); togglePlayback() }
      if (event.key === 'ArrowRight' && current) { event.preventDefault(); seek((nativePlayer ? position : audio.current.currentTime) + 5) }
      if (event.key === 'ArrowLeft' && current) { event.preventDefault(); seek((nativePlayer ? position : audio.current.currentTime) - 5) }
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [current, playing, position, modal, playerError, playerLoading, settings.keyboardShortcuts])

  function updateQueue(change) {
    const nextQueue = typeof change === 'function' ? change(queueRef.current) : change
    if (nativePlayer && nextQueue.length > 200) { notify('Antrean maksimal 200 audio.'); return }
    if (nativePlayer && currentRef.current && !nextQueue.some(track => track.id === currentRef.current.id)) { notify('Audio yang sedang diputar tetap ada di antrean.'); return }
    queueRef.current = nextQueue
    setQueue(nextQueue)
    if (nativePlayer && currentRef.current) nativeCommand('queue', { queue: nativeQueue(nextQueue, currentRef.current) }).catch(error => { notify(errorMessage(error), 'error'); nativeCommand('state').catch(() => {}) })
  }

  function addQueue(track) {
    updateQueue(previous => previous.some(item => item.id === track.id) ? previous : [...previous, track])
    remember([track])
    notify('Ditambahkan ke antrean: {title}', 'info', { title: track.title })
  }


  async function toggleFavorite(track) {
    if (!requireAccount('favorites')) return
    const liked = !library.favoriteIds.includes(track.id)
    setLibraryError('')
    try {
      await request(`/favorites/${encodeURIComponent(track.id)}`, { method: 'PUT', body: { liked, trackId: track.id, mediaProof: track.playbackToken } })
      await refreshLibrary()
    } catch (error) { setLibraryError(errorMessage(error)); notify(errorMessage(error), 'error') }
  }

  function createPlaylist(track = null) {
    if (!requireAccount('playlist')) return
    setPlaylistName('')
    setPlaylistError('')
    setModal({ type: 'new-playlist', track })
  }

  async function submitPlaylist(event) {
    event.preventDefault()
    if (!requireAccount('playlist')) return
    if (!playlistName.trim()) return
    setPlaylistBusy(true)
    setPlaylistError('')
    const track = modal.track
    try {
      const created = await request('/playlists', { method: 'POST', body: { name: playlistName.trim(), cover: null } })
      if (track) await request(`/playlists/${created.id}/tracks`, { method: 'PUT', body: { trackIds: [track.id], trackId: track.id, mediaProof: track.playbackToken } })
      await refreshLibrary()
      setModal(null)
      if (view === 'library') setSelectedPlaylist(created.id)
      notify(track ? 'Playlist dibuat dengan {title}.' : 'Playlist baru siap diisi.', 'info', { title: track?.title })
    } catch (error) { setPlaylistError(errorMessage(error)) } finally { setPlaylistBusy(false) }
  }

  async function addToPlaylist(playlist, track) {
    if (!requireAccount('playlist')) return
    const trackIds = [...new Set([...playlist.trackIds, track.id])]
    try {
      await request(`/playlists/${playlist.id}/tracks`, { method: 'PUT', body: { trackIds, trackId: track.id, mediaProof: track.playbackToken } })
      await refreshLibrary()
      setModal(null)
      notify('Ditambahkan ke {name}.', 'info', { name: playlist.name })
    } catch (error) { notify(errorMessage(error), 'error') }
  }

  async function updatePlaylistTracks(playlist, trackIds) {
    if (!requireAccount('playlist')) return
    try {
      await request(`/playlists/${playlist.id}/tracks`, { method: 'PUT', body: { trackIds } })
      await refreshLibrary()
    } catch (error) { notify(errorMessage(error), 'error') }
  }

  function movePlaylistTrack(playlist, id, direction) {
    const ids = [...playlist.trackIds]
    const index = ids.indexOf(id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= ids.length) return
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    updatePlaylistTracks(playlist, ids)
  }

  async function saveArtwork(playlist, cover) {
    if (!requireAccount('playlist')) throw new Error('Masuk dulu untuk mengubah playlist.')
    await request(`/playlists/${playlist.id}`, { method: 'PATCH', body: { cover } })
    const refreshed = await refreshLibrary()
    if (refreshed.playlists.find(item => item.id === playlist.id)?.cover !== cover) throw new Error('Sampul belum tersimpan. Coba lagi.')
    notify('Sampul playlist berhasil disimpan.')
  }

  async function saveRename(event) {
    event.preventDefault()
    if (!requireAccount('playlist')) return
    setPlaylistBusy(true)
    setPlaylistError('')
    try {
      const playlist = modal.playlist
      await request(`/playlists/${playlist.id}`, { method: 'PATCH', body: { name: rename.trim() } })
      await refreshLibrary()
      setModal(null)
    } catch (error) { setPlaylistError(errorMessage(error)) } finally { setPlaylistBusy(false) }
  }

  async function deletePlaylist(playlist) {
    if (!requireAccount('playlist')) return
    try {
      await request(`/playlists/${playlist.id}`, { method: 'DELETE' })
      await refreshLibrary()
      navigate('library')
      notify('Playlist dihapus. Lagu dan unduhanmu tetap ada.')
    } catch (error) { notify(errorMessage(error), 'error') }
  }

  function confirmDownload(track) {
    if (!requireAccount('downloads')) return
    setRightsConfirmed(false)
    setModal({ type: 'download', track })
  }

  async function startDownload() {
    if (!requireAccount('downloads')) return
    if (!rightsConfirmed) return
    const track = modal.track
    const owner = offlineOwner
    if (downloadControllers.current.has(track.id)) { notify('Lagu ini sedang diunduh.'); return }
    const controller = new AbortController()
    downloadControllers.current.set(track.id, controller)
    setModal(null)
    setDownloadProgress(previous => ({ ...previous, [track.id]: 0 }))
    setPreparing(previous => ({ ...previous, [track.id]: true }))
    try {
      const prepared = known.current.get(track.id) || track
      let available = emptyLyrics
      try { available = read(`mi-tune-lyrics:${owner}:${track.id}`, null) || await request(`/tracks/${encodeURIComponent(track.id)}/lyrics`, { mediaProof: track.playbackToken }) } catch { }
      await downloadTrack(prepared, available, { owner, signal: controller.signal, onProgress: progress => setDownloadProgress(previous => ({ ...previous, [track.id]: progress.percent ?? 0 })) })
      if (nativePlayer) await syncNativeDownload(prepared, owner)
      await refreshDownloads()
      notify('Siap didengar offline: {title}', 'info', { title: track.title })
    } catch (error) { notify(error.name === 'AbortError' ? 'Unduhan dibatalkan.' : errorMessage(error), 'error') } finally {
      downloadControllers.current.delete(track.id)
      setPreparing(previous => { const updated = { ...previous }; delete updated[track.id]; return updated })
      setDownloadProgress(previous => { const updated = { ...previous }; delete updated[track.id]; return updated })
    }
  }

  async function deleteDownload(track) {
    if (!requireAccount('downloads')) return
    try { if (nativePlayer) await nativeCommand('cache-delete', { trackId: track.id, owner: offlineOwner }); await removeDownload(track.id, offlineOwner); await refreshDownloads(); setModal(null); notify('Unduhan dihapus.') } catch (error) { notify(errorMessage(error), 'error') }
  }

  async function syncNativeDownload(track, owner) {
    const entry = await getDownload(track.id, owner)
    const blob = await getDownloadedAudio(track.id, owner)
    if (!entry || !blob) throw new Error('Audio unduhan belum tersedia di perangkat ini.')
    if (!await cacheNativeDownload({ ...entry, track: nativeTrack(entry.track), audio: blob }, owner)) throw new Error('Audio unduhan belum tersimpan lengkap di player Android.')
    await markNativeDownload(track.id, owner)
  }

  async function importLyrics(event, track) {
    const file = event.target.files?.[0]
    if (!file || !track) return
    try {
      if (file.size > 100000) throw new Error('File LRC maksimal 100 KB.')
      const text = await file.text()
      if (!parseLrc(text).length) throw new Error('File ini tidak berisi timestamp LRC yang valid.')
      const titleTag = /\[ti:([^\]]+)\]/i.exec(text)?.[1]?.trim()
      const artistTag = /\[ar:([^\]]+)\]/i.exec(text)?.[1]?.trim()
      const sameName = (a, b) => a.normalize('NFKC').replace(/[^\p{L}\p{N}]/gu, '').toLowerCase() === b.normalize('NFKC').replace(/[^\p{L}\p{N}]/gu, '').toLowerCase()
      if (titleTag && !sameName(titleTag, track.title)) throw new Error('Judul di file LRC tidak cocok dengan lagu ini.')
      if (artistTag && !(track.artists || [track.artist]).some(artist => sameName(artistTag, artist))) throw new Error('Artis di file LRC tidak cocok dengan lagu ini.')
      const imported = { trackId: track.id, plainLyrics: '', syncedLyrics: text, instrumental: false, source: 'LRC pribadi', matched: true }
      localStorage.setItem(`mi-tune-lyrics:${offlineOwner}:${track.id}`, JSON.stringify(imported))
      if (lyricsTargetRef.current === track.id) setLyrics(imported)
      await updateDownloadedLyrics(track.id, imported, offlineOwner)
      setModal(null)
      notify('Lirik LRC berhasil dimuat.')
    } catch (error) { notify(errorMessage(error), 'error') } finally { event.target.value = '' }
  }

  async function submitAuth(event) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    setAuthBusy(true)
    setAuthError('')
    let registered = false
    try {
      if (view === 'register') {
        await request('/auth/register', { method: 'POST', body: { username: values.get('username'), displayName: values.get('displayName'), password: values.get('password') } })
        registered = true
      }
      await request('/auth/login', { method: 'POST', body: { username: values.get('username'), password: values.get('password') } })
      const data = await request('/auth/me')
      if (!data.user) throw new Error('Sesi belum dibuat. Coba masuk lagi.')
      setUser(data.user)
      setAuthReady(true)
      returnFromAuth()
      notify('Selamat datang, {name}.', 'info', { name: data.user.displayName })
    } catch (error) { if (registered) { goAuth('login'); setAuthError('Akunmu sudah dibuat. Masuk sekali lagi untuk melanjutkan.') } else setAuthError(errorMessage(error)) } finally { setAuthBusy(false) }
  }

  async function logout() {
    try {
      await request('/auth/logout', { method: 'POST' })
      const result = await request('/auth/me')
      if (result.user) throw new Error('Sesi belum berakhir. Coba keluar lagi.')
      for (const controller of downloadControllers.current.values()) controller.abort()
      setUser(null)
      setAccountLibrary(emptyLibrary)
      setFriends(emptyFriends)
      setFriendResults([])
      setFriendQuery('')
      setFriendSearched(false)
      notify('Sudah keluar. Musikmu tetap berjalan.')
    } catch (error) { notify(errorMessage(error), 'error'); throw error }
  }

  async function findFriends(event) {
    event.preventDefault()
    if (friendBusy) return
    if (!requireAccount('friends')) return
    if (friendQuery.trim().length < 2) { setFriendError('Ketik setidaknya dua huruf.'); return }
    setFriendBusy(true)
    setFriendSearched(true)
    setFriendError('')
    try { setFriendResults(await request(`/users?q=${encodeURIComponent(friendQuery)}`)) } catch (error) { setFriendError(errorMessage(error)) } finally { setFriendBusy(false) }
  }

  async function sendFriend(id) {
    if (!requireAccount('friends') || friendActionBusy) return
    setFriendActionBusy(id)
    try {
      await request('/friend-requests', { method: 'POST', body: { userId: id } })
      const state = await refreshFriends(true)
      if (!state || (!state.outgoing.some(item => item.user.id === id) && !state.friends.some(item => item.id === id))) throw new Error('Undangan belum bisa dikonfirmasi. Muat ulang daftar teman.')
      notify('Undangan terkirim. Menunggu jawaban temanmu.')
    } catch (error) { setFriendError(errorMessage(error)) } finally { setFriendActionBusy(null) }
  }

  async function respondFriend(id, action) {
    if (!requireAccount('friends') || friendActionBusy) return
    setFriendActionBusy(id)
    const target = friends.incoming.find(item => item.id === id)?.user.id
    try {
      await request(`/friend-requests/${id}`, { method: 'PATCH', body: { action } })
      const state = await refreshFriends(true)
      if (!state || state.incoming.some(item => item.id === id) || (action === 'accept' && target && !state.friends.some(item => item.id === target))) throw new Error('Jawaban belum bisa dikonfirmasi. Muat ulang daftar teman.')
      notify(action === 'accept' ? 'Sekarang kalian terhubung.' : 'Undangan ditolak.')
    } catch (error) { setFriendError(errorMessage(error)) } finally { setFriendActionBusy(null) }
  }

  async function cancelFriend(id) {
    if (!requireAccount('friends') || friendActionBusy) return
    setFriendActionBusy(id)
    try {
      await request(`/friend-requests/${id}`, { method: 'DELETE' })
      const state = await refreshFriends(true)
      if (!state || state.outgoing.some(item => item.id === id)) throw new Error('Pembatalan belum bisa dikonfirmasi. Muat ulang daftar teman.')
      notify('Undangan dibatalkan.')
    } catch (error) { setFriendError(errorMessage(error)) } finally { setFriendActionBusy(null) }
  }

  async function saveProfile(patch) {
    if (!requireAccount('profile')) throw new Error('Masuk dulu untuk mengubah profil.')
    await request('/profile', { method: 'PATCH', body: patch })
    const result = await request('/profile')
    if (!result.user || result.user.id !== user.id) throw new Error('Profil belum tersimpan. Coba lagi.')
    for (const [key, value] of Object.entries(patch)) if ((result.user[key] ?? '') !== (value ?? '')) throw new Error('Ada perubahan profil yang belum tersimpan. Coba lagi.')
    setUser(result.user)
    notify('Profilmu sudah diperbarui.')
    return result.user
  }

  async function changePassword(value) {
    if (!requireAccount('profile')) throw new Error('Masuk dulu untuk mengubah password.')
    await request('/auth/password', { method: 'POST', body: value })
    const result = await request('/auth/me')
    if (!result.user) throw new Error('Password berubah. Masuk lagi untuk melanjutkan.')
    notify('Password diperbarui. Sesi di perangkat lain sudah ditutup.')
  }

  async function removeFriend(person) {
    if (!requireAccount('friends') || friendActionBusy) return
    setFriendActionBusy(person.id)
    try {
      await request(`/friends/${person.id}`, { method: 'DELETE' })
      const state = await refreshFriends(true)
      if (!state || state.friends.some(item => item.id === person.id)) throw new Error('Perubahan belum bisa dikonfirmasi. Muat ulang daftar teman.')
      setModal(null)
      notify('Teman dihapus dari daftar.')
    } catch (error) { setFriendError(errorMessage(error)); setModal(null) } finally { setFriendActionBusy(null) }
  }

  async function installApp() {
    if (installed) { notify('Mi Tune sudah terinstal.'); return }
    if (!installPrompt) { setModal({ type: 'install' }); return }
    const prompt = installPrompt
    try {
      await prompt.prompt()
      await prompt.userChoice
    } catch (error) {
      if (error.name !== 'AbortError') setModal({ type: 'install' })
    } finally {
      window.miTuneInstallPrompt = null
      setInstallPrompt(null)
    }
  }

  function tracksFor(ids) { return ids.map(id => known.current.get(id) || library.tracks.find(track => track.id === id)).filter(Boolean) }

  async function shareAudio(item) {
    if (!item) return
    const url = new URL(mediaDetailPath(item), location.origin).href
    try {
      if (navigator.share) await navigator.share({ title: item.title, text: item.artist, url })
      else if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(url); notify('Tautan audio disalin.') }
      else notify('Bagikan alamat halaman ini dari menu perangkatmu.')
    } catch (error) { if (error.name !== 'AbortError') notify('Tautan belum bisa dibagikan. Coba lagi.', 'error') }
  }

  function renderEpisodes(episodes, queueEpisodes = episodes) {
    return <div className="space-y-3">{episodes.filter(isPodcastEpisode).map(episode => <PodcastEpisodeRow key={episode.id} episode={episode} active={current?.id === episode.id} playing={playing} busy={showLoading && current?.id === episode.id} onPlay={() => play(episode, queueEpisodes)} onOpen={openPodcastEpisode} onCreator={openPodcastCreator} onQueue={addQueue} progress={settings.rememberHistory ? podcastProgress[episode.id] : null} />)}</div>
  }

  function renderTracks(tracks, trailing, queueTracks = tracks) {
    return <div>{tracks.map((track, index) => isPodcastEpisode(track) ? <PodcastEpisodeRow key={track.id} episode={track} active={current?.id === track.id} playing={playing} busy={showLoading && current?.id === track.id} onPlay={() => play(track, queueTracks)} onOpen={openPodcastEpisode} onCreator={openPodcastCreator} onQueue={addQueue} progress={settings.rememberHistory ? podcastProgress[track.id] : null} /> : <TrackRow key={`${track.id}-${index}`} track={track} index={track.chartRank || track.position || index + 1} onOpen={() => openAndPlay(track, queueTracks)} onArtist={openArtist} onPlay={() => play(track, queueTracks)} onFavorite={toggleFavorite} onDownload={confirmDownload} onPlaylist={choosePlaylist} onQueue={addQueue} favorite={library.favoriteIds.includes(track.id)} downloaded={downloads.some(item => item.available !== false && item.track.id === track.id)} active={current?.id === track.id} playing={playing} busy={showLoading && current?.id === track.id} downloadBusy={Boolean(preparing[track.id])} trailing={trailing?.(track)} />)}</div>
  }

  const selectedTrack = detail?.id === detailId ? detail : null
  const focusSearch = () => { document.getElementById('music-search')?.focus(); window.scrollTo({ top: 0, behavior: 'instant' }) }
  const openAuth = () => goAuth('login')
  const authPage = view === 'login' || view === 'register'
  const fullPlayer = Boolean(current && ((view === 'now-playing' && detailId === current.id) || (view === 'podcast-episode' && podcastEpisodeId === current.id)))

  return <LanguageProvider language={settings.language}><MotionConfig reducedMotion={!settings.animations || reduced ? 'always' : 'user'} transition={springs.gentle}>
    <SmoothScroll enabled={settings.smoothScroll && settings.animations} />
    <a href="#main-content" className="sr-only fixed left-5 top-4 z-[80] rounded-xl bg-ink px-5 py-3 text-sm font-bold text-white focus:not-sr-only">{t('Lewati ke konten utama')}</a>
    {!authPage && <Sidebar installed={installed} view={view} user={user} library={library} tracksFor={tracksFor} selectedPlaylist={selectedPlaylist} onNavigate={navigate} onPlaylist={id => user ? navigate('library', id) : requireAccount(id === 'favorites' ? 'favorites' : 'playlist')} onCreate={() => createPlaylist()} onInstall={installApp} downloadsCount={user ? downloads.filter(item => item.available !== false).length : 0} incomingCount={friends.incoming.length} />}
    <div className={`app-shell ${authPage ? '' : 'lg:pl-[224px]'}`} data-has-track={Boolean(current)} data-full-player={fullPlayer} data-auth-page={authPage}>
      <Header view={view} onMenu={() => setModal({ type: 'mobile-menu' })} menuOpen={modal?.type === 'mobile-menu'} query={query} onQuery={setQuery} onSearch={searchMusic} searchBusy={searchBusy} user={user} authReady={authReady} online={online} onAuth={openAuth} onProfile={() => navigate('profile')} onSettings={() => navigate('settings')} onHome={() => authPage ? returnFromAuth() : navigate('discover')} authPage={authPage} />
      <main id="main-content" data-page={view} className="mx-auto max-w-[1230px] px-5 pb-[calc(190px_+_env(safe-area-inset-bottom))] pt-7 sm:px-8 sm:pt-8 lg:px-9 lg:pb-36">
        <ErrorBoundary key={view} fallback={<div role="alert" className="clay-panel p-7"><p className="mb-4 text-sm">{t('Halaman ini mengalami error. Pemutar musik dan navigasi tetap bisa digunakan.')}</p><button type="button" className="clay-button" onClick={() => navigate('discover')}>{t('Kembali ke beranda')}</button></div>}>
        <Suspense fallback={<div role="status" className="clay-panel p-7 text-sm text-muted">{t('Memuat…')}</div>}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={view} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced || !settings.animations ? 0 : motionTokens.duration.fast }}>
            {view==='public-profile'&&<PublicProfilePage data={sharedData} busy={sharedBusy} error={sharedError} onBack={()=>navigate('discover')} onRetry={()=>setSharedRetry(value=>value+1)} onPlaylist={openPublicPlaylist} onUser={openUserProfile} onPlay={play} current={current} playing={playing}/>}
            {view==='public-playlist'&&<PublicPlaylistPage data={sharedData} busy={sharedBusy} error={sharedError} onBack={()=>navigate('discover')} onRetry={()=>setSharedRetry(value=>value+1)} onUser={openUserProfile} onPlay={play} current={current} playing={playing}/>}
            {view === 'discover' && <HomePage onEpisode={openPodcastEpisode} onPlayEpisode={episode=>play(episode,podcastSuggestions.episodes)} discovery={{...discovery,tracks:recommended.tracks}} trending={{...trending,tracks:recommended.tracks.slice(0,6)}} trendingError={trendingError} initialBusy={initialBusy} refreshBusy={refreshBusy} current={current} playing={playing} preparing={showLoading && current ? { [current.id]: true } : {}} animations={settings.animations} onPlay={play} onOpen={openAndPlay} onArtist={openArtist} atmosphere={atmosphere} recommendations={recommendations} onRefresh={()=>{rotateSuggestions();refreshDiscovery()}} onSearch={searchMusic} onTrending={() => navigate('trending')} renderTracks={renderTracks} online={online} podcasts={podcastSuggestions} podcastBusy={podcastBusy} podcastError={podcastError} onPodcasts={() => navigate('podcasts')} onPodcastCreator={openPodcastCreator} renderEpisodes={renderEpisodes} />}
            {view === 'search' && <SearchPage playlists={publicPlaylists} onPublicPlaylist={openPublicPlaylist} onUser={openUserProfile} results={results} artists={searchArtists} albums={searchAlbums} warnings={searchWarnings} onArtist={openArtist} onAlbum={openAlbum} busy={searchBusy} searched={searched} error={searchError} renderTracks={renderTracks} onSearch={searchMusic} podcasts={searchPodcastData} podcastBusy={searchPodcastBusy} podcastError={searchPodcastError} onCreator={openPodcastCreator} renderEpisodes={renderEpisodes} />}
            {view === 'podcasts' && <PodcastsPage current={current} playing={playing} onEpisode={openPodcastEpisode} onPlayEpisode={episode=>play(episode,podcastSuggestions.episodes)} data={podcastSearched ? podcastResults : podcastSuggestions} busy={podcastBusy} error={podcastError} query={podcastQuery} onQuery={setPodcastQuery} onSearch={searchPodcasts} onRefresh={()=>{rotateSuggestions();loadPodcasts(podcastSearched,true)}} onCreator={openPodcastCreator} renderEpisodes={renderEpisodes} />}
            {view === 'podcast-creator' && <PodcastCreatorPage creator={podcastCreator?.id === podcastCreatorId ? podcastCreator : null} busy={podcastDetailBusy} error={podcastDetailError} onBack={() => navigate('podcasts')} onRetry={() => setPodcastRetry(value => value + 1)} renderEpisodes={renderEpisodes} />}
            {view === 'podcast-episode' && <PodcastEpisodePage transcriptOpen={podcastTranscriptId === podcastEpisodeId} onTranscriptToggle={() => setPodcastTranscriptId(previous => previous === podcastEpisodeId ? null : podcastEpisodeId)} owner={offlineOwner} onAuth={()=>goAuth('login')} episode={podcastEpisode?.id === podcastEpisodeId ? podcastEpisode : null} busy={podcastDetailBusy} error={podcastDetailError} current={current} playing={playing} loading={showLoading} playerError={playerError} position={position} duration={duration} progress={settings.rememberHistory ? podcastProgress[podcastEpisodeId] : null} onBack={() => navigate('podcasts')} onRetry={() => setPodcastRetry(value => value + 1)} onPlay={episode => play(episode, podcastCreator?.episodes?.some(item => item.id === episode.id) ? podcastCreator.episodes : [episode])} onSeek={seek} onCreator={openPodcastCreator} onQueue={addQueue} onShare={shareAudio} />}
            {view === 'artist' && <ArtistPage artist={artistProfile?.id === artistId ? artistProfile : null} busy={catalogBusy} error={artistError} following={followingArtist} followBusy={followBusy} followError={followError} current={current} playing={playing} onFollow={toggleArtistFollow} onAlbum={openAlbum} onArtist={openArtist} onPlay={play} renderTracks={renderTracks} onBack={catalogBack} onRetry={() => setCatalogRetry(value => value + 1)} />}
            {view === 'album' && <AlbumPage album={albumDetail?.id === albumId ? albumDetail : null} busy={catalogBusy} error={albumError} current={current} playing={playing} onArtist={openArtist} onPlay={play} renderTracks={renderTracks} onBack={catalogBack} onRetry={() => setCatalogRetry(value => value + 1)} />}
            {view === 'now-playing' && <NowPlayingPage searchPlaylists={publicPlaylists} onPublicPlaylist={openPublicPlaylist} onUser={openUserProfile} track={selectedTrack} detailBusy={detailBusy} detailError={detailError} current={current} playing={playing} position={position} duration={duration} volume={volume} muted={muted} shuffle={shuffle} repeat={repeat} busy={showLoading && current?.id === selectedTrack?.id} playbackStatus={playerStatus} playbackError={playerError} lyrics={lyrics} lyricsBusy={lyricsBusy} lyricsError={lyricsError} lines={lines} activeLine={activeLine} followLyrics={settings.followLyrics} lyricOffset={settings.lyricOffset} animations={settings.animations} onFollowLyrics={() => changeSettings({ followLyrics: !settings.followLyrics })} favorite={library.favoriteIds.includes(selectedTrack?.id)} downloaded={downloads.some(item => item.available !== false && item.track.id === selectedTrack?.id)} onBack={() => navigate('discover')} onPlay={track => play(track, queue, false)} onToggle={togglePlayback} onSeek={seek} onPrevious={() => next(-1)} onNext={() => next(1)} onShuffle={() => setShuffle(value => !value)} onRepeat={cycleRepeat} onMute={() => setMuted(value => !value)} onVolume={changeVolume} onFavorite={toggleFavorite} onDownload={confirmDownload} onPlaylist={choosePlaylist} onQueue={addQueue} onImport={track => setModal({ type: 'import-lrc', track })} onRefreshLyrics={() => { lyricRefreshTarget.current = selectedTrack?.id; setLyricRefresh(value => value + 1) }} onArtist={openArtist} onAlbum={openAlbum} searchArtists={searchArtists} searchAlbums={searchAlbums} searchWarnings={searchWarnings} searchQuery={searched} results={results} searchBusy={searchBusy} searchError={searchError} renderTracks={renderTracks} suggestions={queue.length > 1 ? queue : discovery.tracks} onFocusSearch={focusSearch} />}
            {view === 'library' && (user ? <LibraryPage onVisibility={changeVisibility} visibilityBusy={visibilityBusy} onPublicPlaylist={openPublicPlaylist} library={library} followedArtists={followedArtists} onArtist={openArtist} selected={selectedPlaylist} tracksFor={tracksFor} error={libraryError} user={user} current={current} playing={playing} onAuth={openAuth} onSelect={id => navigate('library', id)} onCreate={() => createPlaylist()} onRename={playlist => { if (requireAccount('playlist')) { setRename(playlist.name); setPlaylistError(''); setModal({ type: 'rename', playlist }) } }} onArtwork={playlist => { if (requireAccount('playlist')) setModal({ type: 'artwork', playlist }) }} onDelete={playlist => { if (requireAccount('playlist')) setModal({ type: 'delete-playlist', playlist }) }} onPlay={play} onMove={movePlaylistTrack} onRemove={(playlist, id) => updatePlaylistTracks(playlist, playlist.trackIds.filter(value => value !== id))} renderTracks={renderTracks} /> : <GuestPrompt feature="playlist" onLogin={openAuth} onRegister={() => goAuth('register')} onDismiss={() => navigate('discover')} />)}
            {view === 'podcast-episode' && searched && <div className="mt-7 space-y-7"><SearchResults results={results} artists={searchArtists} albums={searchAlbums} warnings={searchWarnings} busy={searchBusy} error={searchError} renderTracks={renderTracks} onArtist={openArtist} onAlbum={openAlbum} /><PodcastResults data={searchPodcastData} busy={searchPodcastBusy} error={searchPodcastError} onCreator={openPodcastCreator} renderEpisodes={renderEpisodes} /></div>}
            {view === 'now-playing' && searched && <div className="mt-7"><PodcastResults data={searchPodcastData} busy={searchPodcastBusy} error={searchPodcastError} onCreator={openPodcastCreator} renderEpisodes={renderEpisodes} /></div>}
            {view === 'downloads' && (user ? <DownloadsPage downloads={downloads} storage={storage} offlineOwner={offlineOwner} user={user} online={online} renderTracks={renderTracks} onRemove={track => setModal({ type: 'remove-download', track })} bytes={bytes} onExplore={() => navigate('discover')} /> : <GuestPrompt feature="downloads" onLogin={openAuth} onRegister={() => goAuth('register')} onDismiss={() => navigate('discover')} />)}
            {view === 'friends' && <FriendsPage onProfile={openUserProfile} user={user} friends={friends} query={friendQuery} results={friendResults} busy={friendBusy} error={friendError} searched={friendSearched} actionBusy={friendActionBusy} onQuery={value => { setFriendQuery(value); setFriendSearched(false) }} onSearch={findFriends} onSend={sendFriend} onRespond={respondFriend} onCancel={cancelFriend} onRemove={person => setModal({ type: 'remove-friend', person })} onAuth={openAuth} onRegister={() => goAuth('register')} />}
            {view === 'settings' && <SettingsPage installed={installed} settings={settings} onChange={changeSettings} onReset={() => changeSettings({ ...defaultSettings, sleepMinutes: 0 })} user={user} online={online} storage={storage} onProfile={() => navigate('profile')} onInstall={installApp} nativePlayer={nativePlayer} onNativeServer={() => nativeCommand('configure').catch(error => notify(errorMessage(error), 'error'))} />}
            {view === 'profile' && <ProfilePage onPublicProfile={()=>openUserProfile(user)} user={user} authReady={authReady} online={online} friends={friends} onSave={saveProfile} onPassword={changePassword} onLogout={logout} onFriends={() => navigate('friends')} onAuth={openAuth} onRegister={() => goAuth('register')} />}
            {(view === 'login' || view === 'register') && <AuthPage mode={view} busy={authBusy} error={authError} onSubmit={submitAuth} onMode={goAuth} onGuest={returnFromAuth} returnLabel={t('Musikmu tetap berjalan')} />}
            {view === 'trending' && <div className="space-y-7"><div><p className="eyebrow mb-3">{t('Musik yang sedang ramai')}</p><h1 className="page-heading">{t('Diputar banyak orang.')}</h1><p className="mt-3 text-sm leading-7 text-muted">{t('Lagu yang lagi banyak didengar. Daftar ini diperbarui otomatis.')}</p></div><section className="clay-panel p-3 sm:p-5">{trending.tracks.length ? renderTracks(trending.tracks) : <div className="empty-state"><h2 className="section-heading">{t('Chart belum tersedia')}</h2><p className="muted-copy">{t(trendingError || 'Sumber chart belum dapat dimuat. Coba lagi nanti.')}</p><button type="button" onClick={loadTrending} className="clay-button">{t('Coba lagi')}</button></div>}</section></div>}
          </motion.div>
        </AnimatePresence>
        </Suspense>
        </ErrorBoundary>
        {Object.keys(downloadProgress).length > 0 && <section aria-label={t('Proses unduhan')} className="clay-panel mt-7 p-5"><p className="eyebrow mb-4">{t('Menyiapkan musik offline')}</p>{Object.entries(downloadProgress).map(([id, progress]) => <div key={id} className="mb-4 last:mb-0"><div className="mb-2 flex justify-between gap-3 text-xs"><span className="truncate font-bold">{known.current.get(id)?.title || t('Lagu')}</span><span className="tabular-nums text-muted">{Math.round(progress)}%</span><button type="button" onClick={() => downloadControllers.current.get(id)?.abort()} className="text-accent">{t('Batal')}</button></div><progress value={progress} max="100" aria-label={t('Progres unduhan {title}', { title: known.current.get(id)?.title || t('Lagu') })} className="h-2 w-full overflow-hidden rounded-full accent-accent" /></div>)}</section>}
      </main>
    </div>
    <PlayerDock hideOnMobile={fullPlayer} error={playerError} onTranscript={() => { if (isPodcastEpisode(current)) { openPodcastEpisode(current); setPodcastTranscriptId(current.id) } else openTrack(current) }} track={current} playing={playing} position={position} duration={duration} volume={volume} muted={muted} shuffle={shuffle} repeat={repeat} busy={showLoading} status={playerStatus} favorite={library.favoriteIds.includes(current?.id)} onDetail={() => openTrack(current)} onPlay={togglePlayback} onSeek={seek} onPrevious={() => next(-1)} onNext={() => next(1)} onShuffle={() => setShuffle(value => !value)} onRepeat={cycleRepeat} onMute={() => setMuted(value => !value)} onVolume={changeVolume} onFavorite={() => current && toggleFavorite(current)} onQueue={() => setModal({ type: 'queue' })} standalone={authPage} />
    {!authPage && <MobileNavigation view={view} onNavigate={navigate} incomingCount={friends.incoming.length} />}
    <PwaUpdateNotice playing={playing} visible={!toast && !modal} />
    {!nativePlayer && <audio ref={audio} preload="auto" onPlay={() => setPlaying(true)} onPlaying={clearLoading} onCanPlay={clearLoading} onWaiting={() => { setPlayerStatus('Sebentar, mengisi buffer…'); markLoading() }} onPause={() => { setPlaying(false); clearLoading() }} onTimeUpdate={event => setPosition(event.currentTarget.currentTime)} onSeeked={event => setPosition(event.currentTarget.currentTime)} onLoadedMetadata={event => { if (Number.isFinite(event.currentTarget.duration)) setDuration(event.currentTarget.duration) }} onEnded={() => { if (repeat === 'one') { seek(0); audio.current.play().catch(error => setPlayerError(errorMessage(error))) } else if (settingsRef.current.autoplayNext) next(1, true); else { setPlaying(false); clearLoading() } }} onError={() => { if (audio.current?.src && audio.current.error) { clearLoading(); setPlayerError('Lagu belum bisa diputar. Cek koneksi, lalu coba lagi.'); setPlaying(false) } }} />}
    {!nativePlayer && <audio ref={warmAudio} preload="metadata" aria-hidden="true" />}
    <AnimatePresence>{toast && <motion.div role={toast.tone === 'error' ? 'alert' : 'status'} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: motionTokens.duration.fast }} className="clay-panel fixed bottom-[calc(172px_+_env(safe-area-inset-bottom))] left-5 right-5 z-50 flex items-center gap-3 !rounded-[18px] px-4 py-3 text-xs leading-6 sm:left-auto sm:max-w-md lg:bottom-32"><Check size={17} className="shrink-0 text-accent" /><span className="flex-1">{t(toast.message, toast.values)}</span><button type="button" aria-label={t('Tutup notifikasi')} onClick={() => setToast(null)} className="icon-button !size-8"><X size={15} /></button></motion.div>}</AnimatePresence>
    {modal && <ErrorBoundary key={modal.type} fallback={<div role="alert" className="clay-panel fixed inset-x-5 bottom-44 z-50 p-5 sm:left-auto sm:max-w-md"><p className="mb-4 text-sm">{t('Menu ini mengalami error. Tutup menu untuk melanjutkan.')}</p><button type="button" className="clay-button" onClick={() => setModal(null)}>{t('Tutup')}</button></div>}><Suspense fallback={null}><AppDialogs view={view} onNavigate={navigate} onInstall={installApp} onFavorites={() => user ? navigate('library', 'favorites') : requireAccount('favorites')} installed={installed} downloadsCount={user ? downloads.filter(item => item.available !== false).length : 0} incomingCount={friends.incoming.length} modal={modal} onClose={() => setModal(null)} onLogin={openAuth} onRegister={() => goAuth('register')} user={user} library={library} authMode={authMode} setAuthMode={setAuthMode} authError={authError} setAuthError={setAuthError} authBusy={authBusy} onAuth={submitAuth} playlistName={playlistName} setPlaylistName={setPlaylistName} playlistBusy={playlistBusy} playlistError={playlistError} onCreate={submitPlaylist} onNewPlaylist={createPlaylist} onAdd={addToPlaylist} onArtwork={saveArtwork} rename={rename} setRename={setRename} onRename={saveRename} onDeletePlaylist={deletePlaylist} rightsConfirmed={rightsConfirmed} setRightsConfirmed={setRightsConfirmed} onDownload={startDownload} onDeleteDownload={deleteDownload} onImportLyrics={importLyrics} queue={queue} setQueue={updateQueue} current={current} playing={playing} loading={playerLoading} position={position} duration={duration} volume={volume} muted={muted} shuffle={shuffle} repeat={repeat} onShuffle={() => setShuffle(value => !value)} onRepeat={cycleRepeat} onPrevious={() => next(-1)} onNext={() => next(1)} onPlay={play} onToggle={togglePlayback} onSeek={seek} onMute={() => setMuted(value => !value)} onVolume={changeVolume} onDetail={openTrack} onRemoveFriend={removeFriend} /></Suspense></ErrorBoundary>}
  </MotionConfig></LanguageProvider>
}

import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { motion } from 'framer-motion'
import './App.css'

type ReelItem = {
  id: string
  title: string
  subreddit: string
  permalink: string
  type: 'image' | 'video'
  url: string
  thumb?: string
  author: string
  ups: number
}

type RedditChild = {
  data: {
    id: string
    title: string
    subreddit: string
    permalink: string
    post_hint?: string
    is_video?: boolean
    media?: { reddit_video?: { fallback_url?: string } }
    preview?: { images?: Array<{ source?: { url?: string } }> }
    url_overridden_by_dest?: string
    url?: string
    author: string
    ups: number
    is_gallery?: boolean
    gallery_data?: { items?: Array<{ media_id: string }> }
    media_metadata?: Record<string, { s?: { u?: string } }>
  }
}

const decodeHtml = (value?: string) =>
  value?.replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>') ?? ''

function normalizeSubreddits(input: string) {
  return input
    .split(',')
    .map((s) => s.trim().replace(/^r\//i, ''))
    .filter(Boolean)
}

const suggestedSubreddits = [
  'pics',
  'videos',
  'gifs',
  'funny',
  'memes',
  'nextfuckinglevel',
  'interestingasfuck',
  'EarthPorn',
  'wallpapers',
  'aww',
  'oddlysatisfying',
]

const toVideoIfGifv = (url: string) => (url.endsWith('.gifv') ? url.replace(/\.gifv$/i, '.mp4') : url)

function mapPost(post: RedditChild['data']): ReelItem[] {
  const base = {
    id: post.id,
    title: post.title,
    subreddit: post.subreddit,
    permalink: `https://reddit.com${post.permalink}`,
    author: post.author,
    ups: post.ups,
  }

  if (post.is_video && post.media?.reddit_video?.fallback_url) {
    return [
      {
        ...base,
        type: 'video',
        url: post.media.reddit_video.fallback_url,
        thumb: decodeHtml(post.preview?.images?.[0]?.source?.url),
      },
    ]
  }

  if (post.is_gallery && post.gallery_data?.items?.length && post.media_metadata) {
    return post.gallery_data.items
      .map((item, idx) => {
        const mediaUrl = decodeHtml(post.media_metadata?.[item.media_id]?.s?.u)
        if (!mediaUrl) return null
        const url = toVideoIfGifv(mediaUrl)
        const isVideo = /\.(mp4|webm)$/i.test(url)
        return {
          ...base,
          id: `${post.id}-${idx}`,
          type: (isVideo ? 'video' : 'image') as 'video' | 'image',
          url,
        }
      })
      .filter(Boolean) as ReelItem[]
  }

  const rawUrl = decodeHtml(post.url_overridden_by_dest || post.url)
  const mediaUrl = toVideoIfGifv(rawUrl)

  if (/\.(mp4|webm)$/i.test(mediaUrl) || post.post_hint === 'hosted:video') {
    return [{ ...base, type: 'video', url: mediaUrl, thumb: decodeHtml(post.preview?.images?.[0]?.source?.url) }]
  }

  if (/\.(jpg|jpeg|png|webp|gif)$/i.test(mediaUrl)) {
    return [{ ...base, type: 'image', url: mediaUrl }]
  }

  const preview = decodeHtml(post.preview?.images?.[0]?.source?.url)
  if (preview) {
    return [{ ...base, type: 'image', url: preview }]
  }

  return []
}

async function fetchSubredditMedia(name: string): Promise<{ items: ReelItem[]; source: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12000)
  try {
    const url = `https://www.reddit.com/r/${name}/hot.json?raw_json=1&limit=100`
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`r/${name}: HTTP ${res.status}`)
    const json = await res.json()
    const children: RedditChild[] = json?.data?.children ?? []
    return { items: children.flatMap((c) => mapPost(c.data)), source: 'reddit' }
  } finally {
    clearTimeout(timer)
  }
}

function ReelVideo({ item }: { item: ReelItem }) {
  const [muted, setMuted] = useState(true)

  return (
    <div className="videoBox">
      <video
        src={item.url}
        muted={muted}
        autoPlay
        loop
        playsInline
        preload="metadata"
        poster={item.thumb}
        onClick={(e) => {
          const v = e.currentTarget
          if (v.paused) v.play().catch(() => null)
          setMuted((m) => !m)
        }}
        onError={(e) => {
          ;(e.currentTarget as HTMLVideoElement).style.display = 'none'
        }}
      />
      <button
        className="soundToggle"
        onClick={() => setMuted((m) => !m)}
        type="button"
      >
        {muted ? 'Tap for sound 🔇' : 'Sound on 🔊'}
      </button>
    </div>
  )
}

function App() {
  const [query, setQuery] = useState('wallpapers,EarthPorn,gifs')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sourceInfo, setSourceInfo] = useState('')
  const [feed, setFeed] = useState<ReelItem[]>([])
  const [showUi, setShowUi] = useState(true)
  const [activeMetaId, setActiveMetaId] = useState<string | null>(null)

  const subreddits = useMemo(() => normalizeSubreddits(query), [query])
  const currentToken = useMemo(() => query.split(',').slice(-1)[0]?.trim() ?? '', [query])
  const filteredSuggestions = useMemo(
    () => suggestedSubreddits.filter((s) => s.toLowerCase().startsWith(currentToken.toLowerCase()) && !subreddits.includes(s)).slice(0, 6),
    [currentToken, subreddits],
  )

  const applySuggestion = (name: string) => {
    const parts = query.split(',')
    if (parts.length === 0) {
      setQuery(name)
      return
    }
    parts[parts.length - 1] = ` ${name}`
    const next = parts.join(',').replace(/^\s+/, '')
    setQuery(next.endsWith(',') ? next : `${next},`)
  }

  useEffect(() => {
    if (feed.length === 0 && !loading) {
      onLoad().catch(() => null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onLoad = async (e?: FormEvent) => {
    e?.preventDefault()
    if (!subreddits.length) return

    setLoading(true)
    setError('')
    setSourceInfo('')

    try {
      const settled = await Promise.allSettled(subreddits.map((s) => fetchSubredditMedia(s)))
      const ok = settled.filter((r): r is PromiseFulfilledResult<{ items: ReelItem[]; source: string }> => r.status === 'fulfilled')
      const bad = settled.filter((r): r is PromiseRejectedResult => r.status === 'rejected')

      const merged = ok.flatMap((c) => c.value.items).sort((a, b) => b.ups - a.ups)
      const sources = [...new Set(ok.map((c) => c.value.source))].join(', ')

      setFeed(merged)
      if (sources) setSourceInfo(`Loaded via: ${sources} • ${merged.length} media items`)

      if (!merged.length && bad.length) {
        setError(`Could not load media. ${bad[0].reason?.message ?? 'Request failed.'}`)
      } else if (!merged.length) {
        setError('No media found in selected subreddits.')
      } else if (bad.length) {
        setError(`Loaded partial results. ${bad.length} subreddit request(s) failed.`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load feed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main>
      <header className={`topbar glass ${showUi ? '' : 'hiddenUi'}`}>
        <motion.h1 initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>SubSwipe</motion.h1>
        <form onSubmit={onLoad} className="queryForm">
          <input list="subreddit-suggestions" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Subreddits (e.g. funny,memes,wallpapers,gifs)" />
          <button type="submit" disabled={loading}>{loading ? 'Loading…' : 'Load Feed'}</button>
        </form>
        <datalist id="subreddit-suggestions">
          {suggestedSubreddits.map((name) => <option key={name} value={name} />)}
        </datalist>
        {!!filteredSuggestions.length && (
          <div className="suggestions">
            {filteredSuggestions.map((s) => (
              <button key={s} type="button" className="chip" onClick={() => applySuggestion(s)}>r/{s}</button>
            ))}
          </div>
        )}
        {!!sourceInfo && <p className="info">{sourceInfo}</p>}
        {!!error && <p className="error">{error}</p>}
      </header>

      <button className="uiToggle" type="button" onClick={() => setShowUi((v) => !v)}>
        {showUi ? 'Focus mode ✨' : 'Show UI'}
      </button>

      <section className="reels" aria-live="polite">
        {!feed.length && !loading && <div className="empty">Load one or more subreddits to view a swipe feed.</div>}

        {feed.map((item, idx) => (
          <motion.article
            key={item.id}
            className="reel"
            initial={{ opacity: 0.2, rotateX: 22, scale: 0.9, y: 40 }}
            whileInView={{ opacity: 1, rotateX: 0, scale: 1, y: 0 }}
            viewport={{ amount: 0.65 }}
            transition={{ duration: 0.42, ease: 'easeOut', delay: Math.min(idx * 0.01, 0.08) }}
            onClick={() => setActiveMetaId((id) => (id === item.id ? null : item.id))}
          >
            <div className="mediaWrap glass">
              {item.type === 'video' ? (
                <ReelVideo item={item} />
              ) : (
                <img src={item.url} loading="lazy" alt={item.title} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
              )}
            </div>
            <footer className={`meta glass ${activeMetaId === item.id ? 'show' : ''}`}>
              <p className="title">{item.title}</p>
              <p>r/{item.subreddit} • u/{item.author} • ▲{item.ups}</p>
              <a href={item.permalink} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>Open on Reddit</a>
            </footer>
          </motion.article>
        ))}
      </section>
    </main>
  )
}

export default App

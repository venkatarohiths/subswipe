import { useMemo, useState } from 'react'
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
    return [{ ...base, type: 'video', url: post.media.reddit_video.fallback_url, thumb: decodeHtml(post.preview?.images?.[0]?.source?.url) }]
  }

  if (post.is_gallery && post.gallery_data?.items?.length && post.media_metadata) {
    return post.gallery_data.items
      .map((item, idx) => {
        const img = decodeHtml(post.media_metadata?.[item.media_id]?.s?.u)
        if (!img) return null
        return { ...base, id: `${post.id}-${idx}`, type: 'image' as const, url: img }
      })
      .filter(Boolean) as ReelItem[]
  }

  const maybeImage = decodeHtml(post.url_overridden_by_dest || post.url)
  if (maybeImage.match(/\.(jpg|jpeg|png|webp|gif)$/i)) {
    return [{ ...base, type: 'image', url: maybeImage }]
  }

  const preview = decodeHtml(post.preview?.images?.[0]?.source?.url)
  if (preview) return [{ ...base, type: 'image', url: preview }]

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

function App() {
  const [query, setQuery] = useState('wallpapers,EarthPorn')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sourceInfo, setSourceInfo] = useState('')
  const [feed, setFeed] = useState<ReelItem[]>([])

  const subreddits = useMemo(() => normalizeSubreddits(query), [query])

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
      if (sources) setSourceInfo(`Loaded via: ${sources}`)

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
      <header className="topbar glass">
        <motion.h1 initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>SubSwipe</motion.h1>
        <form onSubmit={onLoad} className="queryForm">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Subreddits (e.g. funny,memes,wallpapers)" />
          <button type="submit" disabled={loading}>{loading ? 'Loading…' : 'Load Feed'}</button>
        </form>
        {!!sourceInfo && <p className="info">{sourceInfo}</p>}
        {!!error && <p className="error">{error}</p>}
      </header>

      <section className="reels" aria-live="polite">
        {!feed.length && !loading && <div className="empty">Load one or more subreddits to view a swipe feed.</div>}

        {feed.map((item) => (
          <motion.article
            key={item.id}
            className="reel"
            initial={{ opacity: 0.35, rotateX: 14, scale: 0.96 }}
            whileInView={{ opacity: 1, rotateX: 0, scale: 1 }}
            viewport={{ amount: 0.7 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          >
            <div className="mediaWrap glass">
              {item.type === 'video' ? (
                <video src={item.url} controls playsInline preload="metadata" poster={item.thumb} onError={(e) => { (e.currentTarget as HTMLVideoElement).style.display = 'none' }} />
              ) : (
                <img src={item.url} loading="lazy" alt={item.title} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
              )}
            </div>
            <footer className="meta glass">
              <p className="title">{item.title}</p>
              <p>r/{item.subreddit} • u/{item.author} • ▲{item.ups}</p>
              <a href={item.permalink} target="_blank" rel="noreferrer">Open on Reddit</a>
            </footer>
          </motion.article>
        ))}
      </section>
    </main>
  )
}

export default App

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
        const m = post.media_metadata?.[item.media_id]
        const img = decodeHtml(m?.s?.u)
        if (!img) return null
        return {
          ...base,
          id: `${post.id}-${idx}`,
          type: 'image' as const,
          url: img,
        }
      })
      .filter(Boolean) as ReelItem[]
  }

  const maybeImage = decodeHtml(post.url_overridden_by_dest || post.url)
  if (maybeImage.match(/\.(jpg|jpeg|png|webp|gif)$/i)) {
    return [{ ...base, type: 'image', url: maybeImage }]
  }

  const preview = decodeHtml(post.preview?.images?.[0]?.source?.url)
  if (preview) {
    return [{ ...base, type: 'image', url: preview }]
  }

  return []
}

async function fetchSubredditMedia(name: string): Promise<ReelItem[]> {
  const res = await fetch(`https://www.reddit.com/r/${name}/hot.json?raw_json=1&limit=100`)
  if (!res.ok) throw new Error(`Failed to fetch r/${name}`)
  const json = await res.json()
  const children: RedditChild[] = json?.data?.children ?? []
  return children.flatMap((c) => mapPost(c.data))
}

function App() {
  const [query, setQuery] = useState('wallpapers,EarthPorn')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [feed, setFeed] = useState<ReelItem[]>([])

  const subreddits = useMemo(() => normalizeSubreddits(query), [query])

  const onLoad = async (e?: FormEvent) => {
    e?.preventDefault()
    if (!subreddits.length) return

    setLoading(true)
    setError('')
    try {
      const chunks = await Promise.all(subreddits.map((s) => fetchSubredditMedia(s)))
      const merged = chunks.flat().sort((a, b) => b.ups - a.ups)
      setFeed(merged)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load feed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main>
      <header className="topbar">
        <h1>SubSwipe</h1>
        <form onSubmit={onLoad} className="queryForm">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Subreddits, comma-separated (e.g. funny,memes)"
          />
          <button type="submit" disabled={loading}>{loading ? 'Loading…' : 'Load Feed'}</button>
        </form>
        {!!error && <p className="error">{error}</p>}
      </header>

      <section className="reels" aria-live="polite">
        {!feed.length && !loading && (
          <div className="empty">Load one or more subreddits to view a TikTok-style media feed.</div>
        )}

        {feed.map((item) => (
          <motion.article
            key={item.id}
            className="reel"
            initial={{ opacity: 0.6, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ amount: 0.6 }}
            transition={{ duration: 0.25 }}
          >
            <div className="mediaWrap">
              {item.type === 'video' ? (
                <video src={item.url} controls playsInline preload="metadata" poster={item.thumb} />
              ) : (
                <img src={item.url} loading="lazy" alt={item.title} />
              )}
            </div>
            <footer className="meta">
              <p className="title">{item.title}</p>
              <p>
                r/{item.subreddit} • u/{item.author} • ▲{item.ups}
              </p>
              <a href={item.permalink} target="_blank" rel="noreferrer">Open on Reddit</a>
            </footer>
          </motion.article>
        ))}
      </section>
    </main>
  )
}

export default App


import { Fragment, useState, type ReactNode } from 'react'

/**
 * Telegram HTML (b, i, u, s, a, code, pre, blockquote, spoiler) ni xavfsiz React daraxtiga
 * aylantiradi. Ruxsat etilmagan teglar olib tashlanadi, ichidagi matn qoladi.
 * dangerouslySetInnerHTML ishlatilmaydi.
 */

const SAFE_HREF = /^(https?:|tg:|mailto:)/i

function Spoiler({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState(false)
  return (
    <span
      onClick={() => setShown((s) => !s)}
      title={shown ? 'Yashirish' : "Ko'rsatish"}
      className={
        shown
          ? 'cursor-pointer rounded bg-slate-200/60 px-0.5 dark:bg-slate-700/60'
          : 'cursor-pointer select-none rounded bg-slate-400 px-0.5 text-transparent dark:bg-slate-500'
      }
    >
      {children}
    </span>
  )
}

function renderNode(node: ChildNode, key: number): ReactNode {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent

  if (node.nodeType !== Node.ELEMENT_NODE) return null
  const el = node as HTMLElement
  const tag = el.tagName.toLowerCase()
  const children = Array.from(el.childNodes).map((c, i) => <Fragment key={i}>{renderNode(c, i)}</Fragment>)

  switch (tag) {
    case 'b':
    case 'strong':
      return <b key={key}>{children}</b>
    case 'i':
    case 'em':
      return <i key={key}>{children}</i>
    case 'u':
      return <u key={key}>{children}</u>
    case 's':
    case 'del':
    case 'strike':
      return <s key={key}>{children}</s>
    case 'code':
      return (
        <code key={key} className="rounded bg-black/5 px-1 font-mono text-[0.92em] dark:bg-white/10">
          {children}
        </code>
      )
    case 'pre':
      return (
        <pre key={key} className="my-1 overflow-x-auto rounded bg-black/5 p-2 font-mono text-[0.9em] dark:bg-white/10">
          {children}
        </pre>
      )
    case 'blockquote':
      return (
        <blockquote key={key} className="my-1 border-l-2 border-current/40 pl-2 opacity-90">
          {children}
        </blockquote>
      )
    case 'spoiler':
    case 'tg-spoiler':
      return <Spoiler key={key}>{children}</Spoiler>
    case 'a': {
      const href = el.getAttribute('href') ?? ''
      if (!SAFE_HREF.test(href)) return <Fragment key={key}>{children}</Fragment>
      return (
        <a key={key} href={href} target="_blank" rel="noreferrer" className="text-sky-600 underline dark:text-sky-400">
          {children}
        </a>
      )
    }
    case 'br':
      return <br key={key} />
    default:
      return <Fragment key={key}>{children}</Fragment>
  }
}

export function renderTelegramHtml(html: string): ReactNode {
  if (!html) return null
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html')
  const root = doc.body.firstElementChild
  if (!root) return null
  return Array.from(root.childNodes).map((n, i) => <Fragment key={i}>{renderNode(n, i)}</Fragment>)
}

/** Teglarsiz uzunlik — Telegram limiti ko'rinadigan matn bo'yicha hisoblanadi. */
export function plainLength(html: string): number {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html')
  return (doc.body.textContent ?? '').length
}

/** Ro'yxatdagi qisqa ko'rinish uchun teglarsiz matn. */
export function stripTags(html: string, max = 120): string {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html')
  const text = (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim()
  return text.length > max ? text.slice(0, max - 1) + '…' : text
}

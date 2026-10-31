import type { TemplateInput, TemplateView } from '@shared/outreach'
import type { Template, MediaItem, UrlButton } from '@shared/types'
import { templatesRepo } from '../../db/repositories'
import { AppError } from '../../errors'
import { allowMediaPaths } from '../posting/media'

function parseJson<T>(json: string | null, fallback: T): T {
  if (!json) return fallback
  try {
    return JSON.parse(json) as T
  } catch {
    return fallback
  }
}

export function toTemplateView(t: Template): TemplateView {
  const media = parseJson<MediaItem | null>(t.media_json, null)
  if (media) allowMediaPaths([media])
  return {
    id: t.id,
    name: t.name,
    text: t.text,
    media,
    buttons: parseJson<UrlButton[][]>(t.buttons_json, []),
    updated_at: t.updated_at
  }
}

export function listTemplates(): TemplateView[] {
  return templatesRepo.list().map(toTemplateView)
}

export function saveTemplate(input: TemplateInput): TemplateView {
  const name = input.name.trim()
  if (!name) throw new AppError('TEMPLATE_NAME', 'Shablon nomini kiriting.')
  if (!input.text.trim() && !input.media)
    throw new AppError('TEMPLATE_EMPTY', 'Matn yoki media kiriting.')
  const row = {
    name,
    text: input.text,
    media_json: input.media ? JSON.stringify(input.media) : null,
    buttons_json: input.buttons.length ? JSON.stringify(input.buttons) : null
  }
  if (input.media) allowMediaPaths([input.media])
  if (input.id) {
    const t = templatesRepo.update(input.id, row)
    if (!t) throw new AppError('NOT_FOUND', 'Shablon topilmadi.')
    return toTemplateView(t)
  }
  return toTemplateView(templatesRepo.create(row))
}

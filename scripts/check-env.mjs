#!/usr/bin/env node
// Release build'dan oldin: .env to'liqmi? Bo'sh bo'lsa ilova "dev rejim"da (mahalliy trial) chiqib ketadi.
//   node scripts/check-env.mjs          → xato bo'lsa exit 1
//   node scripts/check-env.mjs --warn   → faqat ogohlantiradi
import { readFileSync, existsSync } from 'node:fs'

const REQUIRED = ['MAIN_VITE_SUPABASE_URL', 'MAIN_VITE_SUPABASE_ANON_KEY', 'MAIN_VITE_LICENSE_PUBLIC_KEY']
const warnOnly = process.argv.includes('--warn')

const env = { ...process.env }
if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
    if (m && !(m[1] in env)) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

if ((env.MAIN_VITE_OWNER_MODE ?? '').trim() === '1') {
  console.log('[check-env] OK — egasi rejimi (MAIN_VITE_OWNER_MODE=1), litsenziya serveri talab qilinmaydi')
  process.exit(0)
}

const missing = REQUIRED.filter((k) => !env[k] || !env[k].trim())
if (missing.length === 0) {
  console.log('[check-env] OK — litsenziya serveri sozlangan')
  process.exit(0)
}
const msg = `[check-env] .env da yetishmayapti: ${missing.join(', ')} — ilova dev rejimda (mahalliy trial) ishlaydi!`
if (warnOnly) {
  console.warn(msg)
  process.exit(0)
}
console.error(msg)
console.error('Release uchun .env.example dan .env yarating yoki CI secrets qo\'ying.')
process.exit(1)

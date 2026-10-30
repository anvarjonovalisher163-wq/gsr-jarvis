#!/usr/bin/env node
// Ed25519 kalit juftligini yaratadi.
//   node scripts/gen-license-keys.mjs
// Maxfiy kalit → Supabase secret (LICENSE_PRIVATE_KEY), hech qachon repoga/ilovaga qo'yilmaydi.
// Ochiq kalit  → .env (MAIN_VITE_LICENSE_PUBLIC_KEY), ilovaga build vaqtida kiradi.
import { generateKeyPairSync } from 'node:crypto'

const { publicKey, privateKey } = generateKeyPairSync('ed25519')
const pub = publicKey.export({ type: 'spki', format: 'der' }).toString('base64')
const priv = privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64')

console.log('# 1) Supabase secret (MAXFIY — faqat serverda):')
console.log(`supabase secrets set LICENSE_PRIVATE_KEY=${priv}`)
console.log()
console.log('# 2) Ilova .env fayliga (ochiq kalit):')
console.log(`MAIN_VITE_LICENSE_PUBLIC_KEY=${pub}`)

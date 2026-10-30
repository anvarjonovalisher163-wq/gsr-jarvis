#!/usr/bin/env node
// Lokal paketlash: faqat shu kompyuter arxitekturasi, native modul rebuild'siz
// (postinstall `electron-rebuild -o better-sqlite3` allaqachon to'g'ri tayyor binarni yuklagan;
// bufferutil/utf-8-validate N-API — rebuild kerak emas). Shuning uchun Visual Studio/Xcode shart emas.
//
//   node scripts/pack.mjs --mac|--win|--linux [--dir] [boshqa electron-builder flaglari]
//
// Ikkala mac arxitekturasi va GitHub Release uchun CI ishlatiladi (.github/workflows/release.yml).
import { execSync } from 'node:child_process'

const args = process.argv.slice(2)
const archFlag = process.arch === 'arm64' ? '--arm64' : '--x64'
const cmd = ['npx electron-builder', ...args, archFlag, '-c.npmRebuild=false'].join(' ')

console.log(`[pack] ${process.platform} ${process.arch}: ${cmd}`)
execSync(cmd, { stdio: 'inherit' })

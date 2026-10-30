/**
 * electron-builder konfiguratsiyasi.
 * JS bo'lishi sababi: macOS notarization faqat Apple hisob ma'lumotlari (env) bo'lsa yoqiladi.
 *
 * Env (ixtiyoriy, CI secrets):
 *   APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID — notarization
 *   CSC_LINK, CSC_KEY_PASSWORD — macOS imzo sertifikati (.p12 base64)
 *   WIN_CSC_LINK, WIN_CSC_KEY_PASSWORD — Windows code signing (ixtiyoriy)
 *   GH_TOKEN — GitHub Releases'ga yuklash
 */
const hasAppleCreds = !!(process.env.APPLE_ID && process.env.APPLE_APP_SPECIFIC_PASSWORD && process.env.APPLE_TEAM_ID)

/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: 'uz.gsr.tgmanager',
  productName: 'TG Manager',
  copyright: 'Copyright © 2026 GSR',
  artifactName: '${productName}-${version}-${os}-${arch}.${ext}',

  directories: {
    buildResources: 'resources',
    output: 'release'
  },

  // Faqat inkor patternlar: default '**/*' qoladi, shunda production node_modules avtomatik kiradi.
  // (Oq ro'yxat qilinsa electron-builder dependency'larni umuman qo'shmaydi.)
  files: [
    '!src/**',
    '!supabase/**',
    '!scripts/**',
    '!resources/**',
    '!release/**',
    '!.github/**',
    '!*.md',
    '!.env*',
    '!.eslintrc.cjs',
    '!.prettierrc',
    '!.githooks/**',
    '!electron.vite.config.*',
    '!electron-builder.cjs',
    '!tsconfig*.json',
    '!tailwind.config.cjs',
    '!postcss.config.cjs',
    '!**/*.map',
    '!**/*.tsbuildinfo'
  ],
  // better-sqlite3 .node binarini asar ichidan yuklab bo'lmaydi
  asarUnpack: ['node_modules/better-sqlite3/**', 'node_modules/bindings/**', 'node_modules/file-uri-to-path/**'],

  // CI: electron-builder har arxitektura uchun native modullarni o'zi rebuild qiladi (mac: arm64+x64
  // bitta chaqiruvda — latest-mac.yml ikkala archni o'z ichiga olishi uchun).
  // Lokal build (scripts/pack.mjs) -c.npmRebuild=false beradi: postinstall yuklagan host-arch binar ishlatiladi.
  npmRebuild: true,

  // Tray ikonkasi uchun (process.resourcesPath/icon.png)
  extraResources: [{ from: 'resources/icon.png', to: 'icon.png' }],

  publish: {
    provider: 'github',
    owner: 'anvarjonovalisher163-wq',
    repo: 'gsr-jarvis',
    releaseType: 'release'
  },

  mac: {
    category: 'public.app-category.productivity',
    icon: 'resources/icon.png',
    // Universal (bitta fayl) native modul bilan murakkab — arxitektura bo'yicha ikkita dmg
    target: [{ target: 'dmg', arch: ['arm64', 'x64'] }, { target: 'zip', arch: ['arm64', 'x64'] }],
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: 'resources/entitlements.mac.plist',
    entitlementsInherit: 'resources/entitlements.mac.plist',
    notarize: hasAppleCreds ? { teamId: process.env.APPLE_TEAM_ID } : false,
    darkModeSupport: true
  },
  dmg: {
    contents: [
      { x: 140, y: 200 },
      { x: 400, y: 200, type: 'link', path: '/Applications' }
    ]
  },

  win: {
    icon: 'resources/icon.png',
    target: [{ target: 'nsis', arch: ['x64'] }],
    // Imzosiz build'da SmartScreen ogohlantiradi — README'da yo'riqnoma
    verifyUpdateCodeSignature: false
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    shortcutName: 'TG Manager',
    installerLanguages: ['uz', 'ru_RU', 'en_US'],
    deleteAppDataOnUninstall: false
  },

  linux: {
    icon: 'resources/icon.png',
    target: ['AppImage'],
    category: 'Network'
  }
}

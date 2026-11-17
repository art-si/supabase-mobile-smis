import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createPinia, setActivePinia } from 'pinia'
import { createServer } from 'vite'
import { applicationRoot, loadMobilePro } from './mobile-pro.mjs'

const origin = 'http://127.0.0.1:0'
const session = { access_token: 'audit-phone-access', refresh_token: 'audit-phone-refresh', expires_in: 3600, user: { id: 'audit-user' } }
const sessionKey = 'smis-mobile-session'
const edgePath = '/functions/v1/mobile-wechat-auth'
const profilePath = '/rest/v1/rpc/smis_get_hazard_reporting_options_secure'
const { prepareMobileCore } = await loadMobilePro()
const api = await createServer({
  configFile: false,
  root: applicationRoot,
  server: { middlewareMode: true, ws: false },
  optimizeDeps: { noDiscovery: true, include: [] },
  envDir: false,
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(origin),
    'import.meta.env.VITE_SUPABASE_KEY': JSON.stringify('fixture-publishable')
  },
  resolve: { alias: {
    '@': fileURLToPath(new URL('../src/', import.meta.url)),
    '@mobile-core': prepareMobileCore(applicationRoot)
  } }
})

try {
  const { useAuthStore } = await api.ssrLoadModule('/src/stores/auth.ts')
  const { useProfileStore } = await api.ssrLoadModule('/src/stores/profile.ts')
  const { useDictionaryStore } = await api.ssrLoadModule('/src/stores/dictionary.ts')
  const { bindWechatPhoneNumber } = await api.ssrLoadModule('/src/api/supabase.ts')

  for (const mode of ['success', 'edge-denied', 'malformed-session', 'profile-denied', 'dictionary-failed']) {
    setActivePinia(createPinia())
    const saved = new Map()
    const calls = []
    globalThis.uni = {
      setStorageSync: (key, value) => saved.set(key, value),
      removeStorageSync: key => saved.delete(key),
      request(request) {
        const url = new URL(request.url)
        assert.equal(url.origin, origin)
        assert.equal(saved.has(sessionKey), false, 'session must remain unpersisted during bootstrap')
        calls.push(url.pathname)
        const reply = (statusCode, data) => queueMicrotask(() => request.success({ statusCode, data }))

        if (url.pathname === edgePath) {
          assert.equal(request.method, 'POST')
          assert.deepEqual(request.data, { app: 'smis', phoneCode: 'audit-wechat-code' })
          if (mode === 'edge-denied') return reply(403, { code: 'WECHAT_PHONE_NOT_ALLOWED' })
          return reply(200, mode === 'malformed-session' ? { ...session, refresh_token: '' } : session)
        }
        assert.equal(request.header.Authorization, `Bearer ${session.access_token}`)
        if (url.pathname === profilePath) {
          if (mode === 'profile-denied') return reply(403, { code: '42501' })
          return reply(200, { profile: { employeeName: '验收账号', isEmployeeLinked: false } })
        }
        assert.match(url.pathname, /^\/rest\/v1\/sys_dict(?:ionary|_type)$/)
        return mode === 'dictionary-failed' ? reply(503, {}) : reply(200, [])
      }
    }

    const auth = useAuthStore()
    const login = auth.loginWithWechatPhone('audit-wechat-code')
    if (mode === 'success') {
      await login
      assert.equal(auth.token, session.access_token)
      assert.equal(JSON.parse(saved.get(sessionKey)).user.id, session.user.id)
      assert.equal(useProfileStore().profile.isEmployeeLinked, false)
      assert.equal(useDictionaryStore().loaded, true)
      assert.equal(calls.length, 4)
    } else {
      await assert.rejects(login)
      assert.equal(auth.isLoggedIn, false)
      assert.equal(saved.has(sessionKey), false)
      assert.equal(useProfileStore().profile, null)
      assert.equal(useDictionaryStore().loaded, false)
      assert.equal(calls.length, mode === 'dictionary-failed' ? 4 : mode === 'profile-denied' ? 2 : 1)
    }
  }

  for (const { statusCode, body, error } of [
    { statusCode: 200, body: { bound: true } },
    { statusCode: 200, body: { bound: false }, error: 'WECHAT_PHONE_UNAVAILABLE' },
    { statusCode: 403, body: { code: 'WECHAT_PHONE_PASSWORD_REQUIRED' }, error: 'WECHAT_PHONE_PASSWORD_REQUIRED' }
  ]) {
    globalThis.uni = {
      request(request) {
        assert.equal(request.url, origin + edgePath)
        assert.equal(request.method, 'POST')
        assert.equal(request.header.Authorization, `Bearer ${session.access_token}`)
        assert.deepEqual(request.data, { app: 'smis', phoneCode: 'audit-bind-code', action: 'bind' })
        request.success({ statusCode, data: body })
      }
    }
    const binding = bindWechatPhoneNumber('audit-bind-code', session.access_token)
    if (error) await assert.rejects(binding, { code: error })
    else assert.deepEqual(await binding, { bound: true })
  }
  console.log('PASS: SMIS WeChat phone request, authenticated binding, session bootstrap and failure rollback')
} finally {
  delete globalThis.uni
  await api.close()
}

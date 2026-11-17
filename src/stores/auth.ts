import { defineStore } from 'pinia'
import { redirectToLogin } from '@mobile-core/login-navigation'
import { passwordLogin, refreshToken, signOut, wechatPhoneLogin } from '@/api/supabase'
import type { Session } from '@/api/types'
import { useDictionaryStore } from './dictionary'
import { useProfileStore } from './profile'

const STORAGE_KEY = 'smis-mobile-session'

let refreshSessionPromise: Promise<void> | null = null

interface AuthState {
  session: Session | null
  booted: boolean
}

function normalizeSession(session: Session | null) {
  if (!session) return null
  if (!session.expires_at && session.expires_in) {
    session.expires_at = Math.floor(Date.now() / 1000) + session.expires_in
  }
  return session
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    session: null,
    booted: false
  }),
  getters: {
    token: (state) => state.session?.access_token || '',
    user: (state) => state.session?.user || null,
    isLoggedIn: (state) => Boolean(state.session?.access_token),
    isTokenExpired: (state) => {
      if (!state.session?.access_token) return false
      const expiresAt = state.session?.expires_at
      if (!expiresAt) return true
      return expiresAt * 1000 - Date.now() < 180_000
    }
  },
  actions: {
    hydrate() {
      if (this.booted) return
      const cached = uni.getStorageSync(STORAGE_KEY)
      if (cached) {
        try {
          this.session = normalizeSession(typeof cached === 'string' ? JSON.parse(cached) : cached)
        } catch {
          this.session = null
        }
      }
      this.booted = true
    },
    persist() {
      if (this.session) {
        uni.setStorageSync(STORAGE_KEY, JSON.stringify(this.session))
      } else {
        uni.removeStorageSync(STORAGE_KEY)
      }
    },
    clearSession(redirect = false) {
      useDictionaryStore().clear()
      useProfileStore().clear()
      this.session = null
      this.persist()
      if (redirect) redirectToLogin()
    },
    async ensureValidSession(redirect = true) {
      this.hydrate()
      if (!this.token) {
        this.clearSession(redirect)
        return false
      }
      if (!this.isTokenExpired) return true

      try {
        await this.refreshSession(redirect)
        return Boolean(this.token)
      } catch {
        return false
      }
    },
    async login(account: string, password: string) {
      this.session = normalizeSession(await passwordLogin(account.trim(), password))
      this.persist()
      await useDictionaryStore().load(this.token, true)
      return this.session
    },
    async loginWithWechatPhone(phoneCode: string) {
      const session = await wechatPhoneLogin(phoneCode)
      try {
        await useProfileStore().load(session.access_token, true)
        await useDictionaryStore().load(session.access_token, true)
      } catch (error) {
        this.clearSession()
        throw error
      }
      this.session = normalizeSession(session)
      this.persist()
    },
    async refreshSession(redirect = true) {
      if (refreshSessionPromise) return refreshSessionPromise

      if (!this.session?.refresh_token) {
        this.clearSession(redirect)
        throw new Error('登录已过期，请重新登录')
      }

      const currentRefreshToken = this.session.refresh_token
      refreshSessionPromise = (async () => {
        try {
          const nextSession = normalizeSession(await refreshToken(currentRefreshToken))
          if (!nextSession?.access_token) throw new Error('登录已过期，请重新登录')
          if (!this.session || this.session.refresh_token !== currentRefreshToken) return
          this.session = nextSession
          this.persist()
          await useDictionaryStore().load(this.token, true)
        } catch (error) {
          this.clearSession(redirect)
          throw error
        } finally {
          refreshSessionPromise = null
        }
      })()

      return refreshSessionPromise
    },
    async logout() {
      if (this.session?.access_token) {
        try {
          await signOut(this.session.access_token)
        } catch {
          // Local logout still clears stale credentials if remote logout is unavailable.
        }
      }
      this.clearSession(true)
    }
  }
})

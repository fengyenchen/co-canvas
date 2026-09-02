import type { AnchorHTMLAttributes } from 'react'
import { useEffect, useState } from 'react'
import {
  AccountView,
  NeonAuthUIProvider,
  type AuthLocalization,
} from '@neondatabase/neon-js/auth/react/ui'
import '@neondatabase/neon-js/ui/css'
import {
  CheckCircle2,
  LoaderCircle,
  MailWarning,
  ShieldCheck,
  X,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import coCanvasMark from '../assets/branding/co-canvas-mark-primary.svg'
import { authClient } from '../lib/auth'
import './AccountPage.css'

const accountLocalizationZhTw = {
  APP: 'Co-Canvas',
  ACCOUNT: '帳號資料',
  SECURITY: '帳號安全',
  SETTINGS: '設定',
  SAVE: '儲存變更',
  CANCEL: '取消',
  DELETE: '刪除',
  UPDATE: '更新',
  UNKNOWN: '未知裝置',
  SIGN_OUT: '登出',
  REVOKE: '移除',

  CHANGE_PASSWORD: '變更密碼',
  CHANGE_PASSWORD_DESCRIPTION: '定期更新密碼，降低帳號遭到未授權使用的風險。',
  CHANGE_PASSWORD_INSTRUCTIONS: '儲存後會自動登出其他裝置。密碼至少需要 8 個字元。',
  CHANGE_PASSWORD_SUCCESS: '密碼已更新，其他裝置也已登出。',
  CURRENT_PASSWORD: '目前密碼',
  CURRENT_PASSWORD_PLACEHOLDER: '輸入目前密碼',
  NEW_PASSWORD: '新密碼',
  NEW_PASSWORD_PLACEHOLDER: '輸入至少 8 個字元',
  NEW_PASSWORD_REQUIRED: '請輸入新密碼',
  CONFIRM_PASSWORD: '確認新密碼',
  CONFIRM_PASSWORD_PLACEHOLDER: '再次輸入新密碼',
  CONFIRM_PASSWORD_REQUIRED: '請再次輸入新密碼',
  PASSWORD: '密碼',
  PASSWORD_PLACEHOLDER: '輸入密碼以確認',
  PASSWORD_REQUIRED: '請輸入密碼',
  PASSWORDS_DO_NOT_MATCH: '兩次輸入的密碼不一致',
  PASSWORD_TOO_SHORT: '密碼至少需要 8 個字元',
  PASSWORD_TOO_LONG: '密碼長度超過限制',
  INVALID_PASSWORD: '密碼不正確',

  SESSIONS: '登入中的裝置',
  SESSIONS_DESCRIPTION: '查看目前仍可使用此帳號的瀏覽器與裝置，並移除不認識的工作階段。',
  CURRENT_SESSION: '目前這台裝置',

  DELETE_ACCOUNT: '刪除帳號',
  DELETE_ACCOUNT_DESCRIPTION: '永久刪除帳號。這項操作無法復原，請確認已備份需要保留的內容。',
  DELETE_ACCOUNT_INSTRUCTIONS: '請輸入密碼確認永久刪除帳號。這項操作無法復原。',
  DELETE_ACCOUNT_VERIFY: '確認信已寄出，請前往信箱完成帳號刪除。',
  DELETE_ACCOUNT_SUCCESS: '帳號已刪除。',

  SESSION_EXPIRED: '登入已過期',
  SESSION_NOT_FRESH: '為保護帳號安全，請重新登入後再執行這項操作。',
  REQUEST_FAILED: '操作失敗，請稍後再試。',
  UNEXPECTED_ERROR: '發生未預期的錯誤，請稍後再試。',
  UNKNOWN_ERROR: '發生錯誤，請稍後再試。',
} satisfies AuthLocalization

const accountViewClassNames = {
  base: 'account-security-view',
  cards: 'account-security-cards',
  card: {
    base: 'account-settings-card',
    header: 'account-settings-card-header',
    title: 'account-settings-card-title',
    description: 'account-settings-card-description',
    content: 'account-settings-card-content',
    footer: 'account-settings-card-footer',
    instructions: 'account-settings-card-instructions',
    input: 'account-settings-input',
    button: 'account-settings-button',
    primaryButton: 'account-settings-primary-button',
    outlineButton: 'account-settings-outline-button',
    secondaryButton: 'account-settings-secondary-button',
    destructiveButton: 'account-settings-destructive-button',
    cell: 'account-session-cell',
    dialog: {
      content: 'account-settings-dialog',
    },
  },
}

type AccountUser = {
  email: string
  emailVerified: boolean
}

type AccountNotification = {
  message: string
  requiresReauthentication: boolean
  variant: 'error' | 'success' | 'info'
}

function AccountLink({ href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <Link to={href ?? '/account/security'} {...props} />
}

function getAccountErrorMessage(error: unknown) {
  if (error instanceof TypeError) {
    return '無法連線帳號服務，請檢查網路後再試。'
  }

  return '操作失敗，請稍後再試。'
}

function getAccountNotification(
  message: string | undefined,
  variant: 'default' | 'success' | 'error' | 'info' | 'warning' = 'default',
): AccountNotification {
  const normalizedMessage = message?.trim().toLowerCase() ?? ''

  if (
    normalizedMessage.includes('session is not fresh') ||
    normalizedMessage.includes('session not fresh')
  ) {
    return {
      message: '為保護帳號安全，變更密碼前請先重新登入。',
      requiresReauthentication: true,
      variant: 'error',
    }
  }

  if (normalizedMessage.includes('invalid password')) {
    return {
      message: '目前密碼不正確，請重新輸入。',
      requiresReauthentication: false,
      variant: 'error',
    }
  }

  return {
    message: message || '操作失敗，請稍後再試。',
    requiresReauthentication: false,
    variant:
      variant === 'success' ? 'success' : variant === 'error' ? 'error' : 'info',
  }
}

export function AccountPage() {
  const navigate = useNavigate()
  const [user, setUser] = useState<AccountUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRevoking, setIsRevoking] = useState(false)
  const [isSendingVerification, setIsSendingVerification] = useState(false)
  const [sessionsRevision, setSessionsRevision] = useState(0)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [notification, setNotification] = useState<AccountNotification | null>(
    null,
  )

  useEffect(() => {
    let isCancelled = false

    async function loadSession() {
      try {
        const { data } = await authClient.getSession()
        if (isCancelled) return

        if (!data?.user) {
          navigate('/auth/sign-in?returnTo=%2Faccount%2Fsecurity', {
            replace: true,
          })
          return
        }

        setUser({
          email: data.user.email,
          emailVerified: data.user.emailVerified,
        })
      } catch (error) {
        if (!isCancelled) setErrorMessage(getAccountErrorMessage(error))
      } finally {
        if (!isCancelled) setIsLoading(false)
      }
    }

    void loadSession()
    return () => {
      isCancelled = true
    }
  }, [navigate])

  async function handleRevokeOtherSessions() {
    if (isRevoking) return
    setIsRevoking(true)
    setStatusMessage(null)
    setErrorMessage(null)

    try {
      await authClient.revokeOtherSessions({ fetchOptions: { throw: true } })
      setSessionsRevision((revision) => revision + 1)
      setStatusMessage('其他裝置已全部登出，目前這台裝置仍保持登入。')
    } catch (error) {
      setErrorMessage(getAccountErrorMessage(error))
    } finally {
      setIsRevoking(false)
    }
  }

  async function handleSendVerification() {
    if (!user || user.emailVerified || isSendingVerification) return
    setIsSendingVerification(true)
    setStatusMessage(null)
    setErrorMessage(null)

    try {
      await authClient.sendVerificationEmail({
        email: user.email,
        callbackURL: '/account/security',
        fetchOptions: { throw: true },
      })
      setStatusMessage(`驗證信已寄至 ${user.email}，請查看收件匣與垃圾郵件。`)
    } catch (error) {
      setErrorMessage(getAccountErrorMessage(error))
    } finally {
      setIsSendingVerification(false)
    }
  }

  return (
    <main className="account-page min-h-dvh bg-canvas px-4 py-6 text-foreground sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto w-full max-w-4xl">
        <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <img src={coCanvasMark} alt="" className="size-12" />
            <div>
              <p className="text-sm font-medium text-foreground/55">Co-Canvas</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
                帳號安全
              </h1>
            </div>
          </div>
          <Link
            to="/projects"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-background px-4 text-sm font-medium shadow-sm transition hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            返回專案
          </Link>
        </header>

        {isLoading ? (
          <div className="flex min-h-72 items-center justify-center rounded-2xl border border-border bg-background shadow-sm">
            <p role="status" className="flex items-center gap-2 text-sm text-foreground/60">
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
              正在讀取帳號資料…
            </p>
          </div>
        ) : user ? (
          <NeonAuthUIProvider
            authClient={authClient}
            basePath="/auth"
            account={{ basePath: '/account', fields: [] }}
            credentials={{
              confirmPassword: true,
              forgotPassword: true,
              passwordValidation: { minLength: 8 },
            }}
            deleteUser
            emailVerification
            redirectTo="/projects"
            navigate={(href) => navigate(href)}
            replace={(href) => navigate(href, { replace: true })}
            Link={AccountLink}
            localization={accountLocalizationZhTw}
            defaultTheme="light"
            toast={({ message, variant }) =>
              setNotification(getAccountNotification(message, variant))
            }
          >
            <section className="mb-6 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
              <div className="rounded-2xl border border-border bg-background p-5 shadow-sm sm:p-6">
                <div className="flex items-start gap-4">
                  <div className={`mt-0.5 rounded-xl p-2.5 ${user.emailVerified ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                    {user.emailVerified ? (
                      <CheckCircle2 aria-hidden="true" className="size-5" />
                    ) : (
                      <MailWarning aria-hidden="true" className="size-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold">電子郵件</h2>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${user.emailVerified ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                        {user.emailVerified ? '已驗證' : '等待驗證'}
                      </span>
                    </div>
                    <p className="mt-2 truncate text-sm text-foreground/65" title={user.email}>
                      {user.email}
                    </p>
                    {!user.emailVerified && (
                      <button
                        type="button"
                        disabled={isSendingVerification}
                        onClick={() => void handleSendVerification()}
                        className="mt-4 min-h-11 cursor-pointer rounded-xl border border-border px-4 text-sm font-medium transition hover:border-primary/30 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isSendingVerification ? '寄送中…' : '重新寄送驗證信'}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex min-w-64 flex-col justify-between rounded-2xl border border-border bg-background p-5 shadow-sm sm:p-6">
                <div className="flex items-center gap-3">
                  <ShieldCheck aria-hidden="true" className="size-5 text-primary" />
                  <div>
                    <h2 className="font-semibold">其他登入裝置</h2>
                    <p className="mt-1 text-xs leading-5 text-foreground/55">發現異常時可一次全部登出</p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isRevoking}
                  onClick={() => void handleRevokeOtherSessions()}
                  className="mt-4 min-h-11 cursor-pointer rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isRevoking ? '處理中…' : '登出其他裝置'}
                </button>
              </div>
            </section>

            {(statusMessage || errorMessage) && (
              <p
                role={errorMessage ? 'alert' : 'status'}
                className={`mb-6 rounded-xl border px-4 py-3 text-sm leading-6 ${errorMessage ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}
              >
                {errorMessage ?? statusMessage}
              </p>
            )}

            <AccountView
              key={sessionsRevision}
              path="security"
              hideNav
              classNames={accountViewClassNames}
            />

            {notification && (
              <div
                role={notification.variant === 'error' ? 'alert' : 'status'}
                className={`fixed bottom-5 left-4 right-4 z-50 mx-auto flex max-w-lg items-start gap-3 rounded-2xl border bg-background p-4 shadow-lg sm:left-auto sm:right-6 sm:mx-0 sm:min-w-96 ${
                  notification.variant === 'error'
                    ? 'border-red-200'
                    : notification.variant === 'success'
                      ? 'border-emerald-200'
                      : 'border-border'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-6 text-foreground">
                    {notification.message}
                  </p>
                  {notification.requiresReauthentication && (
                    <Link
                      to="/auth/sign-out?returnTo=%2Faccount%2Fsecurity"
                      className="mt-2 inline-flex min-h-11 items-center font-medium text-primary underline decoration-primary/35 underline-offset-4 transition hover:decoration-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      重新登入
                    </Link>
                  )}
                </div>
                <button
                  type="button"
                  aria-label="關閉提示"
                  onClick={() => setNotification(null)}
                  className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl text-foreground/55 transition hover:bg-primary/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <X aria-hidden="true" className="size-4" />
                </button>
              </div>
            )}
          </NeonAuthUIProvider>
        ) : errorMessage ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
            <p role="alert">{errorMessage}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 min-h-11 cursor-pointer rounded-xl border border-red-300 px-4 font-medium transition hover:bg-red-100"
            >
              重新載入
            </button>
          </div>
        ) : null}
      </div>
    </main>
  )
}

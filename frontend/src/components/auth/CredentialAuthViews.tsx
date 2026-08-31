import {
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { LoaderCircle, MailCheck } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { authClient } from '../../lib/auth'
import { ensureWelcomeEmail } from '../../api/authAdmin'

const VERIFICATION_COOLDOWN_SECONDS = 60

type AuthErrorShape = {
  code?: string
  message?: string
  error?: unknown
  cause?: unknown
}

function getAuthErrorCode(error: unknown) {
  const pending = [error]
  const visited = new Set<unknown>()
  while (pending.length > 0) {
    const current = pending.shift()
    if (!current || typeof current !== 'object' || visited.has(current)) {
      continue
    }
    visited.add(current)
    const value = current as AuthErrorShape
    if (typeof value.code === 'string') {
      return value.code.trim().toUpperCase()
    }
    if (typeof value.message === 'string') {
      const normalizedMessage = value.message
        .trim()
        .toUpperCase()
        .replace(/[\s-]+/g, '_')
      if (normalizedMessage.includes('EMAIL_NOT_VERIFIED')) {
        return 'EMAIL_NOT_VERIFIED'
      }
    }
    pending.push(value.error, value.cause)
  }
  return null
}

function getAuthErrorMessage(error: unknown) {
  const code = getAuthErrorCode(error)
  const messages: Record<string, string> = {
    EMAIL_NOT_VERIFIED: '請先完成電子郵件驗證。',
    EMAIL_NOT_CONFIRMED: '請先完成電子郵件驗證。',
    INVALID_EMAIL: '電子郵件格式不正確。',
    INVALID_EMAIL_OR_PASSWORD: '電子郵件或密碼不正確。',
    INVALID_PASSWORD: '電子郵件或密碼不正確。',
    USER_ALREADY_EXISTS: '此電子郵件已註冊。',
    USER_NOT_FOUND: '電子郵件或密碼不正確。',
  }
  return code ? messages[code] ?? '請求失敗，請稍後再試。' : '請求失敗，請稍後再試。'
}

function verificationCooldownKey(email: string) {
  return `co-canvas:verification-email:${email.trim().toLowerCase()}`
}

function getCooldownSeconds(email: string) {
  const expiresAt = Number(
    window.sessionStorage.getItem(verificationCooldownKey(email)),
  )
  if (!Number.isFinite(expiresAt)) return 0
  return Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000))
}

function startVerificationCooldown(email: string) {
  window.sessionStorage.setItem(
    verificationCooldownKey(email),
    String(Date.now() + VERIFICATION_COOLDOWN_SECONDS * 1000),
  )
}

function AuthCard({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-background p-6 shadow-sm">
      {children}
    </section>
  )
}

const inputClassName =
  'min-h-11 w-full rounded-lg border border-border bg-background px-3 text-base text-foreground outline-none transition placeholder:text-foreground/35 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60'
const primaryButtonClassName =
  'inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50'
const secondaryButtonClassName =
  'inline-flex min-h-11 w-full cursor-pointer items-center justify-center rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-control-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50'

function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p
      role="alert"
      className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm leading-6 text-destructive"
    >
      {message}
    </p>
  )
}

export function SignInView({ returnTo }: { returnTo: string }) {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) return
    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      await authClient.signIn.email({
        email: email.trim().toLowerCase(),
        password,
        rememberMe,
        callbackURL: returnTo,
        fetchOptions: { throw: true },
      })
      navigate(returnTo, { replace: true })
    } catch (error) {
      if (
        ['EMAIL_NOT_VERIFIED', 'EMAIL_NOT_CONFIRMED'].includes(
          getAuthErrorCode(error) ?? '',
        )
      ) {
        const params = new URLSearchParams({
          email: email.trim().toLowerCase(),
          returnTo,
        })
        navigate(`/auth/verify-email?${params}`, { replace: true })
        return
      }
      setErrorMessage(getAuthErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthCard>
      <div className="text-center">
        <h2 className="text-xl font-semibold text-foreground">登入</h2>
        <p className="mt-2 text-sm leading-6 text-foreground/60">
          登入後即可存取你的雲端專案
        </p>
      </div>
      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <label className="block text-sm font-medium text-foreground">
          電子郵件
          <input
            className={`${inputClassName} mt-2`}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            disabled={isSubmitting}
          />
        </label>
        <label className="block text-sm font-medium text-foreground">
          密碼
          <input
            className={`${inputClassName} mt-2`}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            disabled={isSubmitting}
          />
        </label>
        <div className="flex items-center justify-between gap-4 text-sm">
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-foreground/70">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
              disabled={isSubmitting}
            />
            記住我
          </label>
          <Link
            to={`/auth/forgot-password?returnTo=${encodeURIComponent(returnTo)}`}
            className="rounded px-1 py-2 text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            忘記密碼？
          </Link>
        </div>
        <FormError message={errorMessage} />
        <button className={primaryButtonClassName} disabled={isSubmitting}>
          {isSubmitting && <LoaderCircle className="size-4 animate-spin" />}
          {isSubmitting ? '登入中…' : '登入'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-foreground/60">
        還沒有帳號嗎？{' '}
        <Link
          to={`/auth/sign-up?returnTo=${encodeURIComponent(returnTo)}`}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          註冊
        </Link>
      </p>
    </AuthCard>
  )
}

export function SignUpView({ returnTo }: { returnTo: string }) {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) return
    if (password !== confirmPassword) {
      setErrorMessage('兩次輸入的密碼不一致。')
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)
    const normalizedEmail = email.trim().toLowerCase()
    try {
      const result = await authClient.signUp.email({
        name: name.trim(),
        email: normalizedEmail,
        password,
        callbackURL: returnTo,
        fetchOptions: { throw: true },
      })
      if ('token' in result && result.token) {
        await authClient.signOut()
      }
      startVerificationCooldown(normalizedEmail)
      const params = new URLSearchParams({
        email: normalizedEmail,
        returnTo,
      })
      navigate(`/auth/verify-email?${params}`, { replace: true })
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthCard>
      <div className="text-center">
        <h2 className="text-xl font-semibold text-foreground">註冊</h2>
        <p className="mt-2 text-sm leading-6 text-foreground/60">
          建立帳號以跨裝置保存專案
        </p>
      </div>
      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <div>
          <label
            htmlFor="sign-up-name"
            className="block text-sm font-medium text-foreground"
          >
            名稱
          </label>
          <input
            id="sign-up-name"
            className={`${inputClassName} mt-2`}
            type="text"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            disabled={isSubmitting}
          />
        </div>
        <div>
          <label
            htmlFor="sign-up-email"
            className="block text-sm font-medium text-foreground"
          >
            電子郵件
          </label>
          <input
            id="sign-up-email"
            className={`${inputClassName} mt-2`}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            disabled={isSubmitting}
          />
        </div>
        <div>
          <label
            htmlFor="sign-up-password"
            className="block text-sm font-medium text-foreground"
          >
            密碼
          </label>
          <input
            id="sign-up-password"
            className={`${inputClassName} mt-2`}
            type="password"
            autoComplete="new-password"
            aria-describedby="sign-up-password-help"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            required
            disabled={isSubmitting}
          />
          <p
            id="sign-up-password-help"
            className="mt-1.5 text-xs leading-5 text-foreground/50"
          >
            至少 8 個字元
          </p>
        </div>
        <div>
          <label
            htmlFor="sign-up-confirm-password"
            className="block text-sm font-medium text-foreground"
          >
            確認密碼
          </label>
          <input
            id="sign-up-confirm-password"
            className={`${inputClassName} mt-2`}
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            minLength={8}
            required
            disabled={isSubmitting}
          />
        </div>
        <FormError message={errorMessage} />
        <button className={primaryButtonClassName} disabled={isSubmitting}>
          {isSubmitting && <LoaderCircle className="size-4 animate-spin" />}
          {isSubmitting ? '建立中…' : '建立帳號'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-foreground/60">
        已經有帳號了嗎？{' '}
        <Link
          to={`/auth/sign-in?returnTo=${encodeURIComponent(returnTo)}`}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          登入
        </Link>
      </p>
    </AuthCard>
  )
}

export function VerifyEmailView({ returnTo }: { returnTo: string }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const email = searchParams.get('email')?.trim().toLowerCase() ?? ''
  const [cooldown, setCooldown] = useState(() =>
    email ? getCooldownSeconds(email) : 0,
  )
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isResending, setIsResending] = useState(false)
  const [isChecking, setIsChecking] = useState(false)

  useEffect(() => {
    if (!email || cooldown <= 0) return
    const timer = window.setInterval(() => {
      setCooldown(getCooldownSeconds(email))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [cooldown, email])

  async function handleResend() {
    if (!email || cooldown > 0 || isResending) return
    setIsResending(true)
    setErrorMessage(null)
    setStatusMessage(null)
    startVerificationCooldown(email)
    setCooldown(VERIFICATION_COOLDOWN_SECONDS)
    try {
      await authClient.sendVerificationEmail({
        email,
        callbackURL: returnTo,
        fetchOptions: { throw: true },
      })
      setStatusMessage('驗證信已重新寄出，請查看收件匣與垃圾郵件。')
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error))
    } finally {
      setIsResending(false)
    }
  }

  async function handleCheck() {
    if (isChecking) return
    setIsChecking(true)
    setErrorMessage(null)
    try {
      const { data } = await authClient.getSession()
      if (data?.user.emailVerified) {
        void ensureWelcomeEmail().catch(() => undefined)
        navigate(returnTo, { replace: true })
        return
      }
      setStatusMessage('尚未完成驗證。請開啟驗證信中的連結後再試一次。')
    } catch {
      setErrorMessage('暫時無法確認驗證狀態，請稍後再試。')
    } finally {
      setIsChecking(false)
    }
  }

  if (!email) {
    return (
      <AuthCard>
        <h2 className="text-center text-xl font-semibold text-foreground">
          缺少電子郵件
        </h2>
        <p className="mt-3 text-center text-sm leading-6 text-foreground/60">
          請重新註冊，系統會將你帶回驗證頁面。
        </p>
        <Link className={`${primaryButtonClassName} mt-6`} to="/auth/sign-up">
          返回註冊
        </Link>
      </AuthCard>
    )
  }

  return (
    <AuthCard>
      <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <MailCheck className="size-7" aria-hidden="true" />
      </div>
      <div className="mt-5 text-center">
        <h2 className="text-xl font-semibold text-foreground">查看驗證信</h2>
        <p className="mt-3 text-sm leading-6 text-foreground/60">
          驗證連結已寄到
          <strong className="mx-1 break-all font-semibold text-foreground">
            {email}
          </strong>
          。完成驗證後即可進入專案。
        </p>
      </div>
      <div aria-live="polite" className="mt-5 space-y-3">
        {statusMessage && (
          <p className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm leading-6 text-foreground/75">
            {statusMessage}
          </p>
        )}
        <FormError message={errorMessage} />
      </div>
      <div className="mt-6 space-y-3">
        <button
          type="button"
          className={primaryButtonClassName}
          onClick={handleCheck}
          disabled={isChecking}
        >
          {isChecking && <LoaderCircle className="size-4 animate-spin" />}
          {isChecking ? '確認中…' : '我已完成驗證'}
        </button>
        <button
          type="button"
          className={secondaryButtonClassName}
          onClick={handleResend}
          disabled={cooldown > 0 || isResending}
        >
          {isResending
            ? '寄送中…'
            : cooldown > 0
              ? `${cooldown} 秒後可重新寄送`
              : '重新寄送驗證信'}
        </button>
      </div>
      <div className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm">
        <Link
          to={`/auth/sign-up?returnTo=${encodeURIComponent(returnTo)}`}
          className="rounded px-1 py-2 text-foreground/60 underline-offset-4 hover:text-foreground hover:underline"
        >
          更換電子郵件
        </Link>
        <Link
          to={`/auth/sign-in?returnTo=${encodeURIComponent(returnTo)}`}
          className="rounded px-1 py-2 text-foreground/60 underline-offset-4 hover:text-foreground hover:underline"
        >
          返回登入
        </Link>
      </div>
    </AuthCard>
  )
}

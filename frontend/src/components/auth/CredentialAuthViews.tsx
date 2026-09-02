import {
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from 'react'
import {
  Circle,
  CircleAlert,
  CircleCheck,
  Eye,
  EyeOff,
  LoaderCircle,
  MailCheck,
} from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { authClient } from '../../lib/auth'
import { ensureWelcomeEmail } from '../../api/authAdmin'

const VERIFICATION_COOLDOWN_SECONDS = 60
const PASSWORD_RESET_COOLDOWN_SECONDS = 60

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
    INVALID_TOKEN: '連結無效或已過期，請重新申請。',
    TOKEN_EXPIRED: '連結已過期，請重新申請。',
    RESET_PASSWORD_TOKEN_EXPIRED: '密碼重設連結已過期，請重新申請。',
    TOO_MANY_ATTEMPTS: '嘗試次數過多，請稍後再試。',
    RATE_LIMIT_EXCEEDED: '操作過於頻繁，請稍後再試。',
    SERVICE_UNAVAILABLE: '服務暫時無法使用，請稍後再試。',
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

function passwordResetCooldownKey(email: string) {
  return `co-canvas:password-reset-email:${email.trim().toLowerCase()}`
}

function getPasswordResetCooldownSeconds(email: string) {
  const expiresAt = Number(
    window.sessionStorage.getItem(passwordResetCooldownKey(email)),
  )
  if (!Number.isFinite(expiresAt)) return 0
  return Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000))
}

function startPasswordResetCooldown(email: string) {
  window.sessionStorage.setItem(
    passwordResetCooldownKey(email),
    String(Date.now() + PASSWORD_RESET_COOLDOWN_SECONDS * 1000),
  )
}

function AuthCard({ children }: { children: ReactNode }) {
  return (
    <section className="auth-credential-card">
      {children}
    </section>
  )
}

const inputClassName =
  'auth-credential-input w-full border border-border bg-background px-3 text-base text-foreground outline-none transition placeholder:text-foreground/35 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60'
const primaryButtonClassName =
  'auth-credential-primary-button inline-flex w-full cursor-pointer items-center justify-center gap-2 bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50'
const secondaryButtonClassName =
  'auth-credential-secondary-button inline-flex w-full cursor-pointer items-center justify-center border border-border bg-background px-4 text-sm font-medium text-foreground transition hover:bg-control-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50'

type AuthMessageTone = 'error' | 'info' | 'success'

function AuthMessage({
  message,
  tone = 'error',
}: {
  message: string | null
  tone?: AuthMessageTone
}) {
  if (!message) return null
  const isError = tone === 'error'
  const Icon = isError ? CircleAlert : CircleCheck
  const toneClassName = isError
    ? 'border-destructive/25 bg-destructive/5 text-destructive'
    : tone === 'success'
      ? 'border-primary/25 bg-primary/5 text-foreground/80'
      : 'border-border bg-control-hover/50 text-foreground/75'

  return (
    <p
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm leading-6 ${toneClassName}`}
    >
      <Icon className="mt-1 size-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </p>
  )
}

function FormError({ message }: { message: string | null }) {
  return <AuthMessage message={message} tone="error" />
}

function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  disabled,
  describedBy,
}: {
  id?: string
  value: string
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
  autoComplete: 'current-password' | 'new-password'
  disabled: boolean
  describedBy?: string
}) {
  const [isVisible, setIsVisible] = useState(false)

  return (
    <div className="auth-password-input-wrap relative">
      <input
        id={id}
        className={`${inputClassName} pr-12`}
        type={isVisible ? 'text' : 'password'}
        autoComplete={autoComplete}
        aria-describedby={describedBy}
        value={value}
        onChange={onChange}
        minLength={autoComplete === 'new-password' ? 8 : undefined}
        required
        disabled={disabled}
      />
      <button
        type="button"
        className="absolute inset-y-0 right-0 inline-flex min-w-11 cursor-pointer items-center justify-center rounded-r-lg text-foreground/55 transition hover:bg-control-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
        onClick={() => setIsVisible((visible) => !visible)}
        aria-label={isVisible ? '隱藏密碼' : '顯示密碼'}
        title={isVisible ? '隱藏密碼' : '顯示密碼'}
        disabled={disabled}
      >
        {isVisible ? (
          <EyeOff className="size-5" aria-hidden="true" />
        ) : (
          <Eye className="size-5" aria-hidden="true" />
        )}
      </button>
    </div>
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
      <div className="auth-credential-header text-center">
        <h2 className="auth-credential-title font-semibold text-foreground">登入</h2>
        <p className="auth-credential-description text-sm leading-6 text-foreground/60">
          登入後即可存取你的雲端專案
        </p>
      </div>
      <form className="auth-credential-form" onSubmit={handleSubmit}>
        <label className="block text-sm font-medium text-foreground">
          電子郵件
          <input
            className={inputClassName}
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
          <PasswordInput
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={isSubmitting}
          />
        </label>
        <div className="auth-credential-actions flex items-center justify-between gap-4 text-sm">
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
      <p className="auth-credential-switch text-center text-sm text-foreground/60">
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
      <div className="auth-credential-header text-center">
        <h2 className="auth-credential-title font-semibold text-foreground">註冊</h2>
        <p className="auth-credential-description text-sm leading-6 text-foreground/60">
          建立帳號以跨裝置保存專案
        </p>
      </div>
      <form
        className="auth-credential-form auth-credential-form--sign-up"
        onSubmit={handleSubmit}
      >
        <div>
          <label
            htmlFor="sign-up-name"
            className="block text-sm font-medium text-foreground"
          >
            名稱
          </label>
          <input
            id="sign-up-name"
            className={inputClassName}
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
            className={inputClassName}
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
          <PasswordInput
            id="sign-up-password"
            autoComplete="new-password"
            describedBy="sign-up-password-help"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={isSubmitting}
          />
          <ul
            id="sign-up-password-help"
            className="mt-2 space-y-1 text-xs leading-5"
            aria-live="polite"
          >
            <li
              className={`flex items-center gap-1.5 ${
                password.length >= 8 ? 'text-primary' : 'text-foreground/50'
              }`}
            >
              {password.length >= 8 ? (
                <CircleCheck className="size-3.5" aria-hidden="true" />
              ) : (
                <Circle className="size-3.5" aria-hidden="true" />
              )}
              <span className="sr-only">
                {password.length >= 8 ? '已符合：' : '尚未符合：'}
              </span>
              至少 8 個字元
            </li>
            <li
              className={`flex items-center gap-1.5 ${
                confirmPassword.length > 0 && password === confirmPassword
                  ? 'text-primary'
                  : 'text-foreground/50'
              }`}
            >
              {confirmPassword.length > 0 && password === confirmPassword ? (
                <CircleCheck className="size-3.5" aria-hidden="true" />
              ) : (
                <Circle className="size-3.5" aria-hidden="true" />
              )}
              <span className="sr-only">
                {confirmPassword.length > 0 && password === confirmPassword
                  ? '已符合：'
                  : '尚未符合：'}
              </span>
              兩次輸入的密碼一致
            </li>
          </ul>
        </div>
        <div>
          <label
            htmlFor="sign-up-confirm-password"
            className="block text-sm font-medium text-foreground"
          >
            確認密碼
          </label>
          <PasswordInput
            id="sign-up-confirm-password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            disabled={isSubmitting}
          />
        </div>
        <FormError message={errorMessage} />
        <button className={primaryButtonClassName} disabled={isSubmitting}>
          {isSubmitting && <LoaderCircle className="size-4 animate-spin" />}
          {isSubmitting ? '建立中…' : '建立帳號'}
        </button>
      </form>
      <p className="auth-credential-switch auth-credential-switch--sign-up text-center text-sm text-foreground/60">
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

export function ForgotPasswordView({ returnTo }: { returnTo: string }) {
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState(
    () => searchParams.get('email')?.trim().toLowerCase() ?? '',
  )
  const [sentEmail, setSentEmail] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!sentEmail || cooldown <= 0) return
    const timer = window.setInterval(() => {
      setCooldown(getPasswordResetCooldownSeconds(sentEmail))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [cooldown, sentEmail])

  async function sendResetEmail(targetEmail: string) {
    const normalizedEmail = targetEmail.trim().toLowerCase()
    if (!normalizedEmail || isSubmitting) return

    setIsSubmitting(true)
    setErrorMessage(null)
    try {
      const resetParams = new URLSearchParams({ returnTo })
      await authClient.requestPasswordReset({
        email: normalizedEmail,
        redirectTo: `${window.location.origin}/auth/reset-password?${resetParams}`,
        fetchOptions: { throw: true },
      })
      startPasswordResetCooldown(normalizedEmail)
      setSentEmail(normalizedEmail)
      setCooldown(PASSWORD_RESET_COOLDOWN_SECONDS)
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void sendResetEmail(email)
  }

  if (sentEmail) {
    return (
      <AuthCard>
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <MailCheck className="size-7" aria-hidden="true" />
        </div>
        <div className="mt-5 text-center">
          <h2 className="auth-credential-title font-semibold text-foreground">
            查看重設信
          </h2>
          <p className="auth-credential-description text-sm leading-6 text-foreground/60">
            密碼重設連結已寄送至
            <strong className="mx-1 break-all font-semibold text-foreground">
              {sentEmail}
            </strong>
          </p>
        </div>
        <div className="mt-5 space-y-3">
          <AuthMessage
            message="若沒有看到信件，請同時檢查垃圾郵件匣。"
            tone="info"
          />
          <FormError message={errorMessage} />
        </div>
        <div className="mt-6 space-y-3">
          <button
            type="button"
            className={secondaryButtonClassName}
            onClick={() => void sendResetEmail(sentEmail)}
            disabled={cooldown > 0 || isSubmitting}
          >
            {isSubmitting && <LoaderCircle className="size-4 animate-spin" />}
            {isSubmitting
              ? '寄送中…'
              : cooldown > 0
                ? `${cooldown} 秒後可重新寄送`
                : '重新寄送重設信'}
          </button>
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm">
          <button
            type="button"
            className="min-h-11 cursor-pointer rounded px-1 py-2 text-foreground/60 underline-offset-4 transition hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            onClick={() => {
              setSentEmail(null)
              setErrorMessage(null)
            }}
          >
            更換電子郵件
          </button>
          <Link
            to={`/auth/sign-in?returnTo=${encodeURIComponent(returnTo)}`}
            className="inline-flex min-h-11 items-center rounded px-1 py-2 text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            返回登入
          </Link>
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard>
      <div className="auth-credential-header text-center">
        <h2 className="auth-credential-title font-semibold text-foreground">
          忘記密碼
        </h2>
        <p className="auth-credential-description text-sm leading-6 text-foreground/60">
          輸入電子郵件，我們會寄送密碼重設連結給你
        </p>
      </div>
      <form className="auth-credential-form" onSubmit={handleSubmit}>
        <label className="block text-sm font-medium text-foreground">
          電子郵件
          <input
            className={inputClassName}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            disabled={isSubmitting}
          />
        </label>
        <FormError message={errorMessage} />
        <button className={primaryButtonClassName} disabled={isSubmitting}>
          {isSubmitting && <LoaderCircle className="size-4 animate-spin" />}
          {isSubmitting ? '寄送中…' : '寄送重設連結'}
        </button>
      </form>
      <p className="auth-credential-switch text-center text-sm">
        <Link
          to={`/auth/sign-in?returnTo=${encodeURIComponent(returnTo)}`}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          返回登入
        </Link>
      </p>
    </AuthCard>
  )
}

export function ResetPasswordView({ returnTo }: { returnTo: string }) {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const isTokenInvalid = !token || token === 'INVALID_TOKEN'
  const isLongEnough = password.length >= 8
  const passwordsMatch =
    confirmPassword.length > 0 && password === confirmPassword

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting || isTokenInvalid) return
    if (!isLongEnough) {
      setErrorMessage('密碼至少需要 8 個字元。')
      return
    }
    if (!passwordsMatch) {
      setErrorMessage('兩次輸入的密碼不一致。')
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)
    try {
      await authClient.resetPassword({
        newPassword: password,
        token,
        fetchOptions: { throw: true },
      })
      setIsComplete(true)
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isTokenInvalid) {
    return (
      <AuthCard>
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <CircleAlert className="size-7" aria-hidden="true" />
        </div>
        <div className="mt-5 text-center">
          <h2 className="auth-credential-title font-semibold text-foreground">
            重設連結無效
          </h2>
        </div>
        <div className="mt-5">
          <AuthMessage message="此連結不存在或已過期，請重新申請密碼重設信。" />
        </div>
        <Link
          className={`${primaryButtonClassName} mt-6`}
          to={`/auth/forgot-password?returnTo=${encodeURIComponent(returnTo)}`}
        >
          重新申請重設連結
        </Link>
      </AuthCard>
    )
  }

  if (isComplete) {
    return (
      <AuthCard>
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CircleCheck className="size-7" aria-hidden="true" />
        </div>
        <div className="mt-5 text-center">
          <h2 className="auth-credential-title font-semibold text-foreground">
            密碼重設完成
          </h2>
          <p className="auth-credential-description text-sm leading-6 text-foreground/60">
            現在可以使用新密碼登入你的帳號。
          </p>
        </div>
        <Link
          className={`${primaryButtonClassName} mt-6`}
          to={`/auth/sign-in?returnTo=${encodeURIComponent(returnTo)}`}
        >
          返回登入
        </Link>
      </AuthCard>
    )
  }

  return (
    <AuthCard>
      <div className="auth-credential-header text-center">
        <h2 className="auth-credential-title font-semibold text-foreground">
          重設密碼
        </h2>
        <p className="auth-credential-description text-sm leading-6 text-foreground/60">
          設定至少 8 個字元的新密碼
        </p>
      </div>
      <form className="auth-credential-form" onSubmit={handleSubmit}>
        <label className="block text-sm font-medium text-foreground">
          新密碼
          <PasswordInput
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={isSubmitting}
            describedBy="reset-password-help"
          />
        </label>
        <label className="block text-sm font-medium text-foreground">
          確認新密碼
          <PasswordInput
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            disabled={isSubmitting}
            describedBy="reset-password-help"
          />
        </label>
        <ul
          id="reset-password-help"
          className="space-y-1 text-xs leading-5"
          aria-live="polite"
        >
          <li
            className={`flex items-center gap-1.5 ${
              isLongEnough ? 'text-primary' : 'text-foreground/50'
            }`}
          >
            {isLongEnough ? (
              <CircleCheck className="size-3.5" aria-hidden="true" />
            ) : (
              <Circle className="size-3.5" aria-hidden="true" />
            )}
            <span className="sr-only">
              {isLongEnough ? '已符合：' : '尚未符合：'}
            </span>
            至少 8 個字元
          </li>
          <li
            className={`flex items-center gap-1.5 ${
              passwordsMatch ? 'text-primary' : 'text-foreground/50'
            }`}
          >
            {passwordsMatch ? (
              <CircleCheck className="size-3.5" aria-hidden="true" />
            ) : (
              <Circle className="size-3.5" aria-hidden="true" />
            )}
            <span className="sr-only">
              {passwordsMatch ? '已符合：' : '尚未符合：'}
            </span>
            兩次輸入的密碼一致
          </li>
        </ul>
        <FormError message={errorMessage} />
        <button className={primaryButtonClassName} disabled={isSubmitting}>
          {isSubmitting && <LoaderCircle className="size-4 animate-spin" />}
          {isSubmitting ? '儲存中…' : '儲存新密碼'}
        </button>
      </form>
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
        <AuthMessage message={statusMessage} tone="info" />
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

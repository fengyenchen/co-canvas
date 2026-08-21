import type { AnchorHTMLAttributes } from 'react'
import {
  AuthView,
  NeonAuthUIProvider,
  type AuthLocalization,
  type AuthViewPath,
} from '@neondatabase/neon-js/auth/react/ui'
import '@neondatabase/neon-js/ui/css'
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router'
import coCanvasLogo from '../assets/branding/co-canvas-logo-primary.svg'
import { authClient } from '../lib/auth'

const authLocalizationZhTw = {
  APP: 'Co-Canvas',
  ALREADY_HAVE_AN_ACCOUNT: '已經有帳號了嗎？',
  DONT_HAVE_AN_ACCOUNT: '還沒有帳號嗎？',
  EMAIL: '電子郵件',
  EMAIL_PLACEHOLDER: 'name@example.com',
  EMAIL_REQUIRED: '請輸入電子郵件',
  NAME: '名稱',
  NAME_PLACEHOLDER: '你的名稱',
  PASSWORD: '密碼',
  PASSWORD_PLACEHOLDER: '輸入密碼',
  PASSWORD_REQUIRED: '請輸入密碼',
  PASSWORDS_DO_NOT_MATCH: '兩次輸入的密碼不一致',
  FORGOT_PASSWORD: '忘記密碼',
  FORGOT_PASSWORD_ACTION: '寄送重設連結',
  FORGOT_PASSWORD_DESCRIPTION: '輸入電子郵件以重設密碼',
  FORGOT_PASSWORD_EMAIL: '請查看信箱中的密碼重設連結。',
  FORGOT_PASSWORD_LINK: '忘記密碼？',
  OR_CONTINUE_WITH: '或使用以下方式繼續',
  REMEMBER_ME: '記住我',
  RESET_PASSWORD: '重設密碼',
  RESET_PASSWORD_ACTION: '儲存新密碼',
  RESET_PASSWORD_DESCRIPTION: '請在下方輸入新密碼',
  RESET_PASSWORD_SUCCESS: '密碼重設成功',
  REQUEST_FAILED: '請求失敗',
  SIGN_IN: '登入',
  SIGN_IN_ACTION: '登入',
  SIGN_IN_DESCRIPTION: '登入後即可存取你的雲端專案',
  SIGN_UP: '註冊',
  SIGN_UP_ACTION: '建立帳號',
  SIGN_UP_DESCRIPTION: '建立帳號以跨裝置保存專案',
  SIGN_OUT: '登出',
  INVALID_EMAIL: '電子郵件格式不正確',
  INVALID_EMAIL_OR_PASSWORD: '電子郵件或密碼不正確',
  INVALID_PASSWORD: '密碼不正確',
  PASSWORD_TOO_SHORT: '密碼長度不足',
  PASSWORD_TOO_LONG: '密碼過長',
  USER_ALREADY_EXISTS: '此電子郵件已註冊',
  UNEXPECTED_ERROR: '發生未預期的錯誤，請稍後再試。',
} satisfies AuthLocalization

function getSafeReturnTo(value: string | null): string {
  if (
    value &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !value.startsWith('/auth')
  ) {
    return value
  }

  return '/projects'
}

function AuthLink({ href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const [searchParams] = useSearchParams()
  const returnTo = getSafeReturnTo(searchParams.get('returnTo'))
  let destination = href ?? '/'

  if (returnTo !== '/' && destination.startsWith('/auth/')) {
    const separator = destination.includes('?') ? '&' : '?'
    destination += `${separator}returnTo=${encodeURIComponent(returnTo)}`
  }

  return <Link to={destination} {...props} />
}

export function AuthPage() {
  const navigate = useNavigate()
  const { authPath = 'sign-in' } = useParams()
  const [searchParams] = useSearchParams()
  const returnTo = getSafeReturnTo(searchParams.get('returnTo'))

  return (
    <main className="min-h-dvh bg-canvas px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-sm">
        <Link
          to="/"
          className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-medium text-foreground/65 transition hover:bg-primary/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <span aria-hidden="true" className="mr-2 text-lg">
            ←
          </span>
          返回首頁
        </Link>

        <header className="mt-8 text-center">
          <h1 aria-label="Co-Canvas">
            <img
              src={coCanvasLogo}
              alt=""
              width="144"
              height="144"
              className="mx-auto size-32 object-contain sm:size-36"
            />
          </h1>
          <p className="mt-3 text-base font-medium text-primary">
            整理想法，保留脈絡
          </p>
        </header>

        <div aria-hidden="true" className="h-6" />

        <NeonAuthUIProvider
          authClient={authClient}
          basePath="/auth"
          redirectTo={returnTo}
          navigate={(href) => navigate(href)}
          replace={(href) => navigate(href, { replace: true })}
          Link={AuthLink}
          localization={authLocalizationZhTw}
          defaultTheme="light"
        >
          <AuthView
            path={authPath as AuthViewPath}
            redirectTo={returnTo}
          />
        </NeonAuthUIProvider>
      </div>
    </main>
  )
}

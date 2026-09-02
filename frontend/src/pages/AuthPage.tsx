import type { AnchorHTMLAttributes } from "react";
import {
  AuthView,
  NeonAuthUIProvider,
  type AuthLocalization,
  type AuthViewPath,
} from "@neondatabase/neon-js/auth/react/ui";
import "@neondatabase/neon-js/ui/css";
import "./AuthPage.css";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import authCanvasHero from "../assets/branding/auth-canvas-hero.png";
import {
  ForgotPasswordView,
  ResetPasswordView,
  SignInView,
  SignUpView,
  VerifyEmailView,
} from "../components/auth/CredentialAuthViews";
import { authClient } from "../lib/auth";

const authLocalizationZhTw = {
  APP: "Co-Canvas",
  EMAIL: "電子郵件",
  EMAIL_PLACEHOLDER: "請輸入電子郵件",
  IS_INVALID: "格式不正確",
  IS_REQUIRED: "為必填欄位",

  SIGN_IN: "登入",
  GO_BACK: "返回登入",

  FORGOT_PASSWORD: "忘記密碼",
  FORGOT_PASSWORD_ACTION: "寄送重設連結",
  FORGOT_PASSWORD_DESCRIPTION: "輸入電子郵件，我們會寄送密碼重設連結給你",
  FORGOT_PASSWORD_EMAIL: "密碼重設信已寄出，請前往信箱查看。",
  FORGOT_PASSWORD_LINK: "忘記密碼？",

  RESET_PASSWORD: "重設密碼",
  RESET_PASSWORD_ACTION: "儲存新密碼",
  RESET_PASSWORD_DESCRIPTION: "請在下方設定你的新密碼",
  RESET_PASSWORD_SUCCESS: "密碼已重設，請使用新密碼登入。",
  NEW_PASSWORD: "新密碼",
  NEW_PASSWORD_PLACEHOLDER: "請輸入新密碼",
  NEW_PASSWORD_REQUIRED: "請輸入新密碼",
  CONFIRM_PASSWORD: "確認新密碼",
  CONFIRM_PASSWORD_PLACEHOLDER: "請再次輸入新密碼",
  CONFIRM_PASSWORD_REQUIRED: "請再次輸入新密碼",
  PASSWORDS_DO_NOT_MATCH: "兩次輸入的密碼不一致",
  PASSWORD_TOO_SHORT: "密碼至少需要 8 個字元",
  PASSWORD_TOO_LONG: "密碼長度超過限制",
  INVALID_PASSWORD: "密碼格式不正確",

  EMAIL_VERIFICATION: "驗證電子郵件",
  EMAIL_VERIFICATION_DESCRIPTION: "請查看信箱並完成電子郵件驗證。",
  EMAIL_VERIFICATION_SUCCESS: "電子郵件驗證成功。",
  INVALID_TOKEN: "連結無效或已過期，請重新申請。",
  VERIFICATION_FAILED: "驗證失敗，請重新嘗試。",
  REQUEST_FAILED: "操作失敗，請稍後再試。",
  TOO_MANY_ATTEMPTS: "嘗試次數過多，請稍後再試。",
  SERVICE_UNAVAILABLE: "服務暫時無法使用，請稍後再試。",
  UNEXPECTED_ERROR: "發生未預期的錯誤，請稍後再試。",
  UNKNOWN_ERROR: "發生錯誤，請稍後再試。",
} satisfies AuthLocalization;

const neonAuthViewClassNames = {
  base: "auth-neon-card",
  header: "auth-neon-header",
  title: "auth-neon-title",
  description: "auth-neon-description",
  content: "auth-neon-content",
  footer: "auth-neon-footer",
  footerLink: "auth-neon-footer-link",
  form: {
    base: "auth-neon-form",
    label: "auth-neon-label",
    input: "auth-neon-input",
    button: "auth-neon-button",
    primaryButton: "auth-neon-primary-button",
    secondaryButton: "auth-neon-secondary-button",
  },
};

function getSafeReturnTo(value: string | null): string {
  if (
    value &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.startsWith("/auth")
  ) {
    return value;
  }
  return "/projects";
}

function AuthLink({ href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const [searchParams] = useSearchParams();
  const returnTo = getSafeReturnTo(searchParams.get("returnTo"));
  let destination = href ?? "/";

  if (returnTo !== "/" && destination.startsWith("/auth/")) {
    const separator = destination.includes("?") ? "&" : "?";
    destination += `${separator}returnTo=${encodeURIComponent(returnTo)}`;
  }

  return <Link to={destination} {...props} />;
}

export function AuthPage() {
  const navigate = useNavigate();
  const { authPath = "sign-in" } = useParams();
  const [searchParams] = useSearchParams();
  const returnTo = getSafeReturnTo(searchParams.get("returnTo"));

  return (
    <main className="auth-page relative min-h-dvh overflow-hidden bg-background text-foreground">
      <img
        src={authCanvasHero}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 hidden size-full object-cover object-center md:block"
      />
      <div className="absolute inset-0 hidden bg-linear-to-r from-transparent via-transparent to-background/25 md:block" />

      <Link
        to="/"
        className="auth-home-link absolute left-6 top-6 z-20 min-h-11 items-center gap-2 rounded-full border border-border/70 bg-background/80 px-4 text-sm font-medium text-foreground/75 shadow-sm backdrop-blur transition hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <span aria-hidden="true" className="text-base">←</span>
        返回首頁
      </Link>

      <div className="relative z-10 flex min-h-dvh justify-end p-4 lg:p-6">
        <section className="flex min-h-dvh w-full flex-col justify-between overflow-y-auto bg-background px-2 py-7 sm:px-10 sm:py-4 md:min-h-0 md:max-w-116 md:overflow-hidden md:rounded-3xl md:border md:border-border/70 md:bg-background/95 md:px-10 md:py-8 md:shadow-[0_20px_60px_rgba(15,23,42,0.14)] md:backdrop-blur-sm lg:px-12">
          <Link
            to="/"
            className="auth-mobile-home-link mb-4 min-h-11 items-center gap-2 text-sm font-medium text-foreground/80 transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <span aria-hidden="true" className="text-lg">
              ←
            </span>
            返回首頁
          </Link>

          <div className="flex min-h-0 flex-1 flex-col justify-center">
            <NeonAuthUIProvider
              authClient={authClient}
              basePath="/auth"
              redirectTo={returnTo}
              navigate={(href) => navigate(href)}
              replace={(href) => navigate(href, { replace: true })}
              Link={AuthLink}
              localization={authLocalizationZhTw}
              defaultTheme="light"
              emailVerification
            >
              {authPath === "sign-in" ? (
                <SignInView returnTo={returnTo} />
              ) : authPath === "sign-up" ? (
                <SignUpView returnTo={returnTo} />
              ) : authPath === "verify-email" ? (
                <VerifyEmailView returnTo={returnTo} />
              ) : authPath === "forgot-password" ? (
                <ForgotPasswordView returnTo={returnTo} />
              ) : authPath === "reset-password" ? (
                <ResetPasswordView returnTo={returnTo} />
              ) : (
                <AuthView
                  path={authPath as AuthViewPath}
                  redirectTo={returnTo}
                  classNames={neonAuthViewClassNames}
                />
              )}
            </NeonAuthUIProvider>
          </div>
        </section>
      </div>
    </main>
  );
}

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
  SignInView,
  SignUpView,
  VerifyEmailView,
} from "../components/auth/CredentialAuthViews";
import { authClient } from "../lib/auth";

const authLocalizationZhTw = {
  // ... 這裡保留你的翻譯設定 ...
  APP: "Co-Canvas",
  SIGN_IN: "登入",
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

/* eslint-disable react-refresh/only-export-components -- MDX component map is configuration shared by both guide pages. */
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import type { MDXComponents } from 'mdx/types'

function GuideHero({ children }: { children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-canvas/65 px-6 py-8 shadow-sm sm:px-9 sm:py-10">
      {children}
    </div>
  )
}

function SectionTitle({ id, children }: { id?: string; children?: ReactNode }) {
  return <h2 id={id} className="mt-16 scroll-mt-24 border-t border-border pt-12 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{children}</h2>
}

export const guideMdxComponents: MDXComponents = {
  GuideHero,
  SectionTitle,
  h1: (props: ComponentPropsWithoutRef<'h1'>) => <h1 {...props} className="mt-4 max-w-4xl text-4xl font-semibold leading-[1.12] tracking-tight text-foreground sm:text-5xl lg:text-6xl" />,
  h2: (props: ComponentPropsWithoutRef<'h2'>) => <h2 {...props} className="mt-16 scroll-mt-24 border-t border-border pt-12 text-2xl font-semibold tracking-tight text-foreground first:mt-0 first:border-t-0 first:pt-0 sm:text-3xl" />,
  h3: (props: ComponentPropsWithoutRef<'h3'>) => <h3 {...props} className="mt-9 text-lg font-semibold text-foreground" />,
  h4: (props: ComponentPropsWithoutRef<'h4'>) => <h4 {...props} className="mt-6 font-semibold text-foreground" />,
  p: (props: ComponentPropsWithoutRef<'p'>) => <p {...props} className="mt-4 text-[0.95rem] leading-7 text-foreground/70" />,
  ul: (props: ComponentPropsWithoutRef<'ul'>) => <ul {...props} className="mt-4 list-disc space-y-2 pl-6 text-[0.95rem] leading-7 text-foreground/70 marker:text-primary" />,
  ol: (props: ComponentPropsWithoutRef<'ol'>) => <ol {...props} className="mt-4 list-decimal space-y-3 pl-6 text-[0.95rem] leading-7 text-foreground/70 marker:font-semibold marker:text-primary" />,
  strong: (props: ComponentPropsWithoutRef<'strong'>) => <strong {...props} className="font-semibold text-foreground" />,
  a: (props: ComponentPropsWithoutRef<'a'>) => <a {...props} className="font-medium text-primary underline decoration-primary/30 underline-offset-4 transition hover:decoration-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40" />,
  blockquote: (props: ComponentPropsWithoutRef<'blockquote'>) => <blockquote {...props} className="mt-6 rounded-xl border border-border bg-canvas/55 px-5 py-1 text-sm [&>p]:my-3 [&>p]:text-sm [&>p]:leading-6" />,
  table: (props: ComponentPropsWithoutRef<'table'>) => <div className="mt-6 overflow-x-auto rounded-xl border border-border"><table {...props} className="w-full min-w-176 border-collapse text-left text-sm" /></div>,
  thead: (props: ComponentPropsWithoutRef<'thead'>) => <thead {...props} className="bg-canvas/65 text-foreground" />,
  tbody: (props: ComponentPropsWithoutRef<'tbody'>) => <tbody {...props} className="divide-y divide-border" />,
  th: (props: ComponentPropsWithoutRef<'th'>) => <th {...props} className="px-4 py-3 align-top font-semibold text-foreground" />,
  td: (props: ComponentPropsWithoutRef<'td'>) => <td {...props} className="px-4 py-3 align-top leading-6 text-foreground/65" />,
  pre: (props: ComponentPropsWithoutRef<'pre'>) => <pre {...props} className="mt-5 overflow-x-auto rounded-xl bg-foreground p-4 text-xs leading-6 text-background" />,
  code: (props: ComponentPropsWithoutRef<'code'>) => <code {...props} className="rounded bg-canvas px-1.5 py-0.5 font-mono text-[0.88em] text-foreground in-[pre]:bg-transparent in-[pre]:p-0 in-[pre]:text-inherit" />,
  hr: () => <hr className="my-12 border-border" />,
}

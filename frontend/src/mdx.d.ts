declare module '*.mdx' {
  import type { ComponentType } from 'react'
  import type { MDXProps } from 'mdx/types'

  const MDXContent: ComponentType<MDXProps>
  export default MDXContent
}

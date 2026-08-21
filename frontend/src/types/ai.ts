export type AiMode = 'gemini' | 'mock'

export type AiFallbackReason =
  | 'configured_mock'
  | 'unauthenticated'
  | 'missing_key'
  | 'invalid_key'
  | 'quota_exceeded'

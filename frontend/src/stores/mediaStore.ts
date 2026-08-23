import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ProjectMedia } from '../types/project'

type MediaState = {
  media: ProjectMedia | null
  setMedia: (media: ProjectMedia | null) => void
}

export const useMediaStore = create<MediaState>()(
  persist(
    (set) => ({
      media: null,
      setMedia: (media) => set({ media }),
    }),
    {
      name: 'co-canvas-media',
    },
  ),
)

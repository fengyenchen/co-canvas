import type { ConceptNodeColor } from '../types/canvas'

export const CONCEPT_NODE_COLOR_OPTIONS: ReadonlyArray<{
  value: ConceptNodeColor
  label: string
  swatchClassName: string
  backgroundClassName: string
  borderClassName: string
}> = [
  {
    value: 'default',
    label: '預設',
    swatchClassName: 'bg-background',
    backgroundClassName: 'bg-background',
    borderClassName: 'border-border',
  },
  {
    value: 'yellow',
    label: '黃色',
    swatchClassName: 'bg-amber-200',
    backgroundClassName: 'bg-amber-50',
    borderClassName: 'border-amber-200',
  },
  {
    value: 'pink',
    label: '粉紅色',
    swatchClassName: 'bg-rose-200',
    backgroundClassName: 'bg-rose-50',
    borderClassName: 'border-rose-200',
  },
  {
    value: 'blue',
    label: '藍色',
    swatchClassName: 'bg-sky-200',
    backgroundClassName: 'bg-sky-50',
    borderClassName: 'border-sky-200',
  },
  {
    value: 'green',
    label: '綠色',
    swatchClassName: 'bg-emerald-200',
    backgroundClassName: 'bg-emerald-50',
    borderClassName: 'border-emerald-200',
  },
  {
    value: 'purple',
    label: '紫色',
    swatchClassName: 'bg-violet-200',
    backgroundClassName: 'bg-violet-50',
    borderClassName: 'border-violet-200',
  },
]

export function getConceptNodeColor(color: ConceptNodeColor | undefined) {
  return CONCEPT_NODE_COLOR_OPTIONS.find(
    (option) => option.value === (color ?? 'default'),
  ) ?? CONCEPT_NODE_COLOR_OPTIONS[0]
}

export const GROUP_NODE_COLOR_OPTIONS = CONCEPT_NODE_COLOR_OPTIONS

const GROUP_NODE_COLORS: Record<ConceptNodeColor, {
  backgroundClassName: string
  borderClassName: string
  dividerClassName: string
  accentClassName: string
}> = {
  default: {
    backgroundClassName: 'bg-primary/3',
    borderClassName: 'border-primary/25',
    dividerClassName: 'border-primary/15',
    accentClassName: 'text-primary',
  },
  yellow: {
    backgroundClassName: 'bg-amber-50/60',
    borderClassName: 'border-amber-300',
    dividerClassName: 'border-amber-200',
    accentClassName: 'text-amber-700',
  },
  pink: {
    backgroundClassName: 'bg-rose-50/60',
    borderClassName: 'border-rose-300',
    dividerClassName: 'border-rose-200',
    accentClassName: 'text-rose-700',
  },
  blue: {
    backgroundClassName: 'bg-sky-50/60',
    borderClassName: 'border-sky-300',
    dividerClassName: 'border-sky-200',
    accentClassName: 'text-sky-700',
  },
  green: {
    backgroundClassName: 'bg-emerald-50/60',
    borderClassName: 'border-emerald-300',
    dividerClassName: 'border-emerald-200',
    accentClassName: 'text-emerald-700',
  },
  purple: {
    backgroundClassName: 'bg-violet-50/60',
    borderClassName: 'border-violet-300',
    dividerClassName: 'border-violet-200',
    accentClassName: 'text-violet-700',
  },
}

export function getGroupNodeColor(color: ConceptNodeColor | undefined) {
  return GROUP_NODE_COLORS[color ?? 'default']
}

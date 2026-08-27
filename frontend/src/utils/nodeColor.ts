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

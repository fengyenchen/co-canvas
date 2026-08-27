import type { CanvasEdge, CanvasNode } from '../types/canvas'

const NODE_WIDTH = 280
const NODE_PADDING = 18
const TITLE_FONT = '600 16px system-ui, "Segoe UI", sans-serif'
const BODY_FONT = '14px system-ui, "Segoe UI", sans-serif'
const LABEL_FONT = '13px system-ui, "Segoe UI", sans-serif'
const TITLE_LINE_HEIGHT = 23
const BODY_LINE_HEIGHT = 21
const MARGIN = 80
const MAX_CANVAS_DIMENSION = 16_000

type NodeLayout = {
    node: CanvasNode
    x: number
    y: number
    width: number
    height: number
    titleLines: string[]
    contentLines: string[]
}

function wrapText(
    context: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
) {
    const lines: string[] = []

    for (const paragraph of text.split('\n')) {
        if (paragraph.length === 0) {
            lines.push('')
            continue
        }

        let line = ''

        for (const character of paragraph) {
            const candidate = line + character

            if (line && context.measureText(candidate).width > maxWidth) {
                lines.push(line.trimEnd())
                line = character.trimStart()
            } else {
                line = candidate
            }
        }

        if (line) {
            lines.push(line.trimEnd())
        }
    }

    return lines
}

function roundedRectangle(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
) {
    const corner = Math.min(radius, width / 2, height / 2)

    context.beginPath()
    context.moveTo(x + corner, y)
    context.lineTo(x + width - corner, y)
    context.quadraticCurveTo(x + width, y, x + width, y + corner)
    context.lineTo(x + width, y + height - corner)
    context.quadraticCurveTo(
        x + width,
        y + height,
        x + width - corner,
        y + height,
    )
    context.lineTo(x + corner, y + height)
    context.quadraticCurveTo(x, y + height, x, y + height - corner)
    context.lineTo(x, y + corner)
    context.quadraticCurveTo(x, y, x + corner, y)
    context.closePath()
}

function createLayouts(
    context: CanvasRenderingContext2D,
    nodes: CanvasNode[],
) {
    const groupById = new Map(
        nodes
            .filter((node) => node.type === 'group')
            .map((node) => [node.id, node]),
    )

    return nodes.map<NodeLayout>((node) => {
        const parent = node.parentId ? groupById.get(node.parentId) : undefined
        const x = node.position.x + (parent?.position.x ?? 0)
        const y = node.position.y + (parent?.position.y ?? 0)

        if (node.type === 'group') {
            return {
                node,
                x,
                y,
                width: node.data.width,
                height: node.data.height,
                titleLines: [node.data.title || '未命名群組'],
                contentLines: [],
            }
        }

        context.font = TITLE_FONT
        const titleLines = wrapText(
            context,
            node.data.title || '未命名節點',
            NODE_WIDTH - NODE_PADDING * 2,
        )

        context.font = BODY_FONT
        const contentLines = node.data.content
            ? wrapText(
                  context,
                  node.data.content,
                  NODE_WIDTH - NODE_PADDING * 2,
              )
            : []
        const contentGap = contentLines.length > 0 ? 9 : 0
        const height = Math.max(
            60,
            NODE_PADDING * 2 +
                titleLines.length * TITLE_LINE_HEIGHT +
                contentGap +
                contentLines.length * BODY_LINE_HEIGHT,
        )

        return {
            node,
            x,
            y,
            width: NODE_WIDTH,
            height,
            titleLines,
            contentLines,
        }
    })
}

function drawEdge(
    context: CanvasRenderingContext2D,
    edge: CanvasEdge,
    source: NodeLayout,
    target: NodeLayout,
) {
    const sourceX = source.x + source.width / 2
    const sourceY = source.y + source.height
    const targetX = target.x + target.width / 2
    const targetY = target.y
    const controlOffset = Math.max(50, Math.abs(targetY - sourceY) * 0.45)
    const controlOneX = sourceX
    const controlOneY = sourceY + controlOffset
    const controlTwoX = targetX
    const controlTwoY = targetY - controlOffset

    context.save()
    context.strokeStyle = '#94a3b8'
    context.lineWidth = 2
    context.beginPath()
    context.moveTo(sourceX, sourceY)
    context.bezierCurveTo(
        controlOneX,
        controlOneY,
        controlTwoX,
        controlTwoY,
        targetX,
        targetY,
    )
    context.stroke()

    const label =
        typeof edge.label === 'string'
            ? edge.label
            : edge.data?.label

    if (label) {
        const labelX =
            (sourceX + 3 * controlOneX + 3 * controlTwoX + targetX) / 8
        const labelY =
            (sourceY + 3 * controlOneY + 3 * controlTwoY + targetY) / 8

        context.font = LABEL_FONT
        const labelWidth = context.measureText(label).width
        const boxWidth = labelWidth + 16
        const boxHeight = 26

        roundedRectangle(
            context,
            labelX - boxWidth / 2,
            labelY - boxHeight / 2,
            boxWidth,
            boxHeight,
            7,
        )
        context.fillStyle = '#f8fafc'
        context.fill()
        context.strokeStyle = '#d4d4d8'
        context.lineWidth = 1
        context.stroke()
        context.fillStyle = '#3f3f46'
        context.textAlign = 'center'
        context.textBaseline = 'middle'
        context.fillText(label, labelX, labelY)
    }

    context.restore()
}

function drawNode(context: CanvasRenderingContext2D, layout: NodeLayout) {
    context.save()

    if (layout.node.type === 'group') {
        roundedRectangle(
            context,
            layout.x,
            layout.y,
            layout.width,
            layout.height,
            16,
        )
        context.fillStyle = 'rgba(91, 91, 102, 0.04)'
        context.fill()
        context.setLineDash([8, 6])
        context.strokeStyle = 'rgba(91, 91, 102, 0.35)'
        context.lineWidth = 2
        context.stroke()
        context.setLineDash([])
        context.fillStyle = '#3f3f46'
        context.font = TITLE_FONT
        context.textAlign = 'left'
        context.textBaseline = 'top'
        context.fillText(
            layout.titleLines[0],
            layout.x + NODE_PADDING,
            layout.y + NODE_PADDING,
        )
        context.restore()
        return
    }

    context.shadowColor = 'rgba(15, 23, 42, 0.08)'
    context.shadowBlur = 12
    context.shadowOffsetY = 3
    roundedRectangle(
        context,
        layout.x,
        layout.y,
        layout.width,
        layout.height,
        12,
    )
    context.fillStyle = '#ffffff'
    context.fill()
    context.shadowColor = 'transparent'
    context.strokeStyle = '#d4d4d8'
    context.lineWidth = 1.25
    context.stroke()

    context.textAlign = 'left'
    context.textBaseline = 'top'
    context.fillStyle = '#18181b'
    context.font = TITLE_FONT

    let textY = layout.y + NODE_PADDING

    for (const line of layout.titleLines) {
        context.fillText(line, layout.x + NODE_PADDING, textY)
        textY += TITLE_LINE_HEIGHT
    }

    if (layout.contentLines.length > 0) {
        textY += 9
        context.fillStyle = '#52525b'
        context.font = BODY_FONT

        for (const line of layout.contentLines) {
            context.fillText(line, layout.x + NODE_PADDING, textY)
            textY += BODY_LINE_HEIGHT
        }
    }

    context.restore()
}

export async function renderCanvasPng(
    nodes: CanvasNode[],
    edges: CanvasEdge[],
) {
    if (nodes.length === 0) {
        throw new Error('畫布沒有節點')
    }

    const measurementCanvas = document.createElement('canvas')
    const measurementContext = measurementCanvas.getContext('2d')

    if (!measurementContext) {
        throw new Error('瀏覽器不支援 Canvas')
    }

    const layouts = createLayouts(measurementContext, nodes)
    const minimumX = Math.min(...layouts.map((layout) => layout.x))
    const minimumY = Math.min(...layouts.map((layout) => layout.y))
    const maximumX = Math.max(
        ...layouts.map((layout) => layout.x + layout.width),
    )
    const maximumY = Math.max(
        ...layouts.map((layout) => layout.y + layout.height),
    )
    const logicalWidth = Math.ceil(maximumX - minimumX + MARGIN * 2)
    const logicalHeight = Math.ceil(maximumY - minimumY + MARGIN * 2)
    const pixelRatio = Math.min(
        2,
        MAX_CANVAS_DIMENSION / logicalWidth,
        MAX_CANVAS_DIMENSION / logicalHeight,
    )
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.ceil(logicalWidth * pixelRatio))
    canvas.height = Math.max(1, Math.ceil(logicalHeight * pixelRatio))

    const context = canvas.getContext('2d')

    if (!context) {
        throw new Error('瀏覽器不支援 Canvas')
    }

    context.scale(pixelRatio, pixelRatio)
    context.fillStyle = '#eeeef1'
    context.fillRect(0, 0, logicalWidth, logicalHeight)
    context.translate(MARGIN - minimumX, MARGIN - minimumY)

    const layoutById = new Map(
        layouts.map((layout) => [layout.node.id, layout]),
    )

    for (const edge of edges) {
        const source = layoutById.get(edge.source)
        const target = layoutById.get(edge.target)

        if (source && target) {
            drawEdge(context, edge, source, target)
        }
    }

    for (const layout of layouts) {
        drawNode(context, layout)
    }

    return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) {
                resolve(blob)
            } else {
                reject(new Error('無法建立 PNG'))
            }
        }, 'image/png')
    })
}

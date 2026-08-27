import { beforeEach, describe, expect, it } from 'vitest'

import type { ConceptCanvasNode } from '../types/canvas'
import { useCanvasStore } from './canvasStore'

function createNode(
    id: string,
    x: number,
    y: number,
): ConceptCanvasNode {
    return {
        id,
        type: 'concept',
        position: { x, y },
        width: 256,
        height: 120,
        selected: true,
        data: {
            title: id,
            content: '',
            origin: 'user',
        },
    }
}

describe('canvasStore node groups', () => {
    beforeEach(() => {
        useCanvasStore.setState({
            nodes: [createNode('node-1', 100, 100), createNode('node-2', 420, 240)],
            edges: [],
            past: [],
            future: [],
            isNodeDragging: false,
            canUndo: false,
            canRedo: false,
        })
    })

    it('將選取節點轉為群組的相對座標', () => {
        const groupId = useCanvasStore.getState().groupSelectedNodes()
        const state = useCanvasStore.getState()
        const group = state.nodes.find((node) => node.id === groupId)
        const firstMember = state.nodes.find((node) => node.id === 'node-1')

        expect(group).toMatchObject({
            type: 'group',
            position: { x: 68, y: 36 },
            selected: true,
            deletable: false,
        })
        expect(firstMember).toMatchObject({
            parentId: groupId,
            position: { x: 32, y: 64 },
            selected: false,
        })
        expect(state.canUndo).toBe(true)
    })

    it('節點移到群組框外超過一半時保留畫布位置並移出群組', () => {
        const groupId = useCanvasStore.getState().groupSelectedNodes()
        const group = useCanvasStore
            .getState()
            .nodes.find((node) => node.id === groupId && node.type === 'group')
        expect(group?.type).toBe('group')

        useCanvasStore.setState((state) => ({
            nodes: state.nodes.map((node) =>
                node.id === 'node-1'
                    ? { ...node, position: { x: 900, y: 400 } }
                    : node,
            ),
        }))
        useCanvasStore.getState().reconcileNodeGroup('node-1')

        expect(
            useCanvasStore.getState().nodes.find((node) => node.id === 'node-1'),
        ).toMatchObject({
            parentId: undefined,
            position: {
                x: (group?.position.x ?? 0) + 900,
                y: (group?.position.y ?? 0) + 400,
            },
        })
    })

    it('未分組節點拖入框內超過一半時自動加入群組', () => {
        const groupId = useCanvasStore.getState().groupSelectedNodes()
        useCanvasStore.getState().ungroupNodes(groupId!)

        const group = {
            id: 'group-target',
            type: 'group' as const,
            position: { x: 600, y: 300 },
            deletable: false,
            data: {
                title: '目標群組',
                width: 500,
                height: 320,
            },
        }
        useCanvasStore.setState((state) => ({
            nodes: [
                group,
                ...state.nodes.map((node) =>
                    node.id === 'node-1'
                        ? { ...node, position: { x: 650, y: 380 } }
                        : node,
                ),
            ],
        }))

        useCanvasStore.getState().reconcileNodeGroup('node-1')

        expect(
            useCanvasStore.getState().nodes.find((node) => node.id === 'node-1'),
        ).toMatchObject({
            parentId: 'group-target',
            position: { x: 50, y: 80 },
        })
    })

    it('未分組節點只有少於一半進入框內時不加入群組', () => {
        const group = {
            id: 'group-target',
            type: 'group' as const,
            position: { x: 600, y: 300 },
            deletable: false,
            data: {
                title: '目標群組',
                width: 500,
                height: 320,
            },
        }
        useCanvasStore.setState((state) => ({
            nodes: [
                group,
                ...state.nodes.map((node) =>
                    node.id === 'node-1'
                        ? { ...node, selected: false, position: { x: 400, y: 380 } }
                        : { ...node, selected: false },
                ),
            ],
        }))

        useCanvasStore.getState().reconcileNodeGroup('node-1')

        expect(
            useCanvasStore.getState().nodes.find((node) => node.id === 'node-1'),
        ).not.toHaveProperty('parentId')
    })

    it('解散群組時將所有成員轉回畫布座標', () => {
        const groupId = useCanvasStore.getState().groupSelectedNodes()
        useCanvasStore.getState().ungroupNodes(groupId!)

        const state = useCanvasStore.getState()
        expect(state.nodes.some((node) => node.type === 'group')).toBe(false)
        expect(state.nodes.find((node) => node.id === 'node-1')).toMatchObject({
            parentId: undefined,
            position: { x: 100, y: 100 },
        })
        expect(state.nodes.find((node) => node.id === 'node-2')).toMatchObject({
            parentId: undefined,
            position: { x: 420, y: 240 },
        })
    })

    it('自動排版時以群組內節點的對外連線排列整個群組', () => {
        const groupId = useCanvasStore.getState().groupSelectedNodes()
        const externalNode = createNode('external-node', 0, 0)

        useCanvasStore.setState((state) => ({
            nodes: [
                ...state.nodes.map((node) => ({ ...node, selected: false })),
                { ...externalNode, selected: false, parentId: undefined },
            ],
            edges: [
                {
                    id: 'external-to-group-member',
                    source: 'external-node',
                    target: 'node-1',
                    data: { origin: 'user' },
                },
            ],
        }))

        useCanvasStore.getState().autoLayout()

        const state = useCanvasStore.getState()
        const group = state.nodes.find((node) => node.id === groupId)
        const external = state.nodes.find((node) => node.id === 'external-node')

        expect(group?.position.y).toBeGreaterThan(external?.position.y ?? Infinity)
        expect(state.nodes.find((node) => node.id === 'node-1')?.parentId).toBe(
            groupId,
        )
    })
})

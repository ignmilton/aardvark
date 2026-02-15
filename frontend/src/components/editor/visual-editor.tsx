'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  MiniMap,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  ReactFlowProvider,
  ReactFlowInstance,
  BackgroundVariant,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { SegmentNode, SegmentNodeData } from './segment-node';
import { ChoiceEdge, ChoiceEdgeData } from './choice-edge';
import { EditorToolbar } from './editor-toolbar';
import { SegmentEditorModal } from './segment-editor-modal';
import { ChoiceModal } from './choice-modal';

// Custom node and edge types
const nodeTypes = {
  segment: SegmentNode,
};

const edgeTypes = {
  choice: ChoiceEdge,
};

interface StorySegment {
  id: string;
  title: string | null;
  content: string;
  contentMarkdown: string | null;
  position: { x: number; y: number };
  isRootSegment: boolean;
  isEnding: boolean;
  endingType: 'good' | 'bad' | 'neutral' | 'secret' | null;
  wordCount: number;
  // Note: stateEffects removed per design simplification
}

interface StoryChoice {
  id: string;
  segmentId: string;
  nextSegmentId: string;
  choiceText: string;
  order: number;
  // Note: conditions removed per design simplification
}

// Note: StateVariable interface removed per design simplification

interface VisualEditorProps {
  storyId: string;
  segments: StorySegment[];
  choices: StoryChoice[];
  // Note: stateVariables removed per design simplification
  onSegmentCreate: (segment: Partial<StorySegment>) => Promise<StorySegment>;
  onSegmentUpdate: (id: string, segment: Partial<StorySegment>) => Promise<void>;
  onSegmentDelete: (id: string) => Promise<void>;
  onChoiceCreate: (choice: Partial<StoryChoice>) => Promise<StoryChoice>;
  onChoiceDelete: (id: string) => Promise<void>;
  onPositionsUpdate: (positions: { segmentId: string; x: number; y: number }[]) => Promise<void>;
}

export function VisualEditor({
  storyId,
  segments: initialSegments,
  choices: initialChoices,
  onSegmentCreate,
  onSegmentUpdate,
  onSegmentDelete,
  onChoiceCreate,
  onChoiceDelete,
  onPositionsUpdate,
}: VisualEditorProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);

  // Convert segments to nodes
  const initialNodes: Node<SegmentNodeData>[] = initialSegments.map((segment) => ({
    id: segment.id,
    type: 'segment',
    position: segment.position,
    data: {
      id: segment.id,
      title: segment.title,
      content: segment.content,
      isRootSegment: segment.isRootSegment,
      isEnding: segment.isEnding,
      endingType: segment.endingType,
      wordCount: segment.wordCount,
      choiceCount: initialChoices.filter((c) => c.segmentId === segment.id).length,
      onEdit: handleEditSegment,
      onDelete: handleDeleteSegment,
    },
  }));

  // Convert choices to edges
  const initialEdges: Edge<ChoiceEdgeData>[] = initialChoices.map((choice) => ({
    id: choice.id,
    source: choice.segmentId,
    target: choice.nextSegmentId,
    type: 'choice',
    data: {
      id: choice.id,
      choiceText: choice.choiceText,
      order: choice.order,
      hasConditions: false, // Note: conditions removed per design simplification
    },
  }));

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [showMinimap, setShowMinimap] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Modal state
  const [editingSegment, setEditingSegment] = useState<Partial<StorySegment> | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Choice modal state
  const [pendingConnection, setPendingConnection] = useState<Connection | null>(null);
  const [isChoiceModalOpen, setIsChoiceModalOpen] = useState(false);

  // Handlers
  const handleEditSegment = useCallback((id: string) => {
    const segment = initialSegments.find((s) => s.id === id);
    if (segment) {
      setEditingSegment(segment);
      setIsModalOpen(true);
    }
  }, [initialSegments]);

  const handleDeleteSegment = useCallback(async (id: string) => {
    if (!confirm('Are you sure you want to delete this segment?')) return;

    try {
      await onSegmentDelete(id);
      setNodes((nds) => nds.filter((n) => n.id !== id));
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    } catch (error) {
      console.error('Failed to delete segment:', error);
    }
  }, [onSegmentDelete, setNodes, setEdges]);

  // Update nodes when segments change
  useEffect(() => {
    setNodes(
      initialSegments.map((segment) => ({
        id: segment.id,
        type: 'segment',
        position: segment.position,
        data: {
          id: segment.id,
          title: segment.title,
          content: segment.content,
          isRootSegment: segment.isRootSegment,
          isEnding: segment.isEnding,
          endingType: segment.endingType,
          wordCount: segment.wordCount,
          choiceCount: initialChoices.filter((c) => c.segmentId === segment.id).length,
          onEdit: handleEditSegment,
          onDelete: handleDeleteSegment,
        },
      }))
    );
  }, [initialSegments, initialChoices, setNodes, handleEditSegment, handleDeleteSegment]);

  // Update edges when choices change
  useEffect(() => {
    setEdges(
      initialChoices.map((choice) => ({
        id: choice.id,
        source: choice.segmentId,
        target: choice.nextSegmentId,
        type: 'choice',
        data: {
          id: choice.id,
          choiceText: choice.choiceText,
          order: choice.order,
          hasConditions: false, // Note: conditions removed per design simplification
        },
      }))
    );
  }, [initialChoices, setEdges]);

  // Handle node position changes
  const onNodeDragStop = useCallback(() => {
    setHasUnsavedChanges(true);
  }, []);

  // Handle new connections (create choice)
  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      setPendingConnection(connection);
      setIsChoiceModalOpen(true);
    },
    []
  );

  // Confirm choice creation from modal
  const handleChoiceConfirm = useCallback(
    async (choiceText: string) => {
      if (!pendingConnection?.source || !pendingConnection?.target) return;

      setIsChoiceModalOpen(false);

      try {
        const newChoice = await onChoiceCreate({
          segmentId: pendingConnection.source,
          nextSegmentId: pendingConnection.target,
          choiceText,
        });

        setEdges((eds) =>
          addEdge(
            {
              ...pendingConnection,
              id: newChoice.id,
              type: 'choice',
              data: {
                id: newChoice.id,
                choiceText: newChoice.choiceText,
                order: newChoice.order,
                hasConditions: false,
              },
            },
            eds
          )
        );
      } catch (error) {
        console.error('Failed to create choice:', error);
      } finally {
        setPendingConnection(null);
      }
    },
    [pendingConnection, onChoiceCreate, setEdges]
  );

  // Handle edge deletion
  const onEdgesDelete = useCallback(
    async (edgesToDelete: Edge[]) => {
      for (const edge of edgesToDelete) {
        try {
          await onChoiceDelete(edge.id);
        } catch (error) {
          console.error('Failed to delete choice:', error);
        }
      }
    },
    [onChoiceDelete]
  );

  const handleAddSegment = useCallback(() => {
    setEditingSegment(null);
    setIsModalOpen(true);
  }, []);

  const handleSaveSegment = useCallback(
    async (data: any) => {
      try {
        if (data.id) {
          // Update existing
          await onSegmentUpdate(data.id, data);
        } else {
          // Create new
          const position = reactFlowInstance?.project({
            x: window.innerWidth / 2,
            y: window.innerHeight / 2,
          }) || { x: 250, y: 250 };

          const newSegment = await onSegmentCreate({
            ...data,
            position,
          });

          setNodes((nds) => [
            ...nds,
            {
              id: newSegment.id,
              type: 'segment',
              position: newSegment.position,
              data: {
                id: newSegment.id,
                title: newSegment.title,
                content: newSegment.content,
                isRootSegment: newSegment.isRootSegment,
                isEnding: newSegment.isEnding,
                endingType: newSegment.endingType,
                wordCount: newSegment.wordCount,
                choiceCount: 0,
                onEdit: handleEditSegment,
                onDelete: handleDeleteSegment,
              },
            },
          ]);
        }
      } catch (error) {
        console.error('Failed to save segment:', error);
      }
    },
    [onSegmentCreate, onSegmentUpdate, reactFlowInstance, setNodes, handleEditSegment, handleDeleteSegment]
  );

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const positions = nodes.map((node) => ({
        segmentId: node.id,
        x: node.position.x,
        y: node.position.y,
      }));
      await onPositionsUpdate(positions);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Failed to save positions:', error);
    } finally {
      setIsSaving(false);
    }
  }, [nodes, onPositionsUpdate]);

  const handleZoomIn = useCallback(() => {
    reactFlowInstance?.zoomIn();
  }, [reactFlowInstance]);

  const handleZoomOut = useCallback(() => {
    reactFlowInstance?.zoomOut();
  }, [reactFlowInstance]);

  const handleFitView = useCallback(() => {
    reactFlowInstance?.fitView({ padding: 0.2 });
  }, [reactFlowInstance]);

  return (
    <div ref={reactFlowWrapper} className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgesDelete={onEdgesDelete}
        onNodeDragStop={onNodeDragStop}
        onInit={setReactFlowInstance}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        snapToGrid
        snapGrid={[15, 15]}
        defaultEdgeOptions={{
          type: 'choice',
          animated: true,
        }}
      >
        <EditorToolbar
          onAddSegment={handleAddSegment}
          onSave={handleSave}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onFitView={handleFitView}
          onToggleMinimap={() => setShowMinimap(!showMinimap)}
          showMinimap={showMinimap}
          isSaving={isSaving}
          hasUnsavedChanges={hasUnsavedChanges}
        />
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        {showMinimap && (
          <MiniMap
            nodeStrokeWidth={3}
            zoomable
            pannable
            className="!bg-background !border"
          />
        )}
        <Controls className="!bg-background !border !rounded-lg" />
      </ReactFlow>

      <SegmentEditorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveSegment}
        initialData={editingSegment ? { ...editingSegment, title: editingSegment.title ?? undefined, contentMarkdown: editingSegment.contentMarkdown ?? undefined } : undefined}
        storyId={storyId}
      />

      <ChoiceModal
        isOpen={isChoiceModalOpen}
        onClose={() => {
          setIsChoiceModalOpen(false);
          setPendingConnection(null);
        }}
        onConfirm={handleChoiceConfirm}
        sourceTitle={
          pendingConnection?.source
            ? initialSegments.find((s) => s.id === pendingConnection.source)?.title
            : null
        }
        targetTitle={
          pendingConnection?.target
            ? initialSegments.find((s) => s.id === pendingConnection.target)?.title
            : null
        }
      />
    </div>
  );
}

// Wrapper with provider
export function VisualEditorWithProvider(props: VisualEditorProps) {
  return (
    <ReactFlowProvider>
      <VisualEditor {...props} />
    </ReactFlowProvider>
  );
}

"use client";

import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useEffect, useMemo } from "react";

import type { CurriculumGraph as CurriculumGraphData } from "@/lib/curriculum/graph";
import type { CourseDerivedStatus } from "@/lib/curriculum/types";

const STATUS_STYLE: Record<CourseDerivedStatus, { background: string; border: string; color: string }> = {
  passed: { background: "#ecfdf5", border: "#34d399", color: "#065f46" },
  eligible: { background: "#ecfeff", border: "#22d3ee", color: "#155e75" },
  planned: { background: "#f5f3ff", border: "#a78bfa", color: "#5b21b6" },
  blocked: { background: "#fff7ed", border: "#fdba74", color: "#9a3412" },
  unknown: { background: "#fffbeb", border: "#fbbf24", color: "#92400e" },
};

type Props = {
  graph: CurriculumGraphData;
  statuses: Record<string, CourseDerivedStatus>;
  visibleNodeIds: Set<string>;
  focusedNodeIds?: Set<string>;
  selectedNodeId?: string;
  onSelectNode: (nodeId: string | null) => void;
};

function Flow({
  graph,
  statuses,
  visibleNodeIds,
  focusedNodeIds,
  selectedNodeId,
  onSelectNode,
}: Props) {
  const { fitView, setCenter } = useReactFlow();
  const nodes = useMemo<Node[]>(
    () =>
      graph.nodes
        .filter((node) => visibleNodeIds.has(node.id))
        .map((node) => {
          const status = statuses[node.id] ?? "unknown";
          const semantic = STATUS_STYLE[status];
          const logical = node.kind === "and" || node.kind === "or";
          const elective = node.kind === "elective-slot";
          const external = node.kind === "external";
          const semesterLabel = node.kind === "semester-label";
          const dimmed = focusedNodeIds && !focusedNodeIds.has(node.id);
          return {
            id: node.id,
            position: { x: node.x, y: node.y },
            data: { label: node.label },
            selected: !semesterLabel && selectedNodeId === node.id,
            sourcePosition: Position.Bottom,
            targetPosition: Position.Top,
            selectable: !semesterLabel,
            style: {
              width: semesterLabel ? 150 : logical ? 62 : 230,
              minHeight: semesterLabel ? 40 : logical ? 48 : 82,
              whiteSpace: "pre-line",
              borderRadius: semesterLabel ? 10 : logical ? 999 : 14,
              border: semesterLabel ? "0" : `${selectedNodeId === node.id ? 3 : 2}px solid ${
                logical ? "#64748b" : elective ? "#8b5cf6" : external ? "#64748b" : semantic.border
              }`,
              background: semesterLabel ? "#0f172a" : logical ? "#f8fafc" : elective ? "#faf5ff" : external ? "#f8fafc" : semantic.background,
              color: semesterLabel ? "#ffffff" : logical ? "#334155" : elective ? "#6b21a8" : external ? "#334155" : semantic.color,
              fontWeight: semesterLabel || logical ? 800 : 650,
              fontSize: semesterLabel ? 11 : 12,
              letterSpacing: semesterLabel ? ".12em" : undefined,
              lineHeight: 1.35,
              padding: semesterLabel ? 12 : logical ? 8 : 12,
              opacity: semesterLabel ? 1 : dimmed ? 0.22 : 1,
              boxShadow: semesterLabel ? "0 8px 20px rgba(15,23,42,.18)" : selectedNodeId === node.id ? "0 0 0 4px rgba(37,99,235,.16)" : "0 6px 18px rgba(15,23,42,.07)",
            },
            ariaLabel: `${node.label.replace("\n", ", ")}${node.courseCode ? `, ${status}` : ""}`,
          };
        }),
    [focusedNodeIds, graph.nodes, selectedNodeId, statuses, visibleNodeIds],
  );
  const visibleIds = useMemo(() => new Set(nodes.map((node) => node.id)), [nodes]);
  const edges = useMemo<Edge[]>(
    () =>
      graph.edges
        .filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target))
        .map((edge) => {
          const dimmed = focusedNodeIds &&
            (!focusedNodeIds.has(edge.source) || !focusedNodeIds.has(edge.target));
          const alternative = edge.relationship === "alternative";
          return {
            id: edge.id,
            source: edge.source,
            target: edge.target,
            type: "default",
            animated: selectedNodeId ? !dimmed : false,
            style: {
              stroke: alternative ? "#7c3aed" : "#64748b",
              strokeWidth: 2,
              strokeDasharray: alternative ? "6 5" : undefined,
              opacity: dimmed ? 0.12 : 0.75,
            },
            markerEnd: { type: MarkerType.ArrowClosed, color: alternative ? "#7c3aed" : "#64748b" },
          };
        }),
    [focusedNodeIds, graph.edges, selectedNodeId, visibleIds],
  );

  useEffect(() => {
    if (!selectedNodeId) return;
    const node = graph.nodes.find((candidate) => candidate.id === selectedNodeId);
    if (node) void setCenter(node.x + 115, node.y + 40, { zoom: 1.15, duration: 450 });
  }, [graph.nodes, selectedNodeId, setCenter]);

  return (
    <div className="relative h-[72vh] min-h-[620px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-50" aria-label="Interactive prerequisite graph">
      <div className="absolute left-3 top-3 z-10 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm">
        Drag to explore · scroll to zoom
      </div>
      <button
        type="button"
        onClick={() => void fitView({ padding: 0.14, duration: 450 })}
        className="absolute right-3 top-3 z-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50"
      >
        Fit all
      </button>
      <ReactFlow
        key={graph.nodes.find((node) => node.kind === "course")?.id ?? "curriculum"}
        nodes={nodes}
        edges={edges}
        defaultViewport={{ x: 190, y: 60, zoom: 0.72 }}
        minZoom={0.2}
        maxZoom={1.8}
        nodesDraggable={false}
        onNodeClick={(_, node) => {
          if (!node.id.startsWith("semester:")) onSelectNode(node.id);
        }}
        onPaneClick={() => onSelectNode(null)}
      >
        <Background color="#cbd5e1" gap={24} size={1} />
        <Controls position="bottom-left" />
        <MiniMap pannable zoomable position="bottom-right" nodeStrokeWidth={2} />
      </ReactFlow>
    </div>
  );
}

export default function CurriculumGraph(props: Props) {
  return (
    <ReactFlowProvider>
      <Flow {...props} />
    </ReactFlowProvider>
  );
}

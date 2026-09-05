"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";

import {
  getVisibleCourseConnections,
  type CurriculumCourseConnection,
  type CurriculumGraph as CurriculumGraphData,
} from "@/lib/curriculum/graph";
import type { CourseDerivedStatus } from "@/lib/curriculum/types";
import type { ItuPlanType } from "@/lib/itu/curriculum/types";
import { useLanguage } from "@/lib/i18n/client";
import { localizedCurriculumSection } from "@/lib/i18n";

const STATUS_STYLE: Record<CourseDerivedStatus, string> = {
  "not-taken": "border-slate-500 bg-slate-200/80 text-black hover:bg-slate-300/85",
  passed: "border-emerald-700 bg-emerald-200/80 text-emerald-950 hover:bg-emerald-300/85",
  failed: "border-red-700 bg-red-200/80 text-red-950 hover:bg-red-300/85",
};

type Props = {
  graph: CurriculumGraphData;
  statuses: Record<string, CourseDerivedStatus>;
  visibleNodeIds: Set<string>;
  selectedNodeId?: string;
  prerequisiteNodeIds?: Set<string>;
  dependentNodeIds?: Set<string>;
  takeableNodeIds?: Set<string>;
  onSelectNode: (nodeId: string | null) => void;
  planType?: ItuPlanType;
};

type Curve = CurriculumCourseConnection & {
  path: string;
  highlighted: boolean;
};

export default function CurriculumGraph({
  graph,
  statuses,
  visibleNodeIds,
  selectedNodeId,
  prerequisiteNodeIds,
  dependentNodeIds,
  takeableNodeIds,
  onSelectNode,
  planType,
}: Props) {
  const { language, t } = useLanguage();
  const statusLabel = (status: CourseDerivedStatus) => t(status === "not-taken" ? "curriculum.notTaken" : status === "passed" ? "curriculum.passed" : "curriculum.failed");
  const boardRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<string, HTMLButtonElement>());
  const [curves, setCurves] = useState<Curve[]>([]);
  const [boardSize, setBoardSize] = useState({ width: 0, height: 0 });

  const semesters = useMemo(() => {
    const semesterNumbers = [
      ...new Set(
        graph.nodes
          .filter((node) => node.semester !== undefined)
          .map((node) => node.semester as number),
      ),
    ].sort((first, second) => first - second);

    return semesterNumbers.map((semester) => {
      const semesterNodes = graph.nodes.filter(
        (node) =>
          node.semester === semester &&
          (node.kind === "course" || node.kind === "elective-slot"),
      );

      return {
        semester,
        columnCount: semesterNodes.length,
        nodes: semesterNodes.filter((node) => visibleNodeIds.has(node.id)),
      };
    });
  }, [graph.nodes, visibleNodeIds]);

  const connections = useMemo(
    () => getVisibleCourseConnections(graph, visibleNodeIds),
    [graph, visibleNodeIds],
  );

  useLayoutEffect(() => {
    const board = boardRef.current;
    if (!board) return;

    function measure() {
      const currentBoard = boardRef.current;
      if (!currentBoard) return;
      const boardRect = currentBoard.getBoundingClientRect();
      const nextCurves = connections.flatMap((connection): Curve[] => {
        const source = cardRefs.current.get(connection.source);
        const target = cardRefs.current.get(connection.target);
        if (!source || !target) return [];

        const sourceRect = source.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const sameRow = Math.abs(sourceRect.top - targetRect.top) < 8;
        const sourceBeforeTarget = sourceRect.left < targetRect.left;
        const sourceX = sameRow ? (sourceBeforeTarget ? sourceRect.right : sourceRect.left) - boardRect.left : sourceRect.left - boardRect.left + sourceRect.width / 2;
        const sourceY = sameRow ? sourceRect.top - boardRect.top + sourceRect.height / 2 : sourceRect.bottom - boardRect.top - 2;
        const targetX = sameRow ? (sourceBeforeTarget ? targetRect.left : targetRect.right) - boardRect.left : targetRect.left - boardRect.left + targetRect.width / 2;
        const targetY = sameRow ? targetRect.top - boardRect.top + targetRect.height / 2 : targetRect.top - boardRect.top + 2;
        const distance = Math.max(64, Math.abs(targetY - sourceY) * 0.48);
        const midpointX = (sourceX + targetX) / 2;

        return [{
          ...connection,
          path: sameRow
            ? `M ${sourceX} ${sourceY} C ${midpointX} ${sourceY - 76}, ${midpointX} ${targetY - 76}, ${targetX} ${targetY}`
            : `M ${sourceX} ${sourceY} C ${sourceX} ${sourceY + distance}, ${targetX} ${targetY - distance}, ${targetX} ${targetY}`,
          highlighted:
            Boolean(selectedNodeId) && (
              connection.source === selectedNodeId ||
              connection.target === selectedNodeId ||
              (Boolean(prerequisiteNodeIds?.has(connection.source)) &&
                Boolean(prerequisiteNodeIds?.has(connection.target))) ||
              (Boolean(dependentNodeIds?.has(connection.source)) &&
                Boolean(dependentNodeIds?.has(connection.target)))
            ),
        }];
      });

      setBoardSize({
        width: currentBoard.scrollWidth,
        height: currentBoard.scrollHeight,
      });
      setCurves(nextCurves);
    }

    const frame = requestAnimationFrame(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(board);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [connections, dependentNodeIds, prerequisiteNodeIds, selectedNodeId]);

  return (
    <div className="w-full overflow-hidden pb-2" aria-label={t("curriculum.graphLabel")}>
      <div
        ref={boardRef}
        className="relative space-y-8 py-1"
      >
        <svg
          className="pointer-events-none absolute left-0 top-0 z-10 overflow-visible"
          width={boardSize.width}
          height={boardSize.height}
          viewBox={`0 0 ${boardSize.width} ${boardSize.height}`}
          fill="none"
          aria-hidden="true"
        >
          <defs>
            <marker id="curriculum-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L0,6 L7,3 z" fill="#64748b" />
            </marker>
          </defs>
          {curves.map((curve) => (
            <g key={curve.id}>
              <path
                d={curve.path}
                stroke="rgba(255,255,255,.92)"
                strokeWidth={curve.highlighted ? 7 : 5}
                strokeLinecap="round"
              />
              <path
                d={curve.path}
                stroke={curve.highlighted ? "#1d4ed8" : "#64748b"}
                strokeWidth={curve.highlighted ? 3.5 : 2.25}
                strokeLinecap="round"
                opacity={curve.highlighted ? 1 : 0.78}
                markerEnd="url(#curriculum-arrow)"
              />
            </g>
          ))}
        </svg>

        {semesters.map(({ semester, columnCount, nodes }) => (
          <section
            key={semester}
            className="relative min-h-[184px] rounded-[28px] bg-slate-100 px-3 pb-4 pt-10 sm:px-4"
            aria-labelledby={`semester-heading-${semester}`}
          >
            <h3
              id={`semester-heading-${semester}`}
              className="absolute left-4 top-3 z-20 text-[10px] font-black uppercase tracking-[.16em] text-slate-600 sm:left-5 sm:text-xs"
            >
              {localizedCurriculumSection(language, planType, semester)}
            </h3>
            {nodes.length ? (
              <div
                className="flex items-stretch justify-center gap-2"
              >
                {nodes.map((node) => {
                  const status = statuses[node.id] ?? "not-taken";
                  const elective = node.kind === "elective-slot";
                  const prerequisiteRelated = prerequisiteNodeIds?.has(node.id);
                  const dependentRelated = dependentNodeIds?.has(node.id);
                  const [code, ...titleParts] = node.label.split("\n");
                  const title = titleParts.join(" ") || code;
                  const cardWidth = `calc(${100 / columnCount}% - ${((columnCount - 1) * 8) / columnCount}px)`;

                  return (
                    <button
                      key={node.id}
                      ref={(element) => {
                        if (element) cardRefs.current.set(node.id, element);
                        else cardRefs.current.delete(node.id);
                      }}
                      type="button"
                      onClick={() => onSelectNode(node.id)}
                      aria-pressed={selectedNodeId === node.id}
                      style={{ flexBasis: cardWidth, maxWidth: cardWidth }}
                      className={`relative z-20 flex min-h-[136px] min-w-0 shrink-0 flex-col items-center justify-center rounded-[20px] border-2 p-2 text-center shadow-sm transition focus:outline-none focus:ring-4 focus:ring-blue-300 sm:min-h-[144px] sm:p-3 ${
                        elective && status === "not-taken"
                          ? "border-dashed border-violet-600 bg-violet-100/80 text-violet-950 hover:bg-violet-200/85"
                          : STATUS_STYLE[status]
                      } ${
                        selectedNodeId === node.id
                          ? "ring-4 ring-blue-500"
                          : prerequisiteRelated
                            ? "ring-2 ring-amber-500 ring-offset-1"
                            : dependentRelated
                              ? "ring-2 ring-sky-500 ring-offset-1"
                              : ""
                      }`}
                    >
                      <span className="max-w-full break-words text-[11px] font-black leading-tight sm:text-xs lg:text-sm">
                        {elective ? title : code}
                      </span>
                      {!elective && (
                        <p className="mt-2 max-w-full break-words text-[10px] font-bold leading-snug sm:text-[11px] lg:text-xs">{title}</p>
                      )}
                      <span className="mt-2 max-w-full rounded-full border border-current bg-white/75 px-1.5 py-0.5 text-[7px] font-black uppercase tracking-wide sm:mt-3 sm:px-2 sm:text-[8px]">
                        {elective && status === "not-taken" ? t("curriculum.electiveRequirement") : statusLabel(status)}
                      </span>
                      {takeableNodeIds?.has(node.id) && (
                        <span className="absolute -right-1 -top-2 rounded-full bg-blue-700 px-2 py-1 text-[7px] font-black uppercase tracking-wide text-white shadow-md sm:text-[8px]">
                          {t("curriculum.available")}
                        </span>
                      )}
                      {node.externalPrerequisiteCodes?.length ? (
                        <span className="mt-2 rounded-full bg-amber-950 px-2 py-1 text-[8px] font-black uppercase tracking-wide text-amber-100" title={t("curriculum.externalCodes", { codes: node.externalPrerequisiteCodes.join(", ") })}>
                          {t("curriculum.externalPrerequisite")}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="relative z-20 py-12 text-sm font-semibold text-slate-500">
                {t("curriculum.noFilterMatches")}
              </p>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useMemo, type CSSProperties } from "react";

import type { CurriculumGraph as CurriculumGraphData } from "@/lib/curriculum/graph";
import type { CourseDerivedStatus } from "@/lib/curriculum/types";
import type { RequirementProgress } from "@/lib/curriculum/graduation";
import type { ItuPlanType } from "@/lib/itu/curriculum/types";
import { useLanguage } from "@/lib/i18n/client";
import { localizedAcademicName, localizedCurriculumSection } from "@/lib/i18n";

const STATUS_STYLE: Record<CourseDerivedStatus, string> = {
  "not-taken":
    "border-slate-500 bg-slate-200/80 text-black hover:bg-slate-300/85",
  passed:
    "border-emerald-700 bg-emerald-200/80 text-emerald-950 hover:bg-emerald-300/85",
  failed: "border-red-700 bg-red-200/80 text-red-950 hover:bg-red-300/85",
};

type Props = {
  graph: CurriculumGraphData;
  statuses: Record<string, CourseDerivedStatus>;
  completions: Record<string, RequirementProgress | null>;
  visibleNodeIds: Set<string>;
  selectedNodeId?: string;
  selectedDetailsId?: string;
  prerequisiteNodeIds?: Set<string>;
  dependentNodeIds?: Set<string>;
  takeableNodeIds?: Set<string>;
  onSelectNode: (nodeId: string | null) => void;
  planType?: ItuPlanType;
};

export default function CurriculumGraph({
  graph,
  statuses,
  completions,
  visibleNodeIds,
  selectedNodeId,
  selectedDetailsId,
  prerequisiteNodeIds,
  dependentNodeIds,
  takeableNodeIds,
  onSelectNode,
  planType,
}: Props) {
  const { language, t } = useLanguage();
  const showSectionHeadings = !planType || planType === "undergraduate";
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

  return (
    <div
      className="w-full overflow-hidden pb-2"
      aria-label={t("curriculum.graphLabel")}
    >
      <div className="relative space-y-8 py-1">
        {semesters.map(({ semester, columnCount, nodes }) => (
          <section
            key={semester}
            className={`relative min-h-[184px] rounded-xl bg-slate-50 px-3 pb-4 sm:px-4 ${showSectionHeadings ? "pt-10" : "pt-4"}`}
            aria-labelledby={`semester-heading-${semester}`}
          >
            <h3
              id={`semester-heading-${semester}`}
              className={showSectionHeadings ? "absolute left-4 top-3 z-20 text-[10px] font-semibold uppercase tracking-[.16em] text-slate-600 sm:left-5 sm:text-xs" : "sr-only"}
            >
              {localizedCurriculumSection(language, planType, semester)}
            </h3>
            {nodes.length ? (
              <div className="flex flex-wrap items-stretch justify-center gap-2">
                {nodes.map((node) => {
                  const status = statuses[node.id] ?? "not-taken";
                  const elective = node.kind === "elective-slot";
                  const completion = completions[node.id];
                  const completedElective = elective && status === "passed" && completion;
                  const grade = status !== "not-taken" ? completion?.course.grade : undefined;
                  const prerequisiteRelated = prerequisiteNodeIds?.has(node.id);
                  const dependentRelated = dependentNodeIds?.has(node.id);
                  const [code, ...titleParts] = node.label.split("\n");
                  const title = localizedAcademicName(
                    {
                      name: titleParts.join(" ") || code,
                      nameTr: node.nameTr,
                      nameEn: node.nameEn,
                    },
                    language,
                  );
                  const cardWidth = `calc(${100 / columnCount}% - ${((columnCount - 1) * 8) / columnCount}px)`;

                  return (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => onSelectNode(node.id)}
                      aria-pressed={selectedNodeId === node.id}
                      aria-controls={selectedNodeId === node.id ? selectedDetailsId : undefined}
                      style={
                        {
                          "--course-width": `max(140px, ${cardWidth})`,
                        } as CSSProperties
                      }
                      className={`relative z-20 flex basis-[calc(50%-4px)] max-w-[calc(50%-4px)] sm:basis-[var(--course-width)] sm:max-w-[var(--course-width)] min-h-[136px] min-w-0 shrink-0 flex-col items-center justify-center rounded-lg border p-2 text-center shadow-sm transition focus:outline-none focus:ring-4 focus:ring-blue-300 sm:min-h-[144px] sm:p-3 ${
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
                      <span className="max-w-full break-words text-[11px] font-semibold leading-tight sm:text-xs lg:text-sm">
                        {completedElective ? completion.code : elective ? title : code}
                      </span>
                      {(!elective || completedElective) && (
                        <p className="mt-2 max-w-full break-words text-xs font-medium leading-snug">
                          {completedElective ? completion.name : title}
                        </p>
                      )}
                      {grade && (
                        <span className="mt-2 max-w-full text-xs font-medium">
                          {grade}
                        </span>
                      )}
                      {takeableNodeIds?.has(node.id) && (
                        <span className="absolute -right-1 -top-2 rounded-full bg-blue-700 px-2 py-1 text-xs font-semibold text-white shadow-sm">
                          {t("curriculum.available")}
                        </span>
                      )}
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

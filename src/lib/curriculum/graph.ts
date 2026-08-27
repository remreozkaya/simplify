import type {
  ItuCurriculum,
  ItuCurriculumCourse,
  PrerequisiteExpression,
} from "@/lib/itu/curriculum/types";

export type CurriculumGraphNode = {
  id: string;
  kind: "course" | "elective-slot" | "external" | "and" | "or" | "semester-label";
  label: string;
  courseCode?: string;
  semester?: number;
  x: number;
  y: number;
};

export type CurriculumGraphEdge = {
  id: string;
  source: string;
  target: string;
  relationship: "required" | "alternative" | "logical";
};

export type CurriculumGraph = {
  nodes: CurriculumGraphNode[];
  edges: CurriculumGraphEdge[];
};

export function buildCurriculumGraph(curriculum: ItuCurriculum): CurriculumGraph {
  const nodes: CurriculumGraphNode[] = [];
  const edges: CurriculumGraphEdge[] = [];
  const courseNodeByCode = new Map<string, string>();

  const semesterGap = 230;
  const courseGap = 270;

  curriculum.semesters.forEach((semester) => {
    const semesterY = (semester.semester - 1) * semesterGap;
    nodes.push({
      id: `semester:${semester.semester}`,
      kind: "semester-label",
      label: `SEMESTER ${semester.semester}`,
      semester: semester.semester,
      x: -180,
      y: semesterY + 24,
    });
    semester.items.forEach((item, row) => {
      nodes.push({
        id: item.id,
        kind: item.kind,
        label: item.kind === "course" ? `${item.code}\n${item.title}` : item.title,
        ...(item.kind === "course" ? { courseCode: item.code } : {}),
        semester: semester.semester,
        x: row * courseGap,
        y: semesterY,
      });
      if (item.kind === "course" && !courseNodeByCode.has(item.code)) {
        courseNodeByCode.set(item.code, item.id);
      }
    });
  });

  function connectExpression(
    expression: PrerequisiteExpression,
    targetId: string,
    path: string,
    targetNode: CurriculumGraphNode,
  ): string | null {
    if (expression.kind === "unknown") return null;
    if (expression.kind === "course") {
      return courseNodeByCode.get(expression.courseCode) ?? null;
    }
    const logicId = `logic:${targetId}:${path}:${expression.kind}`;
    const logicNode: CurriculumGraphNode = {
      id: logicId,
      kind: expression.kind,
      label: expression.kind.toUpperCase(),
      x: targetNode.x + 84 + Number(path.split(".").at(-1) ?? 0) * 44,
      y: targetNode.y - 76 - (path.split(".").length - 1) * 42,
    };
    const sources = expression.operands.flatMap((operand, index) => {
      const sourceId = connectExpression(
        operand,
        logicId,
        `${path}.${index}`,
        logicNode,
      );
      return sourceId ? [sourceId] : [];
    });

    if (sources.length === 0) return null;
    if (sources.length === 1) return sources[0];

    nodes.push(logicNode);
    sources.forEach((source) => {
      edges.push({
        id: `edge:${source}:${logicId}`,
        source,
        target: logicId,
        relationship: expression.kind === "or" ? "alternative" : "required",
      });
    });
    return logicId;
  }

  Object.values(curriculum.prerequisites).forEach((prerequisite) => {
    const targetId = courseNodeByCode.get(prerequisite.courseCode);
    const targetNode = nodes.find((node) => node.id === targetId);
    if (!targetId || !targetNode || !prerequisite.expression) return;
    const source = connectExpression(prerequisite.expression, targetId, "0", targetNode);
    if (source) {
      edges.push({
        id: `edge:${source}:${targetId}`,
        source,
        target: targetId,
        relationship:
          prerequisite.expression.kind === "or" ? "alternative" : "logical",
      });
    }
  });

  return { nodes, edges };
}

function traverse(startId: string, edges: CurriculumGraphEdge[], direction: "up" | "down") {
  const visited = new Set<string>([startId]);
  const queue = [startId];
  while (queue.length) {
    const current = queue.shift()!;
    edges.forEach((edge) => {
      const next = direction === "up"
        ? edge.target === current ? edge.source : undefined
        : edge.source === current ? edge.target : undefined;
      if (next && !visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    });
  }
  return visited;
}

export function getAncestorNodeIds(graph: CurriculumGraph, nodeId: string): Set<string> {
  return traverse(nodeId, graph.edges, "up");
}

export function getDependentNodeIds(graph: CurriculumGraph, nodeId: string): Set<string> {
  return traverse(nodeId, graph.edges, "down");
}

export function getCourseByCode(
  curriculum: ItuCurriculum,
  code: string,
): ItuCurriculumCourse | undefined {
  for (const semester of curriculum.semesters) {
    const course = semester.items.find(
      (item): item is ItuCurriculumCourse => item.kind === "course" && item.code === code,
    );
    if (course) return course;
  }
}

import type {
  ItuCurriculum,
  PrerequisiteExpression,
} from "@/lib/itu/curriculum/types";

type CurriculumGraphNode = {
  id: string;
  kind: "course" | "elective-slot" | "external" | "and" | "semester-label" | "semester-band";
  label: string;
  courseCode?: string;
  semester?: number;
  x: number;
  y: number;
};

type CurriculumGraphEdge = {
  id: string;
  source: string;
  target: string;
  relationship: "required" | "logical";
};

export type CurriculumGraph = {
  nodes: CurriculumGraphNode[];
  edges: CurriculumGraphEdge[];
};

export type CurriculumCourseConnection = {
  id: string;
  source: string;
  target: string;
};

export function buildCurriculumGraph(curriculum: ItuCurriculum): CurriculumGraph {
  const nodes: CurriculumGraphNode[] = [];
  const edges: CurriculumGraphEdge[] = [];
  const courseNodeByCode = new Map<string, string>();

  const semesterGap = 230;
  const courseGap = 270;
  const courseWidth = 230;
  const maxItems = Math.max(
    1,
    ...curriculum.semesters.map((semester) => semester.items.length),
  );
  const graphWidth = (maxItems - 1) * courseGap + courseWidth;

  curriculum.semesters.forEach((semester) => {
    const semesterY = (semester.semester - 1) * semesterGap;
    const rowStartX = ((maxItems - semester.items.length) * courseGap) / 2;
    nodes.push({
      id: `semester-band:${semester.semester}`,
      kind: "semester-band",
      label: "",
      semester: semester.semester,
      x: -50,
      y: semesterY,
    });
    nodes.push({
      id: `semester:${semester.semester}`,
      kind: "semester-label",
      label: `SEMESTER ${semester.semester}`,
      semester: semester.semester,
      x: graphWidth / 2 - 75,
      y: semesterY + 12,
    });
    semester.items.forEach((item, row) => {
      nodes.push({
        id: item.id,
        kind: item.kind,
        label: item.kind === "course" ? `${item.code}\n${item.title}` : item.title,
        ...(item.kind === "course" ? { courseCode: item.code } : {}),
        semester: semester.semester,
        x: rowStartX + row * courseGap,
        y: semesterY + 64,
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
  ): string[] {
    if (expression.kind === "unknown") return [];
    if (expression.kind === "course") {
      const courseId = courseNodeByCode.get(expression.courseCode);
      return courseId ? [courseId] : [];
    }

    const sources = [
      ...new Set(
        expression.operands.flatMap((operand, index) =>
          connectExpression(operand, targetId, `${path}.${index}`, targetNode),
        ),
      ),
    ];

    if (expression.kind === "or" || sources.length <= 1) return sources;

    const logicId = `logic:${targetId}:${path}:${expression.kind}`;
    const logicNode: CurriculumGraphNode = {
      id: logicId,
      kind: expression.kind,
      label: expression.kind.toUpperCase(),
      x: targetNode.x + 84 + Number(path.split(".").at(-1) ?? 0) * 44,
      y: targetNode.y - 58 - (path.split(".").length - 1) * 42,
    };

    nodes.push(logicNode);
    sources.forEach((source) => {
      edges.push({
        id: `edge:${source}:${logicId}`,
        source,
        target: logicId,
        relationship: "required",
      });
    });
    return [logicId];
  }

  Object.values(curriculum.prerequisites).forEach((prerequisite) => {
    const targetId = courseNodeByCode.get(prerequisite.courseCode);
    const targetNode = nodes.find((node) => node.id === targetId);
    if (!targetId || !targetNode || !prerequisite.expression) return;
    const expression = prerequisite.expression;
    const sources = connectExpression(expression, targetId, "0", targetNode);
    sources.forEach((source) => {
      edges.push({
        id: `edge:${source}:${targetId}`,
        source,
        target: targetId,
        relationship: expression.kind === "course" ? "required" : "logical",
      });
    });
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

export function getVisibleCourseConnections(
  graph: CurriculumGraph,
  visibleNodeIds: ReadonlySet<string>,
): CurriculumCourseConnection[] {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const incoming = new Map<string, string[]>();
  graph.edges.forEach((edge) => {
    incoming.set(edge.target, [...(incoming.get(edge.target) ?? []), edge.source]);
  });

  function findCourseSources(nodeId: string, visited = new Set<string>()): string[] {
    if (visited.has(nodeId)) return [];
    visited.add(nodeId);

    return (incoming.get(nodeId) ?? []).flatMap((sourceId) => {
      const source = nodeById.get(sourceId);
      if (!source) return [];
      if (source.kind === "course" && visibleNodeIds.has(sourceId)) return [sourceId];
      if (source.kind === "and") return findCourseSources(sourceId, visited);
      return [];
    });
  }

  return graph.nodes
    .filter((node) => node.kind === "course" && visibleNodeIds.has(node.id))
    .flatMap((target) =>
      [...new Set(findCourseSources(target.id))].map((source) => ({
        id: `curve:${source}:${target.id}`,
        source,
        target: target.id,
      })),
    );
}

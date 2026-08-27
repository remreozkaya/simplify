import type {
  ItuCurriculum,
  ItuCurriculumCourse,
  PrerequisiteExpression,
} from "@/lib/itu/curriculum/types";

export type CurriculumGraphNode = {
  id: string;
  kind: "course" | "elective-slot" | "external" | "and" | "or";
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
  let externalIndex = 0;

  curriculum.semesters.forEach((semester) => {
    semester.items.forEach((item, row) => {
      nodes.push({
        id: item.id,
        kind: item.kind,
        label: item.kind === "course" ? `${item.code}\n${item.title}` : item.title,
        ...(item.kind === "course" ? { courseCode: item.code } : {}),
        semester: semester.semester,
        x: (semester.semester - 1) * 310,
        y: row * 150,
      });
      if (item.kind === "course" && !courseNodeByCode.has(item.code)) {
        courseNodeByCode.set(item.code, item.id);
      }
    });
  });

  function courseNodeId(code: string): string {
    const existing = courseNodeByCode.get(code);
    if (existing) return existing;
    const id = `external:${code.replace(/\s+/g, "-")}`;
    if (!nodes.some((node) => node.id === id)) {
      nodes.push({
        id,
        kind: "external",
        label: `${code}\nExternal prerequisite`,
        courseCode: code,
        x: -310,
        y: externalIndex * 130,
      });
      externalIndex += 1;
    }
    return id;
  }

  function connectExpression(
    expression: PrerequisiteExpression,
    targetId: string,
    path: string,
    targetNode: CurriculumGraphNode,
  ): string | null {
    if (expression.kind === "unknown") return null;
    if (expression.kind === "course") return courseNodeId(expression.courseCode);
    const logicId = `logic:${targetId}:${path}:${expression.kind}`;
    nodes.push({
      id: logicId,
      kind: expression.kind,
      label: expression.kind.toUpperCase(),
      x: targetNode.x - 130 - path.split(".").length * 45,
      y: targetNode.y + Number(path.split(".").at(-1) ?? 0) * 34,
    });
    expression.operands.forEach((operand, index) => {
      const source = connectExpression(
        operand,
        logicId,
        `${path}.${index}`,
        nodes.find((node) => node.id === logicId)!,
      );
      if (source) {
        edges.push({
          id: `edge:${source}:${logicId}`,
          source,
          target: logicId,
          relationship: expression.kind === "or" ? "alternative" : "required",
        });
      }
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

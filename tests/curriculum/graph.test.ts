import { describe, expect, it } from "vitest";

import {
  buildCurriculumGraph,
  getAncestorNodeIds,
  getDependentNodeIds,
  getVisibleCourseConnections,
} from "@/lib/curriculum/graph";
import { parsePrerequisiteExpression } from "@/lib/itu/curriculum/prerequisiteExpression";
import type { ItuCurriculum } from "@/lib/itu/curriculum/types";

const curriculum: ItuCurriculum = {
  planId: 1,
  programCode: "TEST_LS",
  title: "Test",
  planTitle: "Current",
  semesters: [
    {
      semester: 1,
      items: [
        {
          kind: "course",
          id: "course:a",
          semester: 1,
          code: "MAT 103E",
          title: "Math",
          requirementType: "compulsory",
          creditOptions: [4],
          ectsOptions: [6],
        },
      ],
    },
    {
      semester: 2,
      items: [
        {
          kind: "course",
          id: "course:b",
          semester: 2,
          code: "BLG 102E",
          title: "Programming",
          requirementType: "compulsory",
          creditOptions: [4],
          ectsOptions: [8],
        },
        {
          kind: "elective-slot",
          id: "slot:1",
          semester: 2,
          title: "TM Elective I",
          creditOptions: [3],
          ectsOptions: [4, 5],
          groupId: 9,
          courses: [],
        },
      ],
    },
    {
      semester: 3,
      items: [
        {
          kind: "course",
          id: "course:c",
          semester: 3,
          code: "BBF 201E",
          title: "Advanced",
          requirementType: "compulsory",
          creditOptions: [3],
          ectsOptions: [5],
        },
      ],
    },
  ],
  prerequisites: {
    "BLG 102E": {
      courseCode: "BLG 102E",
      expression: parsePrerequisiteExpression("MAT 103E OR MAT 103"),
    },
    "BBF 201E": {
      courseCode: "BBF 201E",
      expression: parsePrerequisiteExpression("BLG 102E AND FIZ 101E"),
    },
  },
  prerequisiteBranchesLoaded: ["BLG", "BBF"],
  prerequisiteDataAvailable: true,
  warnings: [],
  fetchedAt: "2026-08-27T00:00:00.000Z",
};

describe("curriculum graph", () => {
  it("builds deterministic semester and elective nodes without external clutter", () => {
    const graph = buildCurriculumGraph(curriculum);
    expect(graph.nodes.find((node) => node.id === "course:a")?.y).toBe(64);
    expect(graph.nodes.find((node) => node.id === "course:a")?.x).toBe(135);
    expect(graph.nodes.find((node) => node.id === "course:b")?.y).toBe(294);
    expect(graph.nodes.find((node) => node.id === "slot:1")?.x).toBe(270);
    expect(graph.nodes.filter((node) => node.kind === "semester-label")).toHaveLength(3);
    expect(graph.nodes.filter((node) => node.kind === "semester-band")).toHaveLength(3);
    expect(graph.nodes.some((node) => node.id.includes(":or"))).toBe(false);
    expect(graph.nodes.some((node) => node.kind === "external")).toBe(false);
    expect(graph.nodes.some((node) => node.kind === "elective-slot")).toBe(true);
  });

  it("traverses ancestors and dependents without looping on cycles", () => {
    const graph = buildCurriculumGraph(curriculum);
    expect(getAncestorNodeIds(graph, "course:c").has("course:a")).toBe(true);
    expect(getDependentNodeIds(graph, "course:a").has("course:c")).toBe(true);
    graph.edges.push({ id: "cycle", source: "course:c", target: "course:a", relationship: "required" });
    expect(getAncestorNodeIds(graph, "course:c").size).toBeLessThanOrEqual(graph.nodes.length);
  });

  it("resolves the prerequisite relationships used by the visible curve layer", () => {
    const graph = buildCurriculumGraph(curriculum);
    const allCourses = new Set(["course:a", "course:b", "course:c"]);

    expect(getVisibleCourseConnections(graph, allCourses)).toEqual([
      { id: "curve:course:a:course:b", source: "course:a", target: "course:b" },
      { id: "curve:course:b:course:c", source: "course:b", target: "course:c" },
    ]);
    expect(getVisibleCourseConnections(graph, new Set(["course:a", "course:c"]))).toEqual([]);
  });
});

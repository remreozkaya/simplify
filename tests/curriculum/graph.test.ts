import { describe, expect, it } from "vitest";

import {
  buildCurriculumGraph,
  getAncestorNodeIds,
  getDependentNodeIds,
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
  it("builds deterministic semester, logical, elective, and external nodes", () => {
    const graph = buildCurriculumGraph(curriculum);
    expect(graph.nodes.find((node) => node.id === "course:a")?.x).toBe(0);
    expect(graph.nodes.find((node) => node.id === "course:b")?.x).toBe(310);
    expect(graph.nodes.some((node) => node.kind === "and")).toBe(true);
    expect(graph.nodes.some((node) => node.kind === "or")).toBe(true);
    expect(graph.edges.some((edge) => edge.relationship === "alternative")).toBe(true);
    expect(graph.nodes.some((node) => node.kind === "external" && node.courseCode === "FIZ 101E")).toBe(true);
    expect(graph.nodes.some((node) => node.kind === "elective-slot")).toBe(true);
  });

  it("traverses ancestors and dependents without looping on cycles", () => {
    const graph = buildCurriculumGraph(curriculum);
    expect(getAncestorNodeIds(graph, "course:c").has("course:a")).toBe(true);
    expect(getDependentNodeIds(graph, "course:a").has("course:c")).toBe(true);
    graph.edges.push({ id: "cycle", source: "course:c", target: "course:a", relationship: "required" });
    expect(getAncestorNodeIds(graph, "course:c").size).toBeLessThanOrEqual(graph.nodes.length);
  });
});

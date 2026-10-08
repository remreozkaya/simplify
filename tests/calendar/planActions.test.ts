import { afterEach, describe, expect, it, vi } from "vitest";
import { getLocalCreditTotal, createCrnBookmarklet } from "@/lib/calendar/planActions";
import { buildLocalCreditIndex } from "@/lib/itu/curriculum/localCredits";
import type { CourseSelection, FacultyOption } from "@/types/calendar";

const selection = (courseId: string, sectionId = `${courseId}:section`): CourseSelection => ({
  id: courseId, facultyCode: "MAT", courseId, sectionId, courseBlockIds: ["lecture", "lab"],
});
const catalog: FacultyOption[] = [{ facultyCode: "MAT", courses: [
  { id: "a", code: "MAT 101", title: "A", localCredits: 3.5, sections: [{ id: "a:section", crn: "00123", meetings: [] }] },
  { id: "b", code: "MAT 102", title: "B", localCredits: 2, sections: [{ id: "b:section", crn: "98765", meetings: [] }] },
  { id: "c", code: "MAT 103", title: "C", sections: [{ id: "c:section", crn: "", meetings: [] }] },
] }];

afterEach(() => { vi.useRealTimers(); });

describe("selected plan local credits", () => {
  it("counts each course once, independently of meeting blocks or sections", () => {
    expect(getLocalCreditTotal([selection("a"), selection("b"), selection("a")], catalog)).toBe(5.5);
  });
  it("updates for add, remove, replacement and active plan changes", () => {
    expect(getLocalCreditTotal([], catalog)).toBe(0);
    expect(getLocalCreditTotal([selection("a")], catalog)).toBe(3.5);
    expect(getLocalCreditTotal([selection("a"), selection("b")], catalog)).toBe(5.5);
    expect(getLocalCreditTotal([selection("b")], catalog)).toBe(2);
    expect(getLocalCreditTotal([selection("")], catalog)).toBe(0);
  });
  it("does not guess missing, negative or nonfinite credit data", () => {
    expect(getLocalCreditTotal([selection("c")], catalog)).toBeNull();
    expect(getLocalCreditTotal([selection("missing")], catalog)).toBeNull();
    for (const localCredits of [null, -1, NaN, Infinity]) {
      const invalid = [{ ...catalog[0], courses: [{ ...catalog[0].courses[0], localCredits }] }];
      expect(getLocalCreditTotal([selection("a")], invalid)).toBeNull();
    }
  });
  it("indexes authoritative local credits, never ECTS or elective-slot guesses", () => {
    const index = buildLocalCreditIndex({ plans: [{ courses: [
      { kind: "course", code: "MAT101", credit: "3,5", ects: "9" },
      { kind: "course", code: "MAT 102", credit: "0", ects: "5" },
      { kind: "course", code: "MAT 103", credit: "-", ects: "8" },
      { kind: "course", code: "MAT 104", credit: "3 / 4", ects: "6" },
      { kind: "elective-slot", code: "MAT 105", credit: "4" },
      { kind: "course", code: "MAT 106", credit: "3" },
      { kind: "course", code: "MAT 106", credit: "4" },
      { kind: "course", code: "MAT 108", credit: "3 / unknown" },
    ] }], electiveGroups: { one: { courses: [{ code: "MAT 107", credit: "1,5", ects: "8" }] } } });
    expect(index.get("MAT 101")).toBe(3.5);
    expect(index.get("MAT 102")).toBe(0);
    expect(index.get("MAT 103")).toBeNull();
    expect(index.get("MAT 104")).toBeNull();
    expect(index.has("MAT 105")).toBe(false);
    expect(index.get("MAT 106")).toBeNull();
    expect(index.get("MAT 107")).toBe(1.5);
    expect(index.get("MAT 108")).toBeNull();
  });
});

describe("CRN bookmarklet", () => {
  it("preserves exact displayed order, leading zeros and snapshots across changes", () => {
    const first = createCrnBookmarklet([selection("a"), selection("b")], catalog);
    const reordered = createCrnBookmarklet([selection("b"), selection("a")], catalog);
    expect(first.crns).toEqual(["00123", "98765"]);
    expect(reordered.crns).toEqual(["98765", "00123"]);
    expect(first.url).not.toBe(reordered.url);
    expect(createCrnBookmarklet([selection("b")], catalog).crns).toEqual(["98765"]);
    expect(first.crns).toEqual(["00123", "98765"]);
    expect(first.url).toMatch(/^javascript:/);
    expect(() => new Function(first.url!.slice("javascript:".length))).not.toThrow();
    expect(JSON.parse(first.url!.match(/var crns=(\[[^;]+\]);/)![1])).toEqual(["00123", "98765"]);
  });
  it("disables empty plans and rejects incomplete or unsafe CRNs as a whole", () => {
    expect(createCrnBookmarklet([], catalog)).toMatchObject({ url: null, error: null });
    expect(createCrnBookmarklet([selection("")], catalog).url).toBeNull();
    for (const crn of ["", "12x", " 123", "123 ", "1;alert(1)", "123\n"]) {
      const invalid = [{ ...catalog[0], courses: [{ ...catalog[0].courses[0], sections: [{ id: "a:section", crn, meetings: [] }] }] }];
      expect(createCrnBookmarklet([selection("a")], invalid)).toMatchObject({ url: null, error: "invalidCrn" });
    }
    expect(createCrnBookmarklet([selection("a"), selection("c")], catalog).url).toBeNull();
    expect(createCrnBookmarklet([selection("a", "missing")], catalog).error).toBe("invalidCrn");
  });

  function input(parentElement: object | null = null, style = {}) {
    return { parentElement, style, value: "unchanged", dispatchEvent: vi.fn() };
  }
  function execute(inputs: ReturnType<typeof input>[], submit: object | null = null, footer: object | null = null) {
    const url = createCrnBookmarklet([selection("a"), selection("b")], catalog).url!;
    const querySelector = vi.fn((selector: string) => selector.startsWith("button") ? submit : footer);
    new Function("document", "window", "Event", "setTimeout", url.slice(11))(
      { querySelectorAll: () => inputs, querySelector },
      { getComputedStyle: (element: { style: object }) => ({ display: "block", visibility: "visible", ...element.style }) },
      Event, setTimeout,
    );
    return querySelector;
  }
  it("fills DOM order, skips direct and ancestor-hidden inputs, and bubbles events", () => {
    vi.useFakeTimers();
    const ancestor = { parentElement: null, style: { display: "none" } };
    const inputs = [input(null, { display: "none" }), input(ancestor), input(), input(null, { visibility: "hidden" }), input(), input()];
    execute(inputs);
    expect(inputs.map(({ value }) => value)).toEqual(["unchanged", "unchanged", "00123", "unchanged", "98765", "unchanged"]);
    const event = inputs[2].dispatchEvent.mock.calls[0][0] as Event;
    expect(event.type).toBe("input");
    expect(event.bubbles).toBe(true);
    expect(inputs[0].dispatchEvent).not.toHaveBeenCalled();
    expect(inputs[4].dispatchEvent).toHaveBeenCalledOnce();
    expect(inputs[5].dispatchEvent).not.toHaveBeenCalled();
  });
  it("handles fewer inputs than CRNs, including no inputs", () => {
    vi.useFakeTimers();
    const inputs = [input()];
    execute(inputs);
    expect(inputs[0].value).toBe("00123");
    expect(() => execute([])).not.toThrow();
  });
  it("does not click Simplify's logout submit or schedule submission when no visible inputs are filled", () => {
    vi.useFakeTimers();
    const logout = { click: vi.fn() };
    const confirm = { click: vi.fn() };
    const footer = { getElementsByTagName: () => [{ click: vi.fn() }, confirm] };
    for (const inputs of [[], [input(null, { display: "none" })], [input({ parentElement: null, style: { visibility: "hidden" } })]]) {
      const querySelector = execute(inputs, logout, footer);
      vi.runAllTimers();
      expect(logout.click).not.toHaveBeenCalled();
      expect(confirm.click).not.toHaveBeenCalled();
      expect(querySelector).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    }
  });
  it("preserves the submit then second-footer-button sequence at 50ms intervals", () => {
    vi.useFakeTimers();
    const clicks: string[] = [];
    const submit = { click: () => clicks.push("submit") };
    const buttons = [{ click: () => clicks.push("first") }, { click: () => clicks.push("second") }];
    execute([input()], submit, { getElementsByTagName: () => buttons });
    expect(clicks).toEqual([]);
    vi.advanceTimersByTime(49);
    expect(clicks).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(clicks).toEqual(["submit"]);
    vi.advanceTimersByTime(49);
    expect(clicks).toEqual(["submit"]);
    vi.advanceTimersByTime(1);
    expect(clicks).toEqual(["submit", "second"]);
  });
  it("tolerates missing submit/footer and a footer with only one button", () => {
    vi.useFakeTimers();
    execute([input()]);
    expect(() => vi.runAllTimers()).not.toThrow();
    const click = vi.fn();
    execute([input()], null, { getElementsByTagName: () => [{ click }] });
    vi.runAllTimers();
    expect(click).not.toHaveBeenCalled();
  });
});

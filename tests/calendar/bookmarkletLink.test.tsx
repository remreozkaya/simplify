import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import CrnBookmarkletLink from "@/components/calendar/CrnBookmarkletLink";

const url = 'javascript:(function(){var crns=["00123"];})();';
const props = { url, label: "Fill CRNs", tooltip: "Drag to the bookmarks bar" };

describe("bookmarklet link", () => {
  it("writes the actual javascript URL to the anchor without React sanitizing it", () => {
    const element = CrnBookmarkletLink(props);
    const setAttribute = vi.fn();
    element.props.ref({ setAttribute, removeAttribute: vi.fn() });
    expect(setAttribute).toHaveBeenCalledWith("href", url);
    expect(element.props.draggable).toBe(true);
    expect(renderToStaticMarkup(createElement(CrnBookmarkletLink, props))).toContain('title="Drag to the bookmarks bar"');
  });
  it("prevents normal and middle clicks from executing inside Simplify", () => {
    const element = CrnBookmarkletLink(props);
    const preventDefault = vi.fn();
    element.props.onClick({ preventDefault });
    element.props.onAuxClick({ preventDefault });
    expect(preventDefault).toHaveBeenCalledTimes(2);
  });
  it("sets bookmark drag formats to the current CRN snapshot", () => {
    const element = CrnBookmarkletLink(props);
    const setData = vi.fn();
    const dataTransfer = { setData, getData: () => "", effectAllowed: "" };
    element.props.onDragStart({ dataTransfer, currentTarget: { outerHTML: "anchor markup" }, preventDefault: vi.fn() });
    expect(setData).toHaveBeenCalledWith("text/uri-list", url);
    expect(setData).toHaveBeenCalledWith("text/plain", url);
    expect(setData).toHaveBeenCalledWith("text/html", "anchor markup");
    expect(dataTransfer.effectAllowed).toBe("copyLink");
  });
  it("keeps a fixed bookmark title in both languages without replacing native URL metadata", () => {
    for (const label of ["Fill CRNs", "CRN Doldur"]) {
      const element = CrnBookmarkletLink({ ...props, label });
      const html = renderToStaticMarkup(createElement(CrnBookmarkletLink, { ...props, label }));
      expect(html).toContain(`data-label="${label}"`);
      expect(html).toContain('aria-hidden="true">CRN Doldur</span>');
      const setData = vi.fn();
      element.props.onDragStart({ dataTransfer: { setData, getData: () => url }, currentTarget: { outerHTML: html } });
      expect(setData).not.toHaveBeenCalledWith("text/uri-list", expect.anything());
      expect(setData).toHaveBeenCalledWith("text/plain", url);
    }
  });
  it("removes the href and cancels drag for empty or invalid selections", () => {
    const element = CrnBookmarkletLink({ ...props, url: null });
    const removeAttribute = vi.fn();
    element.props.ref({ removeAttribute, setAttribute: vi.fn() });
    expect(removeAttribute).toHaveBeenCalledWith("href");
    const preventDefault = vi.fn();
    element.props.onDragStart({ preventDefault });
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(element.props.draggable).toBe(false);
    expect(element.props["aria-disabled"]).toBe(true);
  });
});

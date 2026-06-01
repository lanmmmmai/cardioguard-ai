import { describe, expect, it } from "vitest";
import { defaultRouteByRole, normalizeRole } from "./roles";

describe("normalizeRole", () => {
  it("normalizes valid roles with spaces and casing", () => {
    expect(normalizeRole(" Admin ")).toBe("admin");
    expect(normalizeRole("DOCTOR")).toBe("doctor");
    expect(normalizeRole("patient")).toBe("patient");
  });

  it("returns null for invalid roles", () => {
    expect(normalizeRole("manager")).toBeNull();
    expect(normalizeRole("")).toBeNull();
    expect(normalizeRole(null)).toBeNull();
  });
});

describe("defaultRouteByRole", () => {
  it("maps each role to expected route", () => {
    expect(defaultRouteByRole.admin).toBe("/admin/dashboard");
    expect(defaultRouteByRole.doctor).toBe("/doctor/dashboard");
    expect(defaultRouteByRole.patient).toBe("/patient/home");
  });
});

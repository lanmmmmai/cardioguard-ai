/**
 * Tệp: CardioGuard AI – Kiểm thử đơn vị cho các tiện ích vai trò
 * Mục đích: Xác minh normalizeRole xử lý chữ hoa/chữ thường, khoảng trắng,
 *           đầu vào không hợp lệ và defaultRouteByRole ánh xạ chính xác.
 * Luồng xử lý: Được điều khiển bởi Vitest; kiểm thử các hàm thuần túy từ ./roles.ts.
 * Quan hệ:
 *   - Kiểm thử: ./roles.ts (normalizeRole, defaultRouteByRole)
 */

import { describe, expect, it } from "vitest";
import { defaultRouteByRole, normalizeRole } from "./roles";

describe("normalizeRole", () => {
  it("chuẩn hóa vai trò hợp lệ với khoảng trắng và chữ hoa", () => {
    expect(normalizeRole(" Admin ")).toBe("admin");
    expect(normalizeRole("DOCTOR")).toBe("doctor");
    expect(normalizeRole("patient")).toBe("patient");
  });

  it("trả về null cho vai trò không hợp lệ", () => {
    expect(normalizeRole("manager")).toBeNull();
    expect(normalizeRole("")).toBeNull();
    expect(normalizeRole(null)).toBeNull();
  });
});

describe("defaultRouteByRole", () => {
  it("ánh xạ mỗi vai trò đến đường dẫn mong đợi", () => {
    expect(defaultRouteByRole.admin).toBe("/admin/dashboard");
    expect(defaultRouteByRole.doctor).toBe("/doctor/dashboard");
    expect(defaultRouteByRole.patient).toBe("/patient/dashboard");
  });
});

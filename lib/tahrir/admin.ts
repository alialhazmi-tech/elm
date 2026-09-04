/** إدارة الأعضاء والأدوار — كل كتابة تُدوَّن في سجل التدقيق وتُسقط كاش الأدوار. */

import { and, asc, count, eq, ne, sql } from "drizzle-orm";

import { rolePermissions, roles, userPermissions, users } from "@/db/schema";
import { getDb } from "@/lib/db";

import { invalidateRoleCache, loadRoleMap } from "./access";
import { hashPassword } from "./crypto";
import {
  ADMIN_ROLE,
  isPermissionKey,
  LEGACY_ROLE_MAP,
  SYSTEM_ROLES,
  WILDCARD,
  type OverrideEffect,
} from "./permissions";
import { audit } from "./service";

export class AdminError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function requireDb() {
  const db = getDb();
  if (!db) throw new AdminError("قاعدة البيانات غير مهيأة.", 503);
  return db;
}

const now = () => new Date().toISOString();

export type MemberStatus = "active" | "suspended";

export interface MemberSummary {
  id: string;
  username: string;
  displayName: string;
  email: string;
  role: string;
  roleLabel: string;
  status: MemberStatus;
  suspendedAt: string | null;
  suspendedBy: string | null;
  suspendReason: string;
  lastLoginAt: string | null;
  mustChangePassword: boolean;
  createdAt: string;
  overrides: Array<{ permissionKey: string; effect: OverrideEffect }>;
}

export async function listMembers(): Promise<MemberSummary[]> {
  const db = requireDb();
  const [rows, overrides, roleMap] = await Promise.all([
    db.select().from(users).orderBy(asc(users.createdAt)),
    db.select().from(userPermissions),
    loadRoleMap(),
  ]);
  const overridesByUser = new Map<string, MemberSummary["overrides"]>();
  for (const row of overrides) {
    const list = overridesByUser.get(row.userId) ?? [];
    list.push({ permissionKey: row.permissionKey, effect: row.effect as OverrideEffect });
    overridesByUser.set(row.userId, list);
  }
  return rows.map((row) => {
    const roleId = LEGACY_ROLE_MAP[row.role] ?? row.role;
    return {
      id: row.id,
      username: row.username,
      displayName: row.displayName,
      email: row.email,
      role: roleId,
      roleLabel: roleMap.get(roleId)?.label ?? roleId,
      status: row.status === "suspended" ? "suspended" : "active",
      suspendedAt: row.suspendedAt,
      suspendedBy: row.suspendedBy,
      suspendReason: row.suspendReason,
      lastLoginAt: row.lastLoginAt,
      mustChangePassword: row.mustChangePassword === 1,
      createdAt: row.createdAt,
      overrides: overridesByUser.get(row.id) ?? [],
    };
  });
}

const USERNAME_RE = /^[a-zA-Z0-9._@+-]{3,80}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateIdentity(input: { username?: string; email?: string; displayName?: string }) {
  if (input.username !== undefined && !USERNAME_RE.test(input.username)) {
    throw new AdminError("اسم المستخدم: 3–80 محرفًا لاتينيًا أو أرقامًا أو . _ @ + -");
  }
  if (input.email !== undefined && input.email !== "" && !EMAIL_RE.test(input.email)) {
    throw new AdminError("البريد الإلكتروني غير صالح.");
  }
  if (input.displayName !== undefined && input.displayName.trim().length < 2) {
    throw new AdminError("الاسم المعروض حرفان على الأقل.");
  }
}

async function requireRole(roleId: string) {
  const roleMap = await loadRoleMap();
  if (!roleMap.has(roleId)) throw new AdminError("الدور غير موجود.", 404);
  return roleMap.get(roleId)!;
}

/** عدد مسؤولي النظام الفعّالين عدا عضو بعينه — حارس «آخر مسؤول». */
async function otherActiveAdmins(exceptUserId: string): Promise<number> {
  const db = requireDb();
  const [row] = await db
    .select({ n: count() })
    .from(users)
    .where(and(eq(users.role, ADMIN_ROLE), eq(users.status, "active"), ne(users.id, exceptUserId)));
  return row?.n ?? 0;
}

export function validatePassword(password: string) {
  if (typeof password !== "string" || password.length > 512) throw new AdminError("كلمة المرور لا تتجاوز 512 محرفًا.");
  if (password.length < 10) throw new AdminError("كلمة المرور 10 محارف على الأقل.");
}

export async function createMember(
  input: {
    username: string;
    displayName: string;
    email: string;
    role: string;
    password: string;
    status?: MemberStatus;
    mustChangePassword?: boolean;
  },
  actor: string,
) {
  const db = requireDb();
  const username = input.username.trim();
  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim();
  validateIdentity({ username, email, displayName });
  validatePassword(input.password);
  await requireRole(input.role);

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
  if (existing.length > 0) throw new AdminError("اسم المستخدم مستعمل.", 409);

  const id = crypto.randomUUID();
  const at = now();
  await db.insert(users).values({
    id,
    username,
    displayName,
    email,
    role: input.role,
    passwordHash: await hashPassword(input.password),
    status: input.status ?? "active",
    mustChangePassword: input.mustChangePassword === false ? 0 : 1,
    createdAt: at,
    updatedAt: at,
  });
  await audit(actor, "users:create", undefined, `${displayName} (${username}) — ${input.role}`);
  return id;
}

export async function updateMember(
  id: string,
  input: { displayName?: string; email?: string; role?: string },
  actor: string,
) {
  const db = requireDb();
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!user) throw new AdminError("العضو غير موجود.", 404);

  const patch: Partial<typeof users.$inferInsert> = { updatedAt: now() };
  const changes: string[] = [];
  if (input.displayName !== undefined) {
    const displayName = input.displayName.trim();
    validateIdentity({ displayName });
    patch.displayName = displayName;
    changes.push(`الاسم: ${displayName}`);
  }
  if (input.email !== undefined) {
    const email = input.email.trim().toLowerCase();
    validateIdentity({ email });
    patch.email = email;
    changes.push(`البريد: ${email || "—"}`);
  }
  if (input.role !== undefined && input.role !== user.role) {
    await requireRole(input.role);
    if (user.role === ADMIN_ROLE && user.status === "active" && (await otherActiveAdmins(id)) === 0) {
      throw new AdminError("لا يمكن تغيير دور آخر مسؤول نظام فعّال — عيّن مسؤولًا آخر أولًا.", 409);
    }
    patch.role = input.role;
    changes.push(`الدور: ${user.role} ← ${input.role}`);
  }
  if (changes.length === 0) return;
  await db.update(users).set(patch).where(eq(users.id, id));
  await audit(actor, "users:update", undefined, `${user.displayName} — ${changes.join(" · ")}`);
}

export async function setMemberStatus(
  id: string,
  status: MemberStatus,
  reason: string,
  actor: { userId: string; username: string },
) {
  const db = requireDb();
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!user) throw new AdminError("العضو غير موجود.", 404);
  if (user.status === status) return;

  if (status === "suspended") {
    if (user.id === actor.userId) throw new AdminError("لا يمكنك تعليق عضويتك أنت.", 409);
    if (user.role === ADMIN_ROLE && (await otherActiveAdmins(id)) === 0) {
      throw new AdminError("لا يمكن تعليق آخر مسؤول نظام فعّال.", 409);
    }
    await db
      .update(users)
      .set({
        status: "suspended",
        sessionVersion: sql`${users.sessionVersion} + 1`,
        suspendedAt: now(),
        suspendedBy: actor.username,
        suspendReason: reason.trim().slice(0, 300),
        updatedAt: now(),
      })
      .where(eq(users.id, id));
    await audit(actor.username, "users:suspend", undefined, `${user.displayName} — ${reason.trim() || "بلا سبب"}`);
    return;
  }

  await db
    .update(users)
    .set({ status: "active", suspendedAt: null, suspendedBy: null, suspendReason: "", updatedAt: now() })
    .where(eq(users.id, id));
  await audit(actor.username, "users:reactivate", undefined, user.displayName);
}

/** كلمة مرور مؤقتة يضعها المسؤول — العضو يُجبر على تغييرها عند الدخول التالي. */
export async function resetMemberPassword(id: string, password: string, actor: string) {
  const db = requireDb();
  validatePassword(password);
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!user) throw new AdminError("العضو غير موجود.", 404);
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(password), sessionVersion: sql`${users.sessionVersion} + 1`, mustChangePassword: 1, updatedAt: now() })
    .where(eq(users.id, id));
  await audit(actor, "users:reset-password", undefined, user.displayName);
}

/** العضو يغيّر كلمة مروره بنفسه — يرفع علم الإجبار. */
export async function changeOwnPassword(id: string, password: string, actor: string, expectedSessionVersion: number) {
  const db = requireDb();
  validatePassword(password);
  const [updated] = await db
    .update(users)
    .set({ passwordHash: await hashPassword(password), sessionVersion: sql`${users.sessionVersion} + 1`, mustChangePassword: 0, updatedAt: now() })
    .where(and(eq(users.id, id), eq(users.sessionVersion, expectedSessionVersion), eq(users.status, "active"))).returning();
  if (!updated) throw new AdminError("تغيّرت حماية الحساب؛ أعد تسجيل الدخول.", 409);
  await audit(actor, "users:change-password");
  return updated;
}

export async function setMemberOverrides(
  id: string,
  overrides: Array<{ permissionKey: string; effect: OverrideEffect }>,
  actor: string,
) {
  const db = requireDb();
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!user) throw new AdminError("العضو غير موجود.", 404);
  for (const override of overrides) {
    if (!isPermissionKey(override.permissionKey)) throw new AdminError(`صلاحية غير معروفة: ${override.permissionKey}`);
    if (override.effect !== "allow" && override.effect !== "deny") throw new AdminError("أثر الاستثناء allow أو deny.");
  }
  await db.delete(userPermissions).where(eq(userPermissions.userId, id));
  if (overrides.length > 0) {
    await db.insert(userPermissions).values(overrides.map((o) => ({ userId: id, permissionKey: o.permissionKey, effect: o.effect })));
  }
  await audit(
    actor,
    "users:overrides",
    undefined,
    `${user.displayName} — ${overrides.length === 0 ? "بلا استثناءات" : overrides.map((o) => `${o.effect === "allow" ? "+" : "−"}${o.permissionKey}`).join(" ")}`,
  );
}

export interface RoleSummary {
  id: string;
  label: string;
  description: string;
  isSystem: boolean;
  position: number;
  permissions: string[];
  members: number;
}

export async function listRoles(): Promise<RoleSummary[]> {
  const db = requireDb();
  const [roleMap, counts] = await Promise.all([
    loadRoleMap(),
    db.select({ role: users.role, n: count() }).from(users).groupBy(users.role),
  ]);
  const countByRole = new Map(counts.map((row) => [LEGACY_ROLE_MAP[row.role] ?? row.role, row.n]));
  return [...roleMap.values()]
    .sort((a, b) => a.position - b.position || a.label.localeCompare(b.label, "ar"))
    .map((role) => ({
      id: role.id,
      label: role.label,
      description: role.description,
      isSystem: role.isSystem,
      position: role.position,
      permissions: [...role.permissions].sort(),
      members: countByRole.get(role.id) ?? 0,
    }));
}

const ROLE_ID_RE = /^[a-z][a-z0-9_]{1,40}$/;

export async function createRole(
  input: { id: string; label: string; description?: string; copyFrom?: string },
  actor: string,
) {
  const db = requireDb();
  const id = input.id.trim().toLowerCase();
  if (!ROLE_ID_RE.test(id)) throw new AdminError("معرّف الدور: حروف لاتينية صغيرة وأرقام و_ (2–40 محرفًا).");
  const label = input.label.trim();
  if (label.length < 2) throw new AdminError("اسم الدور حرفان على الأقل.");
  const roleMap = await loadRoleMap();
  if (roleMap.has(id)) throw new AdminError("معرّف الدور مستعمل.", 409);

  let permissions: string[] = [];
  if (input.copyFrom) {
    const source = roleMap.get(input.copyFrom);
    if (!source) throw new AdminError("الدور المنسوخ منه غير موجود.", 404);
    permissions = [...source.permissions].filter((key) => key !== WILDCARD);
  }
  const at = now();
  const position = Math.max(0, ...[...roleMap.values()].map((role) => role.position)) + 1;
  await db.insert(roles).values({ id, label, description: input.description?.trim() ?? "", isSystem: 0, position, createdAt: at, updatedAt: at });
  if (permissions.length > 0) {
    await db.insert(rolePermissions).values(permissions.map((permissionKey) => ({ roleId: id, permissionKey })));
  }
  invalidateRoleCache();
  await audit(actor, "roles:create", undefined, `${label} (${id})${input.copyFrom ? ` نسخة من ${input.copyFrom}` : ""}`);
}

export async function updateRole(id: string, input: { label?: string; description?: string }, actor: string) {
  const db = requireDb();
  const role = await requireRole(id);
  const patch: Partial<typeof roles.$inferInsert> = { updatedAt: now() };
  if (input.label !== undefined) {
    const label = input.label.trim();
    if (label.length < 2) throw new AdminError("اسم الدور حرفان على الأقل.");
    patch.label = label;
  }
  if (input.description !== undefined) patch.description = input.description.trim();
  await db.update(roles).set(patch).where(eq(roles.id, id));
  invalidateRoleCache();
  await audit(actor, "roles:update", undefined, `${role.label} → ${patch.label ?? role.label}`);
}

export async function deleteRole(id: string, actor: string) {
  const db = requireDb();
  const role = await requireRole(id);
  if (role.isSystem) throw new AdminError("الأدوار النظامية لا تُحذف.", 409);
  const [row] = await db.select({ n: count() }).from(users).where(eq(users.role, id));
  if ((row?.n ?? 0) > 0) throw new AdminError("انقل أعضاء هذا الدور إلى دور آخر أولًا.", 409);
  await db.delete(rolePermissions).where(eq(rolePermissions.roleId, id));
  await db.delete(roles).where(eq(roles.id, id));
  invalidateRoleCache();
  await audit(actor, "roles:delete", undefined, role.label);
}

export async function setRolePermission(roleId: string, permissionKey: string, granted: boolean, actor: string) {
  const db = requireDb();
  const role = await requireRole(roleId);
  if (!isPermissionKey(permissionKey)) throw new AdminError("صلاحية غير معروفة.");
  if (roleId === ADMIN_ROLE) throw new AdminError("مسؤول النظام يملك كل الصلاحيات بحكم التعريف.", 409);

  if (granted) {
    await db
      .insert(rolePermissions)
      .values({ roleId, permissionKey })
      .onConflictDoNothing();
  } else {
    await db
      .delete(rolePermissions)
      .where(and(eq(rolePermissions.roleId, roleId), eq(rolePermissions.permissionKey, permissionKey)));
  }
  await db.update(roles).set({ updatedAt: now() }).where(eq(roles.id, roleId));
  invalidateRoleCache();
  await audit(actor, "roles:permission", undefined, `${role.label}: ${granted ? "+" : "−"}${permissionKey}`);
}

/**
 * زرع الأدوار النظامية إن غابت (بلا لمس ما زُرع سابقًا) وترحيل approver — يُستدعى من السكربت
 * ومن أول تحميل للوحة كي لا تبقى قاعدة بلا أدوار بعد db:push.
 */
export async function ensureSystemRoles(): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  const existing = new Set((await db.select({ id: roles.id }).from(roles)).map((row) => row.id));
  let changed = false;
  const at = now();
  for (const [position, role] of SYSTEM_ROLES.entries()) {
    if (existing.has(role.id)) continue;
    await db.insert(roles).values({ id: role.id, label: role.label, description: role.description, isSystem: 1, position, createdAt: at, updatedAt: at });
    await db.insert(rolePermissions).values(role.defaults.map((permissionKey) => ({ roleId: role.id, permissionKey })));
    changed = true;
  }
  for (const [legacy, target] of Object.entries(LEGACY_ROLE_MAP)) {
    const result = await db.update(users).set({ role: target }).where(eq(users.role, legacy)).returning({ id: users.id });
    if (result.length > 0) changed = true;
  }
  if (changed) invalidateRoleCache();
  return changed;
}

/** يمنع db:push من ترك الجدول فارغًا حتى تُشغَّل السكربتات — استدعاء رخيص: عدّ واحد. */
export async function rolesSeeded(): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(roles);
  return (row?.n ?? 0) > 0;
}

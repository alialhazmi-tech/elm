/**
 * حلّ الصلاحيات الفعلية للجلسة — «الحارس الموحّد» لكل مسارات API وشاشات اللوحة.
 *
 * الرمز الموقَّع يحمل هوية العضو فقط؛ الدور والحالة يُقرآن من القاعدة عند كل طلب (بحث بمفتاح أساسي)
 * فيسري تغيير الدور والتعليق فورًا. خريطة «دور → صلاحيات» صغيرة وتُقرأ بكاش 30 ثانية، وأي تعديل
 * من شاشة الأدوار يُسقطها في العملية نفسها (على Workers لكل isolate كاشه — يلحق خلال 30 ثانية).
 */

import { cache } from "react";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { rolePermissions, roles, userPermissions, users } from "@/db/schema";
import { getDb } from "@/lib/db";

import { getSession } from "./auth";
import {
  hasPermission,
  LEGACY_ROLE_MAP,
  resolvePermissions,
  type OverrideEffect,
} from "./permissions";

export interface RoleInfo {
  id: string;
  label: string;
  description: string;
  isSystem: boolean;
  position: number;
  permissions: Set<string>;
}

const ROLE_CACHE_MS = 30_000;
let roleCache: { at: number; map: Map<string, RoleInfo> } | null = null;

/** يُستدعى بعد أي كتابة في roles أو role_permissions. */
export function invalidateRoleCache() {
  roleCache = null;
}

export async function loadRoleMap(): Promise<Map<string, RoleInfo>> {
  if (roleCache && Date.now() - roleCache.at < ROLE_CACHE_MS) return roleCache.map;
  const db = getDb();
  if (!db) return new Map();

  const [roleRows, permissionRows] = await Promise.all([
    db.select().from(roles),
    db.select().from(rolePermissions),
  ]);
  const map = new Map<string, RoleInfo>();
  for (const row of roleRows) {
    map.set(row.id, {
      id: row.id,
      label: row.label,
      description: row.description,
      isSystem: row.isSystem === 1,
      position: row.position,
      permissions: new Set(),
    });
  }
  for (const row of permissionRows) map.get(row.roleId)?.permissions.add(row.permissionKey);
  roleCache = { at: Date.now(), map };
  return map;
}

export interface Actor {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  role: string;
  roleLabel: string;
  mustChangePassword: boolean;
  permissions: Set<string>;
  can(key: string): boolean;
}

/**
 * الفاعل الحالي: الجلسة + صف العضو الحي + صلاحياته المحلولة.
 * null عند غياب الجلسة أو تعليق العضوية أو حذفها — والطبقة العليا تعيد إلى الدخول.
 * مغلّف بـ cache() فيتشاركه الـlayout والصفحة في الرندر الواحد.
 */
export const loadActor = cache(async (): Promise<Actor | null> => {
  const session = await getSession();
  if (!session) return null;
  const db = getDb();
  if (!db) return null;

  const [userRows, overrideRows, roleMap] = await Promise.all([
    db.select().from(users).where(eq(users.id, session.userId)).limit(1),
    db.select().from(userPermissions).where(eq(userPermissions.userId, session.userId)),
    loadRoleMap(),
  ]);
  const user = userRows[0];
  if (!user || (session.sessionVersion ?? 0) !== user.sessionVersion || user.status !== "active") return null;

  const roleId = LEGACY_ROLE_MAP[user.role] ?? user.role;
  const role = roleMap.get(roleId);
  const permissions = resolvePermissions(
    role?.permissions ?? [],
    overrideRows.map((row) => ({ permissionKey: row.permissionKey, effect: row.effect as OverrideEffect })),
  );

  return {
    userId: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    role: roleId,
    roleLabel: role?.label ?? roleId,
    mustChangePassword: user.mustChangePassword === 1,
    permissions,
    can: (key) => hasPermission(permissions, key),
  };
});

export type Gate = { ok: true; actor: Actor } | { ok: false; response: NextResponse };

/**
 * بوابة مسارات API: 401 بلا جلسة حية، و403 بلا الصلاحية. الاستعمال:
 *   const gate = await requirePermission("story.publish");
 *   if (!gate.ok) return gate.response;
 */
export async function requirePermission(key: string, forbiddenMessage?: string): Promise<Gate> {
  const actor = await loadActor();
  if (!actor) {
    return { ok: false, response: NextResponse.json({ error: "الجلسة منتهية." }, { status: 401 }) };
  }
  if (actor.mustChangePassword) {
    return {
      ok: false,
      response: NextResponse.json({ error: "غيّر كلمة المرور المؤقتة أولًا." }, { status: 403 }),
    };
  }
  if (!actor.can(key)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: forbiddenMessage ?? "ليست لديك صلاحية هذا الإجراء.", permission: key },
        { status: 403 },
      ),
    };
  }
  return { ok: true, actor };
}

/** بوابة الجلسة فقط (بلا صلاحية بعينها) — للمسارات المفتوحة لكل عضو فعّال. */
export async function requireActor(options: { allowTemporaryPassword?: boolean } = {}): Promise<Gate> {
  const actor = await loadActor();
  if (!actor) {
    return { ok: false, response: NextResponse.json({ error: "الجلسة منتهية." }, { status: 401 }) };
  }
  if (actor.mustChangePassword && !options.allowTemporaryPassword) {
    return { ok: false, response: NextResponse.json({ error: "غيّر كلمة المرور المؤقتة أولًا." }, { status: 403 }) };
  }
  return { ok: true, actor };
}

/**
 * تحرير مادة: صاحبها بـ story.edit.own، وغيره بـ story.edit.any.
 * الملكية بمعرف المستخدم الثابت؛ الاسم المعروض ليس إثبات ملكية.
 */
export function canEditStory(actor: Actor, story: { authorId: string | null } | null): boolean {
  if (actor.mustChangePassword) return false;
  if (story && actor.can("story.edit.any")) return true;
  if (!story) return actor.can("story.create");
  return actor.can("story.edit.own") && story.authorId === actor.userId;
}

import { CustomRole, PERMISSION_MODULES, Permissions, PermissionModule, User } from '../types';

/**
 * A custom role with no view permission on a module is restrictive by design (that's what "no
 * access" means); a user with NO custom role at all falls back to whatever their base UserRole
 * already allows (unchanged behaviour from before custom roles existed).
 */
export const DEFAULT_PERMISSIONS: Permissions = PERMISSION_MODULES.reduce((acc, m) => {
    acc[m] = { view: false, edit: false };
    return acc;
}, {} as Permissions);

/** Fills in any module missing from a persisted role's permissions (e.g. one saved before a new
 *  module was added here) with "no access" rather than letting a read crash on `undefined`. */
export const normalizePermissions = (permissions: Partial<Permissions> | null | undefined): Permissions => {
    const result = { ...DEFAULT_PERMISSIONS };
    if (permissions) {
        for (const m of PERMISSION_MODULES) {
            if (permissions[m]) result[m] = { view: !!permissions[m]!.view, edit: !!permissions[m]!.edit };
        }
    }
    return result;
};

/** The signed-in user's custom role, if they have one and it still exists. */
export const getCustomRole = (user: User, customRoles: CustomRole[] | undefined): CustomRole | null => {
    if (!user.customRoleId) return null;
    return customRoles?.find(r => r.id === user.customRoleId) || null;
};

/**
 * Whether the user can view/edit a given module. A user with NO custom role is governed only by
 * their base UserRole (handled separately, e.g. PAGE_ROLES / the OPS/ALL role lists in nav.ts) —
 * so this always returns full access for them. A user WITH a custom role is restricted to exactly
 * what that role's permissions grant, module by module.
 */
export const modulePermission = (
    customRole: CustomRole | null,
    module: PermissionModule,
): { view: boolean; edit: boolean } => {
    if (!customRole) return { view: true, edit: true };
    return customRole.permissions[module] || { view: false, edit: false };
};

export const canViewModule = (customRole: CustomRole | null, module: PermissionModule): boolean =>
    modulePermission(customRole, module).view;

export const canEditModule = (customRole: CustomRole | null, module: PermissionModule): boolean =>
    modulePermission(customRole, module).edit;
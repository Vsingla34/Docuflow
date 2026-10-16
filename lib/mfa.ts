import { UserRole } from '../types';
import { supabase } from './supabase';

// Roles that MUST have a verified TOTP factor before they can use the app at all (App.tsx's
// RequireMfa gate) and can't turn it back off from the voluntary header entry while they're on
// this list (components/layout/Header.tsx). Left empty: MFA is still fully built and anyone can
// turn it on for themselves from the header's key icon, but nobody is forced into it. Add
// UserRole.SUPERADMIN / UserRole.ADMIN back here to make it mandatory for those roles again.
export const MFA_REQUIRED_ROLES: UserRole[] = [];

/**
 * Multi-factor authentication (TOTP) helpers, wrapping Supabase Auth's `supabase.auth.mfa.*`
 * API. Final item on the Week 2-4 remediation backlog — until this, a compromised password was
 * the only thing standing between an attacker and full Superadmin/Admin access, with no second
 * factor possible anywhere in the app.
 *
 * Supabase models MFA as "factors" scoped to the signed-in user (not a flag on `profiles`), so
 * every check here goes through `supabase.auth.mfa.*` rather than the app's own `state`. A factor
 * is `unverified` immediately after `enroll()` and only becomes `verified` — and therefore
 * counted anywhere in this app — once the user proves they can generate a code for it.
 */

export interface TotpEnrollment {
    factorId: string;
    /** Ready-to-render `data:image/svg+xml` QR code — hand straight to an <img src>. */
    qrCode: string;
    /** Manual-entry fallback for an authenticator app that can't scan the QR code. */
    secret: string;
}

type Result = { ok: true } | { ok: false; error: string };

/** True if the signed-in user already has at least one verified TOTP factor. */
export const hasVerifiedTotpFactor = async (): Promise<boolean> => {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error || !data) return false;
    return data.totp.length > 0;
};

/** The signed-in user's verified TOTP factor, if any (used to drive a challenge or an unenroll). */
export const getVerifiedTotpFactor = async (): Promise<{ id: string; friendlyName?: string } | null> => {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error || !data || data.totp.length === 0) return null;
    return { id: data.totp[0].id, friendlyName: data.totp[0].friendly_name };
};

/**
 * Whether the CURRENT session still needs a second factor before it's fully trusted. True right
 * after a correct password sign-in when the account has a verified factor from an earlier
 * session — the password alone only ever gets the session to aal1.
 */
export const sessionNeedsMfaChallenge = async (): Promise<boolean> => {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || !data) return false;
    return data.nextLevel === 'aal2' && data.currentLevel !== data.nextLevel;
};

/**
 * Starts TOTP enrollment and returns the QR code + manual secret to show the user. The factor is
 * `unverified` until confirmTotpEnrollment succeeds — it doesn't count as MFA being "on" yet.
 *
 * Two defenses against a bug that surfaced in testing: enroll() with no `friendlyName` always
 * defaults to the empty string, and Supabase rejects a second factor with a friendly name that
 * collides with an existing one for the same user — including an unverified leftover from an
 * earlier attempt (a page refresh mid-setup, the user backing out without hitting the cancel
 * button, this screen's effect re-running). That left EVERY later attempt permanently failing
 * with "A factor with the friendly name "" for this user already exists", with no way to retry
 * short of a Superadmin clearing it out of the auth.mfa_factors table by hand. Fixed by (1)
 * clearing out any unverified TOTP factor before enrolling a new one, and (2) giving each
 * enrollment a unique friendly name, so even two enroll() calls racing each other can't collide.
 */
export const beginTotpEnrollment = async (): Promise<{ ok: true; enrollment: TotpEnrollment } | { ok: false; error: string }> => {
    const { data: existing } = await supabase.auth.mfa.listFactors();
    if (existing) {
        const abandoned = existing.all.filter(f => f.factor_type === 'totp' && f.status === 'unverified');
        await Promise.all(abandoned.map(f => supabase.auth.mfa.unenroll({ factorId: f.id })));
    }

    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `totp-${Date.now()}` });
    if (error || !data) return { ok: false, error: error?.message || 'Could not start two-factor setup.' };
    return { ok: true, enrollment: { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret } };
};

/** Confirms a just-started enrollment with a code from the authenticator app. Required before the
 *  factor is counted anywhere — Supabase leaves it `unverified` (and inert) until this succeeds. */
export const confirmTotpEnrollment = async (factorId: string, code: string): Promise<Result> => {
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
};

/** Verifies a login-time MFA challenge against an already-verified factor. */
export const verifyLoginChallenge = async (factorId: string, code: string): Promise<Result> => {
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
};

/** Removes a factor — used both to turn MFA back off voluntarily and to discard an abandoned,
 *  still-unverified enrollment (e.g. the user closed the QR step without finishing). */
export const removeTotpFactor = async (factorId: string): Promise<Result> => {
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
};
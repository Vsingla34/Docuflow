import React, { useEffect, useState } from 'react';
import { beginTotpEnrollment, confirmTotpEnrollment, removeTotpFactor, TotpEnrollment } from '../../lib/mfa';
import { Field, Input, PrimaryButton, SecondaryButton } from './FormControls';

type Step = 'loading' | 'ready' | 'failed';

/**
 * Shared TOTP enrollment flow: start enrollment, show the QR code + manual secret, collect the
 * 6-digit confirmation code. Used two ways — as a mandatory, blocking screen for roles that must
 * have MFA on (App.tsx), and as a voluntary one opened from the header for everyone else
 * (components/layout/Header.tsx) — so the actual enrollment logic lives in exactly one place.
 */
const MfaSetup: React.FC<{
    /** Called once the factor is confirmed and verified. */
    onEnrolled: () => void;
    /** Called after backing out — the in-progress (unverified) factor is discarded first so it
     *  doesn't linger as clutter in the user's factor list. Omit to make the flow un-cancelable. */
    onCancel?: () => void;
    /** Swaps the cancel button's label for a mandatory context ("Sign out instead" vs "Cancel") —
     *  purely cosmetic, the underlying action (discard + onCancel) is identical either way. */
    mandatory?: boolean;
}> = ({ onEnrolled, onCancel, mandatory = false }) => {
    const [step, setStep] = useState<Step>('loading');
    const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
    const [code, setCode] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [cancelling, setCancelling] = useState(false);

    useEffect(() => {
        let cancelled = false;
        beginTotpEnrollment().then(result => {
            if (cancelled) return;
            if (!result.ok) { setError(result.error); setStep('failed'); return; }
            setEnrollment(result.enrollment);
            setStep('ready');
        });
        return () => { cancelled = true; };
    }, []);

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!enrollment || code.length !== 6) return;
        setSubmitting(true);
        setError(null);
        const result = await confirmTotpEnrollment(enrollment.factorId, code);
        setSubmitting(false);
        if (!result.ok) { setError(result.error); return; }
        onEnrolled();
    };

    const handleCancel = async () => {
        if (!onCancel) return;
        setCancelling(true);
        // Best-effort cleanup of the unverified factor — an enrollment the user backed out of
        // shouldn't linger in their factor list as something that looks half set-up.
        if (enrollment) await removeTotpFactor(enrollment.factorId);
        setCancelling(false);
        onCancel();
    };

    if (step === 'loading') {
        return <div className="py-8 text-center text-sm text-text-light">Setting up two-factor authentication...</div>;
    }

    if (step === 'failed') {
        return (
            <div className="space-y-4 text-center py-4">
                <p className="text-sm text-red-600">{error}</p>
                {onCancel && <SecondaryButton onClick={onCancel}>Close</SecondaryButton>}
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <div className="text-center space-y-3">
                <p className="text-sm text-text-light">
                    Scan this code with an authenticator app (Google Authenticator, Authy, 1Password, etc.), then enter the 6-digit code it shows.
                </p>
                {enrollment && (
                    <div className="flex justify-center">
                        <img src={enrollment.qrCode} alt="Two-factor setup QR code" className="w-44 h-44 border border-border rounded-lg p-2 bg-white" />
                    </div>
                )}
                {enrollment && (
                    <p className="text-xs text-text-light">
                        Can't scan it? Enter this code manually: <span className="font-mono font-semibold text-text-main break-all">{enrollment.secret}</span>
                    </p>
                )}
            </div>
            <form onSubmit={handleVerify} className="space-y-3">
                <Field label="6-digit code">
                    <Input
                        value={code}
                        onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="000000"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        autoFocus
                        maxLength={6}
                    />
                </Field>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <div className="flex gap-3 justify-end">
                    {onCancel && (
                        <SecondaryButton type="button" onClick={handleCancel} disabled={submitting || cancelling}>
                            {cancelling ? 'Please wait...' : mandatory ? 'Sign out instead' : 'Cancel'}
                        </SecondaryButton>
                    )}
                    <PrimaryButton type="submit" disabled={submitting || cancelling || code.length !== 6}>
                        {submitting ? 'Verifying...' : 'Verify & Enable'}
                    </PrimaryButton>
                </div>
            </form>
        </div>
    );
};

export default MfaSetup;
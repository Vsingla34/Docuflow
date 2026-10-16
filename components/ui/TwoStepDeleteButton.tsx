import React, { useEffect, useRef, useState } from 'react';
import Icon from '../icons/Icon';

/**
 * A delete control that needs two deliberate clicks, not one — and not a browser `confirm()`
 * popup either (easy to blow through on muscle memory, and looks jarring/unstyled next to the
 * rest of the app). First click arms it: the button itself changes to "Confirm delete?" for a
 * few seconds. A second click within that window actually deletes. Clicking elsewhere, or letting
 * the window lapse, quietly disarms it again with no action taken.
 *
 * `onConfirm` may be async (e.g. a Supabase delete) — while it's in flight the button shows a
 * disabled "Deleting…" state so a slow network can't be clicked twice.
 */
export const TwoStepDeleteButton: React.FC<{
    onConfirm: () => void | Promise<void>;
    label?: string;
    confirmLabel?: string;
    armedSeconds?: number;
    className?: string;
    iconOnly?: boolean;
    disabled?: boolean;
    title?: string;
}> = ({ onConfirm, label = 'Delete', confirmLabel = 'Confirm delete?', armedSeconds = 5, className = '', iconOnly = false, disabled = false, title }) => {
    const [armed, setArmed] = useState(false);
    const [busy, setBusy] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const rootRef = useRef<HTMLSpanElement>(null);

    const disarm = () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = null;
        setArmed(false);
    };

    useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

    // Clicking anywhere else cancels the pending confirm instead of leaving it armed indefinitely.
    useEffect(() => {
        if (!armed) return;
        const onDocClick = (e: MouseEvent) => {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) disarm();
        };
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, [armed]);

    const handleClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (busy) return;
        if (!armed) {
            setArmed(true);
            timerRef.current = setTimeout(disarm, armedSeconds * 1000);
            return;
        }
        disarm();
        setBusy(true);
        try {
            await onConfirm();
        } finally {
            setBusy(false);
        }
    };

    if (iconOnly) {
        return (
            <span ref={rootRef} className="inline-flex">
                <button
                    type="button"
                    title={busy ? 'Deleting…' : armed ? 'Click again to permanently delete' : (title || label)}
                    disabled={disabled || busy}
                    onClick={handleClick}
                    className={`p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${armed ? 'bg-red-600 text-white hover:bg-red-700' : 'text-red-500 hover:bg-red-50'
                        } ${className}`}
                >
                    <Icon name={armed ? 'alertCircle' : 'trash'} className="w-5 h-5" />
                </button>
            </span>
        );
    }

    return (
        <span ref={rootRef} className="inline-flex">
            <button
                type="button"
                disabled={disabled || busy}
                onClick={handleClick}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${armed ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-white text-red-600 border border-red-200 hover:bg-red-50'
                    } ${className}`}
            >
                <Icon name={armed ? 'alertCircle' : 'trash'} className="w-4 h-4" />
                {busy ? 'Deleting…' : armed ? confirmLabel : label}
            </button>
        </span>
    );
};

export default TwoStepDeleteButton;
import React from 'react';
import { NumberingRule } from '../../types';
import { applyNumberingRule, hasNumberingRule } from '../../lib/numbering';
import { Field, Input } from './FormControls';

/**
 * A "Code" input that auto-applies an admin-configured prefix/suffix (Settings page) on blur,
 * for NEW records only — editing an existing code leaves it exactly as typed, since re-wrapping
 * an already-saved code on every blur would be surprising and could silently change a code a
 * user deliberately edited. Falls back to a plain code input when no rule is configured.
 */
export const CodeField: React.FC<{
    value: string;
    onChange: (v: string) => void;
    rule?: NumberingRule;
    isNew: boolean;
    label?: string;
    placeholder?: string;
    required?: boolean;
    className?: string;
}> = ({ value, onChange, rule, isNew, label = 'Code', placeholder, required = true, className }) => {
    const active = isNew && hasNumberingRule(rule);
    return (
        <Field
            label={label}
            required={required}
            className={className}
            hint={active ? `Auto-applied: ${rule?.prefix || ''}…${rule?.suffix || ''} — just type the number/name and leave the field` : undefined}
        >
            <Input
                value={value}
                onChange={e => onChange(e.target.value.toUpperCase())}
                onBlur={() => { if (active) onChange(applyNumberingRule(rule, value)); }}
                placeholder={placeholder || (active ? 'e.g. 1' : undefined)}
            />
        </Field>
    );
};
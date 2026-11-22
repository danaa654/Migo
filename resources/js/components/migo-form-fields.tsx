import { Eye, EyeOff } from 'lucide-react';
import { useState, type ChangeEvent, type ReactNode } from 'react';
import { field } from '@/components/migo-auth-shell';

const errText = 'mt-1.5 text-xs font-medium text-m-redtext';
const label = 'mb-1.5 block text-sm font-medium';

type Common = {
    id: string;
    label: string;
    error?: string;
    hint?: string;
    disabled?: boolean;
};

export function TextField({
    id,
    label: text,
    error,
    hint,
    disabled,
    type = 'text',
    value,
    onChange,
    placeholder,
    autoComplete,
    autoFocus,
    required = true,
}: Common & {
    type?: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    autoComplete?: string;
    autoFocus?: boolean;
    required?: boolean;
}) {
    return (
        <div>
            <label htmlFor={id} className={label}>
                {text}
                {!required && (
                    <span className="font-normal text-m-muted">
                        {' '}
                        (optional)
                    </span>
                )}
            </label>
            <input
                id={id}
                name={id}
                type={type}
                value={value}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    onChange(e.target.value)
                }
                placeholder={placeholder}
                autoComplete={autoComplete}
                autoFocus={autoFocus}
                disabled={disabled}
                aria-invalid={!!error}
                aria-required={required || undefined}
                aria-describedby={
                    error ? `${id}-err` : hint ? `${id}-hint` : undefined
                }
                className={`${field} ${error ? 'border-m-red' : ''}`}
            />
            {hint && !error && (
                <p id={`${id}-hint`} className="mt-1.5 text-xs text-m-muted">
                    {hint}
                </p>
            )}
            {error && (
                <p id={`${id}-err`} className={errText}>
                    {error}
                </p>
            )}
        </div>
    );
}

export function PasswordField({
    id,
    label: text,
    error,
    hint,
    disabled,
    value,
    onChange,
    autoComplete = 'new-password',
    placeholder,
}: Common & {
    value: string;
    onChange: (value: string) => void;
    autoComplete?: string;
    placeholder?: string;
}) {
    const [show, setShow] = useState(false);

    return (
        <div>
            <label htmlFor={id} className={label}>
                {text}
            </label>
            <div className="relative">
                <input
                    id={id}
                    name={id}
                    type={show ? 'text' : 'password'}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    autoComplete={autoComplete}
                    disabled={disabled}
                    aria-invalid={!!error}
                    aria-describedby={
                        error ? `${id}-err` : hint ? `${id}-hint` : undefined
                    }
                    className={`${field} pr-11 ${error ? 'border-m-red' : ''}`}
                />
                <button
                    type="button"
                    onClick={() => setShow(!show)}
                    aria-label={
                        show
                            ? `Hide ${text.toLowerCase()}`
                            : `Show ${text.toLowerCase()}`
                    }
                    aria-pressed={show}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-m-muted transition hover:text-m-accent focus-visible:outline-2 focus-visible:outline-m-accent"
                >
                    {show ? (
                        <EyeOff className="size-5" />
                    ) : (
                        <Eye className="size-5" />
                    )}
                </button>
            </div>
            {hint && !error && (
                <p id={`${id}-hint`} className="mt-1.5 text-xs text-m-muted">
                    {hint}
                </p>
            )}
            {error && (
                <p id={`${id}-err`} className={errText}>
                    {error}
                </p>
            )}
        </div>
    );
}

export function FileField({
    id,
    label: text,
    error,
    hint,
    disabled,
    accept,
    onChange,
    required,
}: Common & {
    accept: string;
    onChange: (file: File | null) => void;
    required?: boolean;
}) {
    return (
        <div>
            <label htmlFor={id} className={label}>
                {text}{' '}
                {required ? (
                    <span className="text-m-red" aria-hidden>
                        *
                    </span>
                ) : (
                    <span className="font-normal text-m-muted">
                        (optional)
                    </span>
                )}
            </label>
            <input
                id={id}
                name={id}
                type="file"
                accept={accept}
                disabled={disabled}
                onChange={(e) => onChange(e.target.files?.[0] ?? null)}
                aria-invalid={!!error}
                aria-describedby={
                    error ? `${id}-err` : hint ? `${id}-hint` : undefined
                }
                className={`${field} cursor-pointer file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-m-mint file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-m-accent`}
            />
            {hint && !error && (
                <p id={`${id}-hint`} className="mt-1.5 text-xs text-m-muted">
                    {hint}
                </p>
            )}
            {error && (
                <p id={`${id}-err`} className={errText}>
                    {error}
                </p>
            )}
        </div>
    );
}

export function TermsField({
    checked,
    onChange,
    error,
    disabled,
    children,
}: {
    checked: boolean;
    onChange: (v: boolean) => void;
    error?: string;
    disabled?: boolean;
    children: ReactNode;
}) {
    return (
        <div>
            <label className="flex cursor-pointer items-start gap-2.5 text-sm">
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => onChange(e.target.checked)}
                    disabled={disabled}
                    aria-invalid={!!error}
                    className="mt-0.5 size-4 shrink-0 rounded accent-m-forest"
                />
                <span className="leading-relaxed">{children}</span>
            </label>
            {error && <p className={errText}>{error}</p>}
        </div>
    );
}

export type JsonResult<T> = {
    ok: boolean;
    status: number;
    data: T & {
        message?: string;
        retry_after?: number;
        errors?: Record<string, string[]>;
    };
    message: string;
};

function xsrfToken(): string {
    const cookie = document.cookie
        .split('; ')
        .find((c) => c.startsWith('XSRF-TOKEN='));

    return cookie ? decodeURIComponent(cookie.slice('XSRF-TOKEN='.length)) : '';
}

/**
 * POSTs JSON with Laravel's CSRF cookie header and returns one friendly error message on failure.
 * Used by the OTP screens, which stay on the same page between steps.
 */
export async function postJson<T = Record<string, unknown>>(
    url: string,
    body: unknown,
): Promise<JsonResult<T>> {
    try {
        const res = await fetch(url, {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'X-XSRF-TOKEN': xsrfToken(),
            },
            body: JSON.stringify(body),
        });

        let data = {} as JsonResult<T>['data'];
        try {
            data = await res.json();
        } catch {
            /* empty or non-JSON body */
        }

        const message =
            res.status === 419
                ? 'Nag-expire ang session mo. I-refresh ang page at subukan ulit.'
                : (data.errors && Object.values(data.errors)[0]?.[0]) ||
                  data.message ||
                  'May nangyaring mali. Subukan ulit.';

        return { ok: res.ok, status: res.status, data, message };
    } catch {
        return {
            ok: false,
            status: 0,
            data: {} as JsonResult<T>['data'],
            message:
                'Walang koneksyon. Tingnan ang internet mo at subukan ulit.',
        };
    }
}

<?php

namespace App\Http\Requests\Auth;

class VerifyEmailOtpRequest extends SendEmailOtpRequest
{
    protected function prepareForValidation(): void
    {
        parent::prepareForValidation();
        $this->merge(['code' => preg_replace('/\s+/', '', (string) $this->input('code'))]);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            ...parent::rules(),
            'code' => ['required', 'string', 'regex:/^\d{6}$/'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            ...parent::messages(),
            'code.required' => 'Ilagay ang 6-digit code.',
            'code.regex' => 'Dapat 6 na numero ang code.',
        ];
    }

    public function code(): string
    {
        return (string) $this->validated('code');
    }
}

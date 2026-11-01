export const PASSWORD_MIN_LENGTH = 8

export function passwordChecks(password) {
  return [
    { text: `At least ${PASSWORD_MIN_LENGTH} characters`, ok: password.length >= PASSWORD_MIN_LENGTH },
    { text: 'One uppercase letter', ok: /[A-Z]/.test(password) },
    { text: 'One special character (!@#$%^&*)', ok: /[!@#$%^&*]/.test(password) }
  ]
}

export function passwordIsValid(password) {
  return passwordChecks(password).every((r) => r.ok)
}
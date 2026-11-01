export const MIN_LENGTH = 8

export function passwordProblems(password) {
  const problems = []
  if (password.length < MIN_LENGTH) {
    problems.push(`Password must be at least ${MIN_LENGTH} characters.`)
  }
  if (!/[A-Z]/.test(password)) {
    problems.push('Password must contain an uppercase letter.')
  }
  if (!/[!@#$%^&*]/.test(password)) {
    problems.push('Password must contain a special character (!@#$%^&*).')
  }
  return problems
}
export function getRoles(user) {
  return (user?.roles || user?.groups || []).map((role) => String(role).toLowerCase())
}

export function hasRole(user, role) {
  return getRoles(user).includes(String(role).toLowerCase())
}

export function isAdmin(user) {
  return Boolean(user?.is_superuser) || hasRole(user, 'admin')
}

export function isInstructor(user) {
  return isAdmin(user) || hasRole(user, 'instructor') || hasRole(user, 'dosen')
}

export function isStudent(user) {
  return isAdmin(user) || isInstructor(user) || hasRole(user, 'student')
}

export function primaryRole(user) {
  if (isAdmin(user)) return 'Admin'
  if (isInstructor(user)) return 'Instructor'
  if (isStudent(user)) return 'Student'
  return 'Student'
}

export function canManageCourse(user, course) {
  if (!user || !course) return false
  if (isAdmin(user)) return true
  return isInstructor(user) && Number(course.teacher?.id) === Number(user.id)
}

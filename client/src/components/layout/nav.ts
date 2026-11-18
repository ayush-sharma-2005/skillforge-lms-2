import {
  Award,
  BarChart3,
  BookOpen,
  Building2,
  ClipboardCheck,
  Compass,
  LayoutDashboard,
  Library,
  Map,
  Route,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { UserRole } from '@/types'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  /** Pages not built yet are shown as "Soon" instead of linking to a 404. */
  soon?: boolean
}

const student: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { label: 'My Courses', to: '/my-courses', icon: BookOpen },
  { label: 'Course Catalog', to: '/courses', icon: Compass },
  { label: 'Learning Paths', to: '/learning-paths', icon: Route },
  { label: 'My Paths', to: '/my-paths', icon: Map },
  { label: 'Assignments', to: '/assignments', icon: ClipboardCheck, soon: true },
  { label: 'Certificates', to: '/certificates', icon: Award, soon: true },
]

const instructor: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { label: 'Course Catalog', to: '/courses', icon: Compass },
  { label: 'Analytics', to: '/instructor/analytics', icon: BarChart3, soon: true },
  { label: 'My Courses', to: '/instructor/courses', icon: Library, soon: true },
  { label: 'Assignments', to: '/instructor/assignments', icon: ClipboardCheck, soon: true },
]

const orgAdmin: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { label: 'Students', to: '/org/students', icon: Users, soon: true },
  { label: 'Organization', to: '/org', icon: Building2, soon: true },
]

const admin: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { label: 'Course Catalog', to: '/courses', icon: Compass },
  { label: 'Courses', to: '/admin/courses', icon: Library, soon: true },
  { label: 'Users', to: '/admin/users', icon: Users, soon: true },
]

export const navByRole: Record<UserRole, NavItem[]> = {
  student,
  instructor,
  org_admin: orgAdmin,
  admin,
}

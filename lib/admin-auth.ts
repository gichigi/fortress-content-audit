import { cookies } from 'next/headers'

export async function isAdminAuthenticated(): Promise<boolean> {
  try {
    const cookieStore = await cookies()
    const session = cookieStore.get('admin-blog-session')
    return session?.value === 'authenticated'
  } catch {
    return false
  }
}

export async function logout() {
  const cookieStore = await cookies()
  cookieStore.delete('admin-blog-session')
}


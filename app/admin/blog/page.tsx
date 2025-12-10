import { isAdminAuthenticated } from '@/lib/admin-auth'
import LoginForm from './components/LoginForm'
import BlogGenerator from './components/BlogGenerator'
import Header from '@/components/Header'

export default async function AdminBlogPage() {
  const authenticated = await isAdminAuthenticated()

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {authenticated ? (
        <BlogGenerator />
      ) : (
        <div className="container mx-auto px-4 py-16">
          <LoginForm />
        </div>
      )}
    </div>
  )
}

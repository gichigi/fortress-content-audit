// fortress v1
import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

function getBearer(request: Request): string | null {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
  if (!authHeader?.toLowerCase().startsWith('bearer ')) {
    return null
  }
  return authHeader.split(' ')[1]
}

export async function POST(request: Request) {
  try {
    const token = getBearer(request)
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user token
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token)
    if (userError || !userData?.user?.id) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const userId = userData.user.id

    // Delete the auth user using admin client
    // This will cascade delete most related data via database foreign keys
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (deleteError) {
      console.error('[AccountDelete] Error deleting user:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete account' },
        { status: 500 }
      )
    }

    console.log('[AccountDelete] User deleted successfully:', userId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[AccountDelete] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

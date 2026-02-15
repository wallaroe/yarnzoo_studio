import { supabase } from './lib/supabase'

// Test Supabase connection
async function testSupabaseConnection() {
    try {
        const { data, error } = await supabase.auth.getSession()
        if (error) {
            console.error('❌ Supabase connection error:', error.message)
            return false
        }
        console.log('✅ Supabase connected successfully!')
        console.log('Session:', data.session ? 'Active' : 'No active session')
        return true
    } catch (err) {
        console.error('❌ Unexpected error:', err)
        return false
    }
}

// Test database access
async function testDatabaseAccess() {
    try {
        const { data, error } = await supabase
            .from('workspaces')
            .select('count')

        if (error) {
            console.error('❌ Database access error:', error.message)
            return false
        }
        console.log('✅ Database accessible!')
        return true
    } catch (err) {
        console.error('❌ Database error:', err)
        return false
    }
}

export { testSupabaseConnection, testDatabaseAccess }

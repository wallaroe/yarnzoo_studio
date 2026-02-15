import { createContext, useContext, useState, useEffect } from 'react'
import { supabase, hasSupabaseConfig } from './supabaseClient'

const AuthContext = createContext({})

export const useAuth = () => {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider')
    }
    return context
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [session, setSession] = useState(null)
    const [loading, setLoading] = useState(hasSupabaseConfig)

    useEffect(() => {
        if (!hasSupabaseConfig || !supabase) return

        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session)
            setUser(session?.user ?? null)
            setLoading(false)
        })

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                setSession(session)
                setUser(session?.user ?? null)
                setLoading(false)
            }
        )

        return () => subscription.unsubscribe()
    }, [])

    const signUp = async (email, password, metadata = {}) => {
        if (!supabase) return { data: null, error: { message: 'Supabase not configured' } }
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: metadata }
        })
        return { data, error }
    }

    const signIn = async (email, password) => {
        if (!supabase) return { data: null, error: { message: 'Supabase not configured' } }
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        })
        return { data, error }
    }

    const signOut = async () => {
        if (!supabase) return { error: null }
        const { error } = await supabase.auth.signOut()
        return { error }
    }

    const resetPassword = async (email) => {
        if (!supabase) return { data: null, error: { message: 'Supabase not configured' } }
        const { data, error } = await supabase.auth.resetPasswordForEmail(email)
        return { data, error }
    }

    const value = {
        user,
        session,
        loading,
        signUp,
        signIn,
        signOut,
        resetPassword,
    }

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

import { supabase } from './supabase'

// ============================================
// CHARTS OPERATIONS
// ============================================

export async function saveChart({
    title,
    description = '',
    chartData,
    gridWidth,
    gridHeight,
    colorA,
    colorB,
    config,
    isPublic = false,
    chartId = null, // If provided, update existing chart
    expectedUpdatedAt = null, // Optional optimistic lock value
}) {
    const userId = (await supabase.auth.getUser()).data.user?.id
    if (!userId) throw new Error('User not authenticated')

    const chartPayload = {
        user_id: userId,
        title,
        description,
        chart_data: chartData,
        grid_width: gridWidth,
        grid_height: gridHeight,
        color_a: colorA,
        color_b: colorB,
        config,
        is_public: isPublic,
    }

    if (chartId) {
        // Update existing chart
        let query = supabase
            .from('charts')
            .update(chartPayload)
            .eq('id', chartId)
            .eq('user_id', userId)

        if (expectedUpdatedAt) {
            query = query.eq('updated_at', expectedUpdatedAt)
        }

        const { data, error } = await query
            .select()
            .maybeSingle()

        if (!error && !data) {
            return {
                data: null,
                error: {
                    code: 'CONFLICT',
                    message: 'Het patroon is intussen gewijzigd. Herlaad eerst de laatste versie voordat je opnieuw opslaat.',
                },
            }
        }

        return { data, error }
    } else {
        // Create new chart
        const { data, error } = await supabase
            .from('charts')
            .insert([chartPayload])
            .select()
            .single()

        return { data, error }
    }
}

export async function loadChart(chartId) {
    const { data, error } = await supabase
        .from('charts')
        .select('*')
        .eq('id', chartId)
        .single()

    return { data, error }
}

export async function loadUserCharts() {
    const userId = (await supabase.auth.getUser()).data.user?.id
    if (!userId) return { data: [], error: null }

    const { data, error } = await supabase
        .from('charts')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })

    return { data, error }
}

export async function deleteChart(chartId) {
    const userId = (await supabase.auth.getUser()).data.user?.id
    if (!userId) throw new Error('User not authenticated')

    const { error } = await supabase
        .from('charts')
        .delete()
        .eq('id', chartId)
        .eq('user_id', userId)

    return { error }
}

export async function renameChart(chartId, newTitle) {
    const userId = (await supabase.auth.getUser()).data.user?.id
    if (!userId) throw new Error('User not authenticated')

    const { data, error } = await supabase
        .from('charts')
        .update({ title: newTitle })
        .eq('id', chartId)
        .eq('user_id', userId)
        .select()
        .single()

    return { data, error }
}

export async function copyChart(chartId) {
    const userId = (await supabase.auth.getUser()).data.user?.id
    if (!userId) throw new Error('User not authenticated')

    // First, load the original chart
    const { data: original, error: loadError } = await supabase
        .from('charts')
        .select('*')
        .eq('id', chartId)
        .eq('user_id', userId)
        .single()

    if (loadError || !original) {
        return { data: null, error: loadError || new Error('Chart not found') }
    }

    // Create a copy with "Kopie van" prefix
    const copyPayload = {
        user_id: userId,
        title: `Kopie van ${original.title}`,
        description: original.description,
        chart_data: original.chart_data,
        grid_width: original.grid_width,
        grid_height: original.grid_height,
        color_a: original.color_a,
        color_b: original.color_b,
        config: original.config,
        is_public: false, // Copies start as private
    }

    const { data, error } = await supabase
        .from('charts')
        .insert([copyPayload])
        .select()
        .single()

    return { data, error }
}

// ============================================
// FOLDERS OPERATIONS
// ============================================

export async function createFolder(name, color = '#F5921B') {
    const userId = (await supabase.auth.getUser()).data.user?.id
    if (!userId) throw new Error('User not authenticated')

    const { data, error } = await supabase
        .from('folders')
        .insert([{ user_id: userId, name, color }])
        .select()
        .single()

    return { data, error }
}

export async function loadUserFolders() {
    const userId = (await supabase.auth.getUser()).data.user?.id
    if (!userId) return { data: [], error: null }

    const { data, error } = await supabase
        .from('folders')
        .select('*, chart_folders(chart_id)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

    return { data, error }
}

export async function deleteFolder(folderId) {
    const userId = (await supabase.auth.getUser()).data.user?.id
    if (!userId) throw new Error('User not authenticated')

    const { error } = await supabase
        .from('folders')
        .delete()
        .eq('id', folderId)
        .eq('user_id', userId)

    return { error }
}

export async function addChartToFolder(chartId, folderId) {
    const { data, error } = await supabase
        .from('chart_folders')
        .insert([{ chart_id: chartId, folder_id: folderId }])

    return { data, error }
}

export async function removeChartFromFolder(chartId, folderId) {
    const { error } = await supabase
        .from('chart_folders')
        .delete()
        .eq('chart_id', chartId)
        .eq('folder_id', folderId)

    return { error }
}

// ============================================
// SHARING OPERATIONS
// ============================================

export async function shareChart(chartId, options = {}) {
    const userId = (await supabase.auth.getUser()).data.user?.id
    if (!userId) throw new Error('User not authenticated')

    const { sharedWith = null, generateToken = false } = options

    const sharePayload = {
        chart_id: chartId,
        shared_by: userId,
        shared_with: sharedWith,
        share_token: generateToken ? crypto.randomUUID() : null,
    }

    const { data, error } = await supabase
        .from('shared_charts')
        .insert([sharePayload])
        .select()
        .single()

    return { data, error }
}

export async function getSharedCharts() {
    const userId = (await supabase.auth.getUser()).data.user?.id
    if (!userId) return { data: [], error: null }

    const { data, error } = await supabase
        .from('shared_charts')
        .select('*, charts(*)')
        .eq('shared_with', userId)

    return { data, error }
}

export async function getPublicCharts(limit = 20) {
    const { data, error } = await supabase
        .from('charts')
        .select('*')
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(limit)

    return { data, error }
}

export async function loadChartByShareToken(token) {
    const { data, error } = await supabase
        .from('shared_charts')
        .select('*, charts(*)')
        .eq('share_token', token)
        .single()

    return { data: data?.charts, error }
}

export async function unshareChart(shareId) {
    const userId = (await supabase.auth.getUser()).data.user?.id
    if (!userId) throw new Error('User not authenticated')

    const { error } = await supabase
        .from('shared_charts')
        .delete()
        .eq('id', shareId)
        .eq('shared_by', userId)

    return { error }
}

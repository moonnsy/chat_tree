function isGhost(m) {
    try {
        if (!m) return true;
        if (m.mes && typeof m.mes === 'string' && m.mes.trim() !== '') return false;
        if (Array.isArray(m.swipes) && m.swipes.some(s => s && typeof s === 'string' && s.trim() !== '')) return false;
        if (m.extra && typeof m.extra === 'object' && Object.keys(m.extra).length > 0) return false;
        if (m.is_system) return false;
        return true;
    } catch (e) {
        return false;
    }
}

// User says "when you try to delete all swipes"
// "messages still not deleted at all"
// Wait, if a message has 2 swipes.
// User deletes the active swipe via ST UI.
// ST natively handles swipe deletion in a specific way!

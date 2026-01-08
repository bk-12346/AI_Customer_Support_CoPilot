-- ============================================
-- Row Level Security (RLS) Policies
-- Multi-tenant isolation + role-based access
-- ============================================

-- --------------------------------------------
-- Helper function to get current user's org
-- --------------------------------------------
CREATE OR REPLACE FUNCTION auth.user_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
    SELECT organization_id FROM public.users WHERE id = auth.uid()
$$;

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT role = 'admin' FROM public.users WHERE id = auth.uid()
$$;

-- --------------------------------------------
-- Enable RLS on all tables
-- --------------------------------------------
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE zendesk_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------
-- Organizations Policies
-- --------------------------------------------
-- Users can only view their own organization
CREATE POLICY "Users can view own organization"
    ON organizations FOR SELECT
    USING (id = auth.user_organization_id());

-- Only admins can update organization settings
CREATE POLICY "Admins can update own organization"
    ON organizations FOR UPDATE
    USING (id = auth.user_organization_id() AND auth.is_admin());

-- --------------------------------------------
-- Users Policies
-- --------------------------------------------
-- Users can view members of their organization
CREATE POLICY "Users can view org members"
    ON users FOR SELECT
    USING (organization_id = auth.user_organization_id());

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
    ON users FOR UPDATE
    USING (id = auth.uid());

-- Admins can manage users in their organization
CREATE POLICY "Admins can insert users"
    ON users FOR INSERT
    WITH CHECK (organization_id = auth.user_organization_id() AND auth.is_admin());

CREATE POLICY "Admins can delete users"
    ON users FOR DELETE
    USING (organization_id = auth.user_organization_id() AND auth.is_admin() AND id != auth.uid());

-- --------------------------------------------
-- Zendesk Credentials Policies
-- --------------------------------------------
-- Only admins can view/manage Zendesk credentials
CREATE POLICY "Admins can view zendesk credentials"
    ON zendesk_credentials FOR SELECT
    USING (organization_id = auth.user_organization_id() AND auth.is_admin());

CREATE POLICY "Admins can insert zendesk credentials"
    ON zendesk_credentials FOR INSERT
    WITH CHECK (organization_id = auth.user_organization_id() AND auth.is_admin());

CREATE POLICY "Admins can update zendesk credentials"
    ON zendesk_credentials FOR UPDATE
    USING (organization_id = auth.user_organization_id() AND auth.is_admin());

CREATE POLICY "Admins can delete zendesk credentials"
    ON zendesk_credentials FOR DELETE
    USING (organization_id = auth.user_organization_id() AND auth.is_admin());

-- --------------------------------------------
-- Tickets Policies
-- --------------------------------------------
-- All org users can view tickets
CREATE POLICY "Users can view org tickets"
    ON tickets FOR SELECT
    USING (organization_id = auth.user_organization_id());

-- Service role can insert tickets (from webhook/sync)
CREATE POLICY "Service role can insert tickets"
    ON tickets FOR INSERT
    WITH CHECK (organization_id = auth.user_organization_id());

-- Users can update tickets in their org
CREATE POLICY "Users can update org tickets"
    ON tickets FOR UPDATE
    USING (organization_id = auth.user_organization_id());

-- --------------------------------------------
-- Ticket Messages Policies
-- --------------------------------------------
-- Users can view messages for org tickets
CREATE POLICY "Users can view org ticket messages"
    ON ticket_messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM tickets t
            WHERE t.id = ticket_messages.ticket_id
            AND t.organization_id = auth.user_organization_id()
        )
    );

-- Users can insert messages (replies)
CREATE POLICY "Users can insert ticket messages"
    ON ticket_messages FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM tickets t
            WHERE t.id = ticket_messages.ticket_id
            AND t.organization_id = auth.user_organization_id()
        )
    );

-- --------------------------------------------
-- Knowledge Articles Policies
-- --------------------------------------------
-- All org users can view knowledge articles
CREATE POLICY "Users can view org knowledge"
    ON knowledge_articles FOR SELECT
    USING (organization_id = auth.user_organization_id());

-- Admins can manage knowledge articles
CREATE POLICY "Admins can insert knowledge"
    ON knowledge_articles FOR INSERT
    WITH CHECK (organization_id = auth.user_organization_id() AND auth.is_admin());

CREATE POLICY "Admins can update knowledge"
    ON knowledge_articles FOR UPDATE
    USING (organization_id = auth.user_organization_id() AND auth.is_admin());

CREATE POLICY "Admins can delete knowledge"
    ON knowledge_articles FOR DELETE
    USING (organization_id = auth.user_organization_id() AND auth.is_admin());

-- --------------------------------------------
-- AI Drafts Policies
-- --------------------------------------------
-- Users can view drafts for org tickets
CREATE POLICY "Users can view org drafts"
    ON ai_drafts FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM tickets t
            WHERE t.id = ai_drafts.ticket_id
            AND t.organization_id = auth.user_organization_id()
        )
    );

-- Users can create drafts
CREATE POLICY "Users can create drafts"
    ON ai_drafts FOR INSERT
    WITH CHECK (
        created_by = auth.uid()
        AND EXISTS (
            SELECT 1 FROM tickets t
            WHERE t.id = ai_drafts.ticket_id
            AND t.organization_id = auth.user_organization_id()
        )
    );

-- Users can update drafts they created or review any draft
CREATE POLICY "Users can update drafts"
    ON ai_drafts FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM tickets t
            WHERE t.id = ai_drafts.ticket_id
            AND t.organization_id = auth.user_organization_id()
        )
    );

-- --------------------------------------------
-- Audit Logs Policies
-- --------------------------------------------
-- Admins can view audit logs for their org
CREATE POLICY "Admins can view org audit logs"
    ON audit_logs FOR SELECT
    USING (organization_id = auth.user_organization_id() AND auth.is_admin());

-- All authenticated users can insert audit logs (via triggers/functions)
CREATE POLICY "Users can insert audit logs"
    ON audit_logs FOR INSERT
    WITH CHECK (organization_id = auth.user_organization_id());

-- --------------------------------------------
-- Grant access to authenticated users
-- --------------------------------------------
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

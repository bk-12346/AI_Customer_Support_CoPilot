-- ============================================
-- Schema Additions for MVP
-- Migration: 004_schema_additions.sql
-- ============================================

-- --------------------------------------------
-- 1. Add 'sent' status to drafts
-- --------------------------------------------
ALTER TYPE draft_status ADD VALUE 'sent';

-- --------------------------------------------
-- 2. Add 'generated' source to knowledge articles
-- (for Bitext-generated FAQ articles)
-- --------------------------------------------
ALTER TYPE knowledge_source ADD VALUE 'generated';

-- --------------------------------------------
-- 3. Add tracking fields to ai_drafts
-- --------------------------------------------
ALTER TABLE ai_drafts
ADD COLUMN was_edited BOOLEAN DEFAULT false,
ADD COLUMN sent_at TIMESTAMPTZ;

-- --------------------------------------------
-- 4. Add slug to organizations
-- --------------------------------------------
ALTER TABLE organizations
ADD COLUMN slug TEXT UNIQUE;

CREATE INDEX idx_organizations_slug ON organizations(slug);

-- --------------------------------------------
-- 5. Sync State table (for incremental sync)
-- --------------------------------------------
CREATE TYPE sync_type AS ENUM ('tickets', 'kb_articles');
CREATE TYPE sync_status AS ENUM ('idle', 'running', 'failed');

CREATE TABLE sync_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    sync_type sync_type NOT NULL,
    last_sync_at TIMESTAMPTZ,
    last_synced_cursor TEXT,
    status sync_status NOT NULL DEFAULT 'idle',
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(organization_id, sync_type)
);

CREATE INDEX idx_sync_state_organization ON sync_state(organization_id);

-- Apply updated_at trigger
CREATE TRIGGER update_sync_state_updated_at
    BEFORE UPDATE ON sync_state
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- --------------------------------------------
-- 6. RLS for sync_state
-- --------------------------------------------
ALTER TABLE sync_state ENABLE ROW LEVEL SECURITY;

-- Admins can view sync state for their org
CREATE POLICY "Admins can view sync state"
    ON sync_state FOR SELECT
    USING (organization_id = public.get_user_organization_id() AND public.is_user_admin());

-- Admins can manage sync state
CREATE POLICY "Admins can insert sync state"
    ON sync_state FOR INSERT
    WITH CHECK (organization_id = public.get_user_organization_id() AND public.is_user_admin());

CREATE POLICY "Admins can update sync state"
    ON sync_state FOR UPDATE
    USING (organization_id = public.get_user_organization_id() AND public.is_user_admin());

CREATE POLICY "Admins can delete sync state"
    ON sync_state FOR DELETE
    USING (organization_id = public.get_user_organization_id() AND public.is_user_admin());

-- Grant access
GRANT ALL ON sync_state TO authenticated;

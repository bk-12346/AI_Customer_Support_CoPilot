-- ============================================
-- Security Fixes
-- Migration: 005_security_fixes.sql
-- Fixes: mutable search_path warnings
-- ============================================

-- --------------------------------------------
-- 1. Fix get_user_organization_id search_path
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT organization_id FROM public.users WHERE id = auth.uid()
$$;

-- --------------------------------------------
-- 2. Fix is_user_admin search_path
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.is_user_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(
        (SELECT role = 'admin' FROM public.users WHERE id = auth.uid()),
        false
    )
$$;

-- --------------------------------------------
-- 3. Fix update_updated_at_column search_path
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- --------------------------------------------
-- 4. Fix match_knowledge search_path
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.match_knowledge(
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.7,
    match_count int DEFAULT 5,
    org_id uuid DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    title text,
    content text,
    source knowledge_source,
    similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ka.id,
        ka.title,
        ka.content,
        ka.source,
        1 - (ka.embedding <=> query_embedding) AS similarity
    FROM public.knowledge_articles ka
    WHERE
        ka.embedding IS NOT NULL
        AND (org_id IS NULL OR ka.organization_id = org_id)
        AND 1 - (ka.embedding <=> query_embedding) > match_threshold
    ORDER BY ka.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- --------------------------------------------
-- 5. Fix match_similar_tickets search_path
-- --------------------------------------------
CREATE OR REPLACE FUNCTION public.match_similar_tickets(
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.7,
    match_count int DEFAULT 3,
    org_id uuid DEFAULT NULL,
    exclude_ticket_id uuid DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    subject text,
    status text,
    similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.id,
        t.subject,
        t.status,
        1 - (t.embedding <=> query_embedding) AS similarity
    FROM public.tickets t
    WHERE
        t.embedding IS NOT NULL
        AND (org_id IS NULL OR t.organization_id = org_id)
        AND (exclude_ticket_id IS NULL OR t.id != exclude_ticket_id)
        AND t.status IN ('solved', 'closed')
        AND 1 - (t.embedding <=> query_embedding) > match_threshold
    ORDER BY t.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- --------------------------------------------
-- Note: Moving pgvector extension to a separate schema
-- is more complex and may break existing references.
-- For MVP, keeping it in public is acceptable.
-- To move it later:
--   CREATE SCHEMA IF NOT EXISTS extensions;
--   ALTER EXTENSION vector SET SCHEMA extensions;
--   Then update search_path in functions that use vector
-- --------------------------------------------

-- ============================================
-- Enable pgvector for RAG embeddings
-- ============================================

-- Enable the vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- --------------------------------------------
-- Add embedding column to knowledge_articles
-- Using 1536 dimensions (OpenAI text-embedding-3-small)
-- --------------------------------------------
ALTER TABLE knowledge_articles
ADD COLUMN embedding vector(1536);

-- Create index for fast similarity search
-- Using HNSW index for better performance on larger datasets
CREATE INDEX idx_knowledge_articles_embedding
ON knowledge_articles
USING hnsw (embedding vector_cosine_ops);

-- --------------------------------------------
-- Similarity search function
-- --------------------------------------------
CREATE OR REPLACE FUNCTION match_knowledge(
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
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ka.id,
        ka.title,
        ka.content,
        ka.source,
        1 - (ka.embedding <=> query_embedding) AS similarity
    FROM knowledge_articles ka
    WHERE
        ka.embedding IS NOT NULL
        AND (org_id IS NULL OR ka.organization_id = org_id)
        AND 1 - (ka.embedding <=> query_embedding) > match_threshold
    ORDER BY ka.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- --------------------------------------------
-- Optional: Add embedding to tickets for similar ticket search
-- --------------------------------------------
ALTER TABLE tickets
ADD COLUMN embedding vector(1536);

CREATE INDEX idx_tickets_embedding
ON tickets
USING hnsw (embedding vector_cosine_ops);

-- Function to find similar past tickets
CREATE OR REPLACE FUNCTION match_similar_tickets(
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
AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.id,
        t.subject,
        t.status,
        1 - (t.embedding <=> query_embedding) AS similarity
    FROM tickets t
    WHERE
        t.embedding IS NOT NULL
        AND (org_id IS NULL OR t.organization_id = org_id)
        AND (exclude_ticket_id IS NULL OR t.id != exclude_ticket_id)
        AND t.status IN ('solved', 'closed')  -- Only match resolved tickets
        AND 1 - (t.embedding <=> query_embedding) > match_threshold
    ORDER BY t.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

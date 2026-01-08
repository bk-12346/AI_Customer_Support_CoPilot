-- ============================================
-- Development Seed Data
-- Run with: supabase db reset
-- ============================================

-- Create a test organization
INSERT INTO organizations (id, name, zendesk_subdomain)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Acme Corp',
    'acme'
);

-- Note: Users must be created through Supabase Auth
-- After creating a user via signup, run this to link them:
--
-- INSERT INTO users (id, email, name, organization_id, role)
-- VALUES (
--     '<auth.users.id>',
--     'admin@acme.com',
--     'Admin User',
--     '00000000-0000-0000-0000-000000000001',
--     'admin'
-- );

-- Sample knowledge articles
INSERT INTO knowledge_articles (organization_id, title, content, source)
VALUES
(
    '00000000-0000-0000-0000-000000000001',
    'How to reset your password',
    'To reset your password, follow these steps:
1. Go to the login page
2. Click "Forgot Password"
3. Enter your email address
4. Check your inbox for a reset link
5. Click the link and enter a new password

If you don''t receive the email within 5 minutes, check your spam folder.',
    'upload'
),
(
    '00000000-0000-0000-0000-000000000001',
    'Refund Policy',
    'Our refund policy allows returns within 30 days of purchase.

Conditions for refund:
- Item must be unused and in original packaging
- Receipt or proof of purchase required
- Digital products are non-refundable after download

To request a refund:
1. Contact support with your order number
2. Explain the reason for return
3. We''ll provide return instructions
4. Refund processed within 5-7 business days after receiving the item',
    'upload'
),
(
    '00000000-0000-0000-0000-000000000001',
    'Shipping Information',
    'We offer the following shipping options:

Standard Shipping (5-7 business days): Free on orders over $50
Express Shipping (2-3 business days): $9.99
Next Day Delivery: $19.99

International shipping is available to select countries. Delivery times vary by destination.

Track your order using the tracking number sent to your email after shipment.',
    'upload'
);

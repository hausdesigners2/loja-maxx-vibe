-- =============================================================================
-- SCRIPT DE POPULAÇÃO INICIAL (SEED) - LOJAS MAXX
-- Execute este script no SQL Editor do seu painel do Supabase para restaurar os produtos
-- =============================================================================

-- 1. Inserir Categorias Padrão
INSERT INTO public.categories (id, name, slug, icon, sort_order) VALUES
('c1111111-1111-1111-1111-111111111111', 'Cereais e Grãos', 'cereais-e-graos', '🌾', 1),
('c2222222-2222-2222-2222-222222222222', 'Massas', 'massas', '🍝', 2),
('c3333333-3333-3333-3333-333333333333', 'Bebidas', 'bebidas', '🥤', 3),
('c4444444-4444-4444-4444-444444444444', 'Laticínios', 'laticinios', '🧀', 4),
('c5555555-5555-5555-5555-555555555555', 'Limpeza', 'limpeza', '🧹', 5)
ON CONFLICT (slug) DO NOTHING;

-- 2. Inserir Produtos Padrão
INSERT INTO public.products (name, description, price, discount_percent, is_best_seller, is_featured, stock, image_url, category_id, active) VALUES
('Arroz Integral Tipo 1 - 1kg', 'Arroz integral de alta qualidade, rico em fibras.', 8.90, 0, true, true, 100, 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500&q=80', 'c1111111-1111-1111-1111-111111111111', true),
('Feijão Carioca Tipo 1 - 1kg', 'Feijão carioca novo, cozinha rápido e rende muito.', 7.50, 10, true, true, 150, 'https://images.unsplash.com/photo-1551462147-ff29053bfc14?w=500&q=80', 'c1111111-1111-1111-1111-111111111111', true),
('Macarrão Espaguete Sêmola - 500g', 'Macarrão espaguete perfeito para o seu almoço de domingo.', 4.20, 0, false, true, 200, 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=500&q=80', 'c2222222-2222-2222-2222-222222222222', true),
('Azeite de Oliva Extra Virgem - 500ml', 'Azeite de oliva extra virgem importado, acidez máxima 0.5%.', 32.90, 15, true, true, 50, 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=500&q=80', 'c1111111-1111-1111-1111-111111111111', true),
('Suco de Uva Integral - 1L', 'Suco de uva 100% integral, sem adição de açúcares ou conservantes.', 14.90, 0, false, false, 80, 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=500&q=80', 'c3333333-3333-3333-3333-333333333333', true)
ON CONFLICT DO NOTHING;

-- 3. Inserir Banners de Destaque
INSERT INTO public.banners (title, subtitle, image_url, link_url, button_text, active, sort_order) VALUES
('Super Ofertas da Semana', 'Aproveite descontos exclusivos em cereais e bebidas com entrega rápida!', 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=1200&q=80', '/categoria/cereais-e-graos', 'Ver Ofertas', true, 1),
('Sua Dispensa Sempre Cheia', 'Compre pelo WhatsApp e receba no conforto da sua casa.', 'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=1200&q=80', '/', 'Comprar Agora', true, 2)
ON CONFLICT DO NOTHING;
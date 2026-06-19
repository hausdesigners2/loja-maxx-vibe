export const SEED_CATEGORIES = [
  { name: "Cereais e Grãos", slug: "cereais-e-graos", icon: "🌾", sort_order: 1 },
  { name: "Massas e Molhos", slug: "massas-e-molhos", icon: "🍝", sort_order: 2 },
  { name: "Bebidas", slug: "bebidas", icon: "🥤", sort_order: 3 },
  { name: "Laticínios", slug: "laticinios", icon: "🧀", sort_order: 4 },
  { name: "Higiene e Limpeza", slug: "higiene-e-limpeza", icon: "🧼", sort_order: 5 },
];

export const SEED_PRODUCTS = [
  {
    name: "Arroz Integral Tipo 1 - 1kg",
    description: "Arroz integral de alta qualidade, rico em fibras e nutrientes para uma alimentação saudável.",
    price: 7.90,
    discount_percent: 10,
    category_slug: "cereais-e-graos",
    image_url: "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600&auto=format&fit=crop&q=80",
    is_best_seller: true,
    is_featured: true,
    stock: 100,
    active: true
  },
  {
    name: "Feijão Carioca Especial - 1kg",
    description: "Feijão carioca novo, selecionado e de cozimento rápido. Perfeito para o dia a dia.",
    price: 8.50,
    discount_percent: 0,
    category_slug: "cereais-e-graos",
    image_url: "https://images.unsplash.com/photo-1551462147-ff29053bfc14?w=600&auto=format&fit=crop&q=80",
    is_best_seller: true,
    is_featured: false,
    stock: 120,
    active: true
  },
  {
    name: "Macarrão Espaguete Semola - 500g",
    description: "Macarrão espaguete de sêmola de trigo duro, fica soltinho e al dente.",
    price: 4.20,
    discount_percent: 0,
    category_slug: "massas-e-molhos",
    image_url: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&auto=format&fit=crop&q=80",
    is_best_seller: false,
    is_featured: true,
    stock: 150,
    active: true
  },
  {
    name: "Molho de Tomate Tradicional - 340g",
    description: "Molho de tomate encorpado e saboroso, feito com tomates selecionados e ervas finas.",
    price: 3.10,
    discount_percent: 15,
    category_slug: "massas-e-molhos",
    image_url: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80",
    is_best_seller: true,
    is_featured: true,
    stock: 200,
    active: true
  },
  {
    name: "Suco de Uva Integral - 1L",
    description: "Suco de uva 100% integral, sem adição de açúcares ou conservantes.",
    price: 14.90,
    discount_percent: 5,
    category_slug: "bebidas",
    image_url: "https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=600&auto=format&fit=crop&q=80",
    is_best_seller: true,
    is_featured: true,
    stock: 80,
    active: true
  },
  {
    name: "Refrigerante Guaraná - 2L",
    description: "Refrigerante de guaraná natural, super refrescante para acompanhar suas refeições.",
    price: 8.90,
    discount_percent: 0,
    category_slug: "bebidas",
    image_url: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=600&auto=format&fit=crop&q=80",
    is_best_seller: false,
    is_featured: false,
    stock: 300,
    active: true
  },
  {
    name: "Queijo Prato Fatiado - 150g",
    description: "Queijo prato fatiado fino, ideal para lanches, derrete super fácil.",
    price: 9.80,
    discount_percent: 0,
    category_slug: "laticinios",
    image_url: "https://images.unsplash.com/photo-1486299267070-8382e214434b?w=600&auto=format&fit=crop&q=80",
    is_best_seller: true,
    is_featured: true,
    stock: 50,
    active: true
  },
  {
    name: "Iogurte Natural Desnatado - 170g",
    description: "Iogurte natural desnatado, cremoso e saudável, sem adição de açúcares.",
    price: 2.90,
    discount_percent: 0,
    category_slug: "laticinios",
    image_url: "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=600&auto=format&fit=crop&q=80",
    is_best_seller: false,
    is_featured: false,
    stock: 90,
    active: true
  }
];
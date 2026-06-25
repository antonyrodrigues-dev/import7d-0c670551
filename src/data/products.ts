import p1 from "@/assets/product-1.jpg";
import p2 from "@/assets/product-2.jpg";
import p3 from "@/assets/product-3.jpg";
import p4 from "@/assets/product-4.jpg";
import p5 from "@/assets/product-5.jpg";
import p6 from "@/assets/product-6.jpg";

export interface Product {
  slug: string;
  name: string;
  description: string;
  category: string;
  price: number;
  sizes: readonly string[];
  image: string;
  featured?: boolean;
}

export const PRODUCTS: Product[] = [
  { slug: "vestido-esmeralda-seda", name: "Vestido Esmeralda", description: "Seda fluida com drapeado lateral. Peça única em verde esmeralda, evocando a sofisticação de um jardim privado ao entardecer.", category: "Vestidos", price: 1890, sizes: ["P", "M", "G"], image: p1, featured: true },
  { slug: "blazer-cru-estruturado", name: "Blazer Cru", description: "Lã virgem italiana em corte sartorial. Ombro estruturado, forro em cupro, abotoamento duplo discreto.", category: "Alfaiataria", price: 2640, sizes: ["36", "38", "40", "42"], image: p2, featured: true },
  { slug: "slip-dress-noir", name: "Slip Dress Noir", description: "Cetim de seda em corte enviesado. Alças finas reguláveis, costura francesa, caimento líquido.", category: "Vestidos", price: 1450, sizes: ["P", "M", "G"], image: p3 },
  { slug: "casaco-camelo", name: "Casaco Camelo", description: "Cashmere puro escovado à mão. Silhueta longa, lapelas amplas, botões em corozo natural.", category: "Casacos", price: 4280, sizes: ["P", "M", "G"], image: p4, featured: true },
  { slug: "blusa-veludo-borgonha", name: "Blusa Veludo Borgonha", description: "Veludo de algodão e seda em borgonha profundo. Mangas estruturadas, gola alta envolvente.", category: "Blusas", price: 1180, sizes: ["P", "M", "G"], image: p5 },
  { slug: "saia-linho-marfim", name: "Saia Linho Marfim", description: "Linho belga lavado em marfim. Cintura alta, movimento amplo, comprimento midi.", category: "Saias", price: 980, sizes: ["36", "38", "40", "42"], image: p6 },
];

export const formatBRL = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 });
import m1a from "@/assets/product-m1a.jpg.asset.json";
import m1b from "@/assets/product-m1b.jpg.asset.json";
import m2a from "@/assets/product-m2a.jpg.asset.json";
import m2b from "@/assets/product-m2b.jpg.asset.json";
import m3a from "@/assets/product-m3a.jpg.asset.json";
import m3b from "@/assets/product-m3b.jpg.asset.json";
import m4a from "@/assets/product-m4a.jpg.asset.json";
import m4b from "@/assets/product-m4b.jpg.asset.json";
import m5a from "@/assets/product-m5a.jpg.asset.json";
import m5b from "@/assets/product-m5b.jpg.asset.json";
import m6a from "@/assets/product-m6a.jpg.asset.json";
import m6b from "@/assets/product-m6b.jpg.asset.json";

export interface Product {
  slug: string;
  name: string;
  description: string;
  category: string;
  price: number;
  sizes: readonly string[];
  image: string;
  imageAlt: string;
  featured?: boolean;
}

export const PRODUCTS: Product[] = [
  { slug: "polo-piquet-marfim", name: "Polo Piquet Marfim", description: "Polo masculina em algodão piquet de alta gramatura. Gola estruturada, abotoamento em madrepérola, corte regular.", category: "Polos", price: 690, sizes: ["P", "M", "G", "GG"], image: m1a.url, imageAlt: m1b.url, featured: true },
  { slug: "camisa-oxford-azul", name: "Camisa Oxford Azul", description: "Oxford italiano em fio 80. Colarinho semi-italiano, punho duplo, costura francesa interna.", category: "Camisas", price: 890, sizes: ["P", "M", "G", "GG"], image: m2a.url, imageAlt: m2b.url, featured: true },
  { slug: "jaqueta-couro-conhaque", name: "Jaqueta Couro Conhaque", description: "Couro bovino curtido vegetal em conhaque. Forro em algodão, zíper metálico antique, gola ribana.", category: "Jaquetas", price: 3290, sizes: ["P", "M", "G", "GG"], image: m3a.url, imageAlt: m3b.url, featured: true },
  { slug: "polo-oliva-tipped", name: "Polo Oliva Tipped", description: "Polo em algodão pima oliva com detalhe contrastante na gola. Caimento ajustado, acabamento sartorial.", category: "Polos", price: 720, sizes: ["P", "M", "G", "GG"], image: m4a.url, imageAlt: m4b.url },
  { slug: "camisa-linho-marfim", name: "Camisa Linho Marfim", description: "Linho belga em marfim. Caimento solto, mangas longas com punho simples, botões em corozo natural.", category: "Camisas", price: 980, sizes: ["P", "M", "G", "GG"], image: m5a.url, imageAlt: m5b.url },
  { slug: "bomber-onix", name: "Bomber Ônix", description: "Bomber em nylon técnico preto. Gola e punhos em ribana, zíper duplo, bolsos embutidos.", category: "Jaquetas", price: 1490, sizes: ["P", "M", "G", "GG"], image: m6a.url, imageAlt: m6b.url },
];

export const formatBRL = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 });
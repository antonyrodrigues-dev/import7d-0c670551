import { beforeEach, describe, expect, it } from "vitest";
import { useCatalogStore } from "@/features/catalog";
import { useReserva } from "@/store/reserva";
import type { PublicProduct } from "@/features/catalog";

const produto = (over: Partial<PublicProduct> = {}): PublicProduct =>
  ({
    slug: "polo-x",
    name: "Polo Oficial",
    price: 299,
    image: "a.jpg",
    images: ["a.jpg"],
    sizes: ["M", "G"],
    stockBySize: { M: 2, G: 0 },
    brand: "7D",
    category: "polos",
    description: "",
    stock: 2,
    compravel: true,
    reservavel: true,
    tamanhoConfirmado: true,
    precoConfirmado: true,
    ...over,
  }) as PublicProduct;

beforeEach(() => {
  useReserva.setState({ items: [] });
  useCatalogStore.setState({ products: [produto()] });
});

describe("carrinho × catálogo oficial", () => {
  it("descarta item cujo produto não existe mais", () => {
    useReserva.setState({
      items: [
        {
          slug: "fantasma",
          name: "X",
          price: 10,
          image: "",
          size: "M",
          quantity: 1,
          precoPendente: false,
          tamanhoPendente: false,
        },
      ],
    });
    useReserva.getState().syncWithCatalog();
    expect(useReserva.getState().items).toHaveLength(0);
  });

  it("descarta tamanho esgotado e corrige preço/nome defasados", () => {
    useReserva.setState({
      items: [
        {
          slug: "polo-x",
          name: "Nome Velho",
          price: 1,
          image: "",
          size: "M",
          quantity: 1,
          precoPendente: false,
          tamanhoPendente: false,
        },
        {
          slug: "polo-x",
          name: "Nome Velho",
          price: 1,
          image: "",
          size: "G",
          quantity: 1,
          precoPendente: false,
          tamanhoPendente: false,
        },
      ],
    });
    useReserva.getState().syncWithCatalog();
    const items = useReserva.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ size: "M", name: "Polo Oficial", price: 299 });
  });

  it("limita quantidade ao estoque real do tamanho", () => {
    useReserva.setState({
      items: [
        {
          slug: "polo-x",
          name: "Polo Oficial",
          price: 299,
          image: "a.jpg",
          size: "M",
          quantity: 9,
          precoPendente: false,
          tamanhoPendente: false,
        },
      ],
    });
    useReserva.getState().syncWithCatalog();
    expect(useReserva.getState().items[0].quantity).toBe(2);
  });

  it("nunca adiciona tamanho sem estoque", () => {
    useReserva.getState().addItem(produto(), "G", 1);
    expect(useReserva.getState().items).toHaveLength(0);
  });

  it("peça sob consulta entra no mesmo funil, com pendências marcadas", () => {
    const sobConsulta = produto({
      slug: "sob-consulta",
      sizes: [],
      stockBySize: {},
      stock: 0,
      tamanhoConfirmado: false,
      precoConfirmado: false,
      compravel: false,
      price: 0,
    });
    useCatalogStore.setState({ products: [sobConsulta] });
    useReserva.getState().addItem(sobConsulta, "", 3);
    const [item] = useReserva.getState().items;
    expect(item).toMatchObject({
      slug: "sob-consulta",
      size: "",
      quantity: 1,
      price: 0,
      precoPendente: true,
      tamanhoPendente: true,
    });
  });
});

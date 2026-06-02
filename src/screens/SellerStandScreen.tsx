import { Link, useParams } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { AfriSellIcon } from '../components/AfriSellIcon';
import { toCheckoutProduct, useAfriMarket } from '../hooks/useAfriMarket';

export default function SellerStandScreen() {
  const { sellerId = '' } = useParams();
  const { marketProducts, abcContents, loading } = useAfriMarket();
  const products = [...marketProducts, ...abcContents.filter((item) => item.isSellable)]
    .filter((product, index, all) => product.authorId === sellerId && all.findIndex((item) => item.id === product.id) === index);
  const seller = products[0];

  return (
    <main className="min-h-full bg-black px-4 pb-24 pt-4 text-white">
      <header className="flex items-center justify-between">
        <Link to="/market" className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-[#15EA3E]" aria-label="Retour">
          <AfriSellIcon name="arrow" size={18} className="rotate-180" />
        </Link>
        <div className="text-right">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#15EA3E]">Stand vendeur</p>
          <h1 className="mt-1 text-xl font-black">Market</h1>
        </div>
      </header>

      <section className="relative mt-5 overflow-hidden rounded-[1.6rem] border border-[#15EA3E]/20 bg-[#0A0F0A] p-5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_18%,rgba(21,234,62,0.18),transparent_34%)]" />
        <div className="relative z-10 flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-[#15EA3E]/10 text-[#15EA3E]">
            {seller?.authorAvatar ? (
              <img src={seller.authorAvatar} alt="" className="h-full w-full object-cover" />
            ) : (
              <AfriSellIcon name="market" size={26} />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#15EA3E]">Stand verifie</p>
            <h2 className="mt-1 truncate text-2xl font-black">{seller?.authorName || 'Stand AfriSell'}</h2>
            <p className="mt-1 text-xs font-semibold text-white/48">{products.length} Vitrine{products.length > 1 ? 's' : ''} active{products.length > 1 ? 's' : ''}</p>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="mt-10 text-center text-sm font-black uppercase tracking-wide text-white/45">Chargement du Stand</div>
      ) : products.length ? (
        <section className="mt-5 grid grid-cols-2 gap-3">
          {products.map((product) => (
            <ProductCard key={product.id} product={toCheckoutProduct(product)} />
          ))}
        </section>
      ) : (
        <section className="mt-6 rounded-[1.3rem] border border-white/10 bg-white/[0.04] p-6 text-center">
          <p className="text-sm font-black">Stand vide</p>
          <p className="mt-2 text-xs font-semibold text-white/45">Aucune Vitrine active pour ce vendeur.</p>
        </section>
      )}
    </main>
  );
}

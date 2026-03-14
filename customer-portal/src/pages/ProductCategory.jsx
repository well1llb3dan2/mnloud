import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { productService } from '../services';
import { ProductCard } from '../components';

const ProductCategory = () => {
  const { category } = useParams();

  const { data, isLoading, error } = useQuery({
    queryKey: ['products', category],
    queryFn: productService.getAllProducts,
  });

  console.log('ProductCategory render:', { category, data, isLoading, error });

  if (isLoading) {
    return (
      <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
        <div className="panel">Loading...</div>
      </div>
    );
  }

  if (error) {
    console.error('ProductCategory error:', error);
    return (
      <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
        <div className="panel">Error loading products: {error.message}</div>
      </div>
    );
  }

  const { flowers = [], disposables = [], concentrates = [], edibles = [] } = data || {};

  let products = [];

  switch (category) {
    case 'flower':
      products = flowers.map((p) => ({ ...p, _type: 'flower' }));
      break;
    case 'disposables':
      products = disposables.map((p) => ({ ...p, _type: 'disposable' }));
      break;
    case 'concentrates':
      products = concentrates.map((p) => ({ ...p, _type: 'concentrate' }));
      break;
    case 'edibles':
      products = edibles.map((p) => ({ ...p, _type: 'edible' }));
      break;
    default:
      break;
  }

  return (
    <section className="page">
      {products.length === 0 ? (
        <div className="panel" style={{ marginTop: 16, textAlign: 'center' }}>
          No products available
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginTop: 16 }}>
          {products.map((product) => (
            <ProductCard
              key={product._id}
              product={product}
              type={product._type}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export default ProductCategory;

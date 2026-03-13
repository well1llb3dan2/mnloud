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

  const { bulkFlowers = [], packagedFlowers = [], concentrates = [], edibles = [] } = data || {};

  let products = [];
  let headerImage = '';

  switch (category) {
    case 'flower':
      products = bulkFlowers.map((p) => ({ ...p, _type: 'bulk' }));
      headerImage = '/images/delistyleflower-button.png';
      break;
    case 'packaged':
      products = packagedFlowers.map((p) => ({ ...p, _type: 'packaged' }));
      headerImage = '/images/prepackflower-button.png';
      break;
    case 'concentrates':
      products = concentrates.map((p) => ({ ...p, _type: 'concentrate' }));
      headerImage = '/images/concentrate-button.png';
      break;
    case 'edibles':
      products = edibles.map((p) => ({ ...p, _type: 'edible' }));
      headerImage = '/images/edible-button.png';
      break;
    default:
      headerImage = '';
  }

  return (
    <section className="page">
      {headerImage ? (
        <img className="category-image" src={headerImage} alt="" />
      ) : null}

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
              categoryLabel={
                product._type === 'bulk'
                  ? 'Deli-pack flower'
                  : product._type === 'packaged'
                    ? 'Pre-pack flower'
                    : undefined
              }
            />
          ))}
        </div>
      )}
    </section>
  );
};

export default ProductCategory;

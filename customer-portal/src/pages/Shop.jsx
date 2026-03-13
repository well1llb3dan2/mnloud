import { useNavigate } from 'react-router-dom';

const CategoryCard = ({ title, path, imageSrc }) => {
  const navigate = useNavigate();

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      navigate(path);
    }
  };

  return (
    <div
      className="category-card"
      onClick={() => navigate(path)}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      <img className="category-image" src={imageSrc} alt={title} />
    </div>
  );
};

const Shop = () => {
  return (
    <section className="page">
      <img
        src="/images/choose_catagory.png"
        alt="Select Category"
        className="page-header-img"
      />
      <div className="category-grid">
        <CategoryCard
          title="Deli-pack flower"
          path="/products/flower"
          imageSrc="/images/delistyleflower-button.png"
        />
        <CategoryCard
          title="Pre-pack Flower"
          path="/products/packaged"
          imageSrc="/images/prepackflower-button.png"
        />
        <CategoryCard
          title="Concentrates"
          path="/products/concentrates"
          imageSrc="/images/concentrate-button.png"
        />
        <CategoryCard
          title="Edibles"
          path="/products/edibles"
          imageSrc="/images/edible-button.png"
        />
      </div>
    </section>
  );
};

export default Shop;
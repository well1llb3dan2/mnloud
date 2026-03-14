import { useNavigate } from 'react-router-dom';

const categories = [
  { title: 'Flower', emoji: '\u{1F33F}', path: '/products/flower', color: '#48BB78' },
  { title: 'Disposables', emoji: '\u{1F4A8}', path: '/products/disposables', color: '#4DD0E1' },
  { title: 'Concentrates', emoji: '\u{1F9EA}', path: '/products/concentrates', color: '#B39DDB' },
  { title: 'Edibles', emoji: '\u{1F36C}', path: '/products/edibles', color: '#FFB74D' },
];

const CategoryCard = ({ title, emoji, path, color }) => {
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
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: 24,
        borderLeft: `4px solid ${color}`,
        cursor: 'pointer',
      }}
    >
      <span style={{ fontSize: 48 }}>{emoji}</span>
      <strong style={{ fontSize: 18 }}>{title}</strong>
    </div>
  );
};

const Shop = () => {
  return (
    <section className="page">
      <h2 style={{ textAlign: 'center', marginBottom: 16 }}>Choose a Category</h2>
      <div className="category-grid">
        {categories.map((cat) => (
          <CategoryCard key={cat.path} {...cat} />
        ))}
      </div>
    </section>
  );
};

export default Shop;
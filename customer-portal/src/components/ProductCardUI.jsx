import { useEffect, useRef, useState } from 'react';
import { useCartStore } from '../stores';
import { useConfirmDialog } from './ConfirmDialog';
import { useToast } from './ToastProvider';

const getImageUrl = (image) => {
  if (!image) return '/icons/icon-512x512.png';
  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  const apiBase = (import.meta.env.VITE_API_URL || (isLocalhost ? '' : 'https://api.mnloud.com'))
    .replace(/\/?api\/?$/, '');
  return `${apiBase}/uploads/${image.replace('uploads/', '')}`;
};

const getVideoUrl = (video) => {
  if (!video) return null;
  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  const apiBase = (import.meta.env.VITE_API_URL || (isLocalhost ? '' : 'https://api.mnloud.com'))
    .replace(/\/?api\/?$/, '');
  return `${apiBase}/uploads/${video.replace('uploads/', '')}`;
};

const Modal = ({ open, onClose, children, fullscreen = false }) => {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className={`modal${fullscreen ? ' fullscreen' : ''}`}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
};

const ProductCardUI = ({ product, type, categoryLabel }) => {
  const addItem = useCartStore((state) => state.addItem);
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const toast = useToast();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [selectedBulkTier, setSelectedBulkTier] = useState(null);
  const [selectedStrainId, setSelectedStrainId] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const videoRef = useRef(null);
  const loopCountRef = useRef(0);

  const imageUrl = product.imageUrl || getImageUrl(product.image);
  const videoUrl = product.videoUrl || getVideoUrl(product.video);
  const strainName = product.strain || product.name;
  const prices = product.priceTier?.prices || [];
  const activeTier = selectedBulkTier || prices[0] || null;

  const activeStrains = product.strains?.filter((strain) => strain.isActive) || [];
  const selectedStrain = activeStrains.find((strain) => strain._id === selectedStrainId)
    || activeStrains[0]
    || null;
  const activeVariants = product.variants?.filter((variant) => variant.isActive !== false) || [];
  const selectedVariant = activeVariants.find((variant) => variant._id === selectedVariantId)
    || activeVariants[0]
    || null;

  useEffect(() => {
    if (!selectedStrainId && activeStrains.length > 0) {
      setSelectedStrainId(activeStrains[0]._id);
    }
    if (selectedStrainId && activeStrains.length > 0) {
      const exists = activeStrains.some((strain) => strain._id === selectedStrainId);
      if (!exists) {
        setSelectedStrainId(activeStrains[0]._id);
      }
    }
  }, [activeStrains, selectedStrainId]);

  useEffect(() => {
    if (!selectedVariantId && activeVariants.length > 0) {
      setSelectedVariantId(activeVariants[0]._id);
    }
    if (selectedVariantId && activeVariants.length > 0) {
      const exists = activeVariants.some((variant) => variant._id === selectedVariantId);
      if (!exists) {
        setSelectedVariantId(activeVariants[0]._id);
      }
    }
  }, [activeVariants, selectedVariantId]);

  useEffect(() => {
    if (!isVideoPlaying) return;
    const handleStop = () => {
      if (!isVideoPlaying) return;
      const video = videoRef.current;
      if (video) {
        video.pause();
        video.currentTime = 0;
      }
      loopCountRef.current = 0;
      setIsVideoPlaying(false);
    };
    window.addEventListener('scroll', handleStop, { passive: true });
    window.addEventListener('touchmove', handleStop, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleStop);
      window.removeEventListener('touchmove', handleStop);
    };
  }, [isVideoPlaying]);

  const handleVideoStart = async () => {
    const video = videoRef.current;
    if (!video) return;
    loopCountRef.current = 0;
    try {
      await video.play();
      setIsVideoPlaying(true);
    } catch (error) {
      setIsVideoPlaying(false);
    }
  };

  const handleVideoStop = () => {
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.currentTime = 0;
    }
    loopCountRef.current = 0;
    setIsVideoPlaying(false);
  };

  const handleVideoEnded = () => {
    if (!isVideoPlaying) return;
    loopCountRef.current += 1;
    if (loopCountRef.current >= 5) {
      handleVideoStop();
      return;
    }
    const video = videoRef.current;
    if (video) {
      video.currentTime = 0;
      video.play();
    }
  };

  const handleAddToCart = async (weight = null, price = null, strain = null, quantity = 1) => {
    const parsedPrice = parseFloat(price) || parseFloat(product.price) || 0;
    const displayName =
      product.name ||
      product.strain ||
      `${product.brand || ''}${product.productType ? ` - ${product.productType}` : ''}${product.edibleType ? ` - ${product.edibleType}` : ''}`.trim();

    const summaryParts = [displayName || 'Item'];
    if (type === 'flower' && weight) summaryParts.push(weight);
    if ((type === 'concentrate' || type === 'disposable') && strain?.strain) summaryParts.push(strain.strain);
    if (quantity > 1) summaryParts.push(`Qty ${quantity}`);

    const confirmed = await confirm({
      title: 'Add to cart',
      message: `Add to cart: ${summaryParts.join(' • ')}?`,
      confirmText: 'Add',
      cancelText: 'Cancel',
    });

    if (!confirmed) return;

    let itemData = {
      productId: product._id,
      productType: type,
      productName: displayName || strainName || 'Product',
      priceEach: parsedPrice,
      quantity: quantity || 1,
    };

    if (type === 'flower') {
      itemData.weight = weight;
      itemData.strain = product.strain;
      itemData.priceEach = parseFloat(price) || 0;
    } else if ((type === 'concentrate' || type === 'disposable') && strain) {
      itemData.strain = strain.strain;
      itemData.strainType = strain.strainType;
    } else if (type === 'edible' && strain) {
      itemData.variant = strain.name;
    } else {
      itemData.strain = product.strain;
      itemData.weight = product.weight;
    }

    addItem(itemData);
    toast({
      title: `${displayName || strainName || 'Product'} added to cart!`,
      status: 'success',
      duration: 3000,
      position: 'top',
      isClosable: true,
    });
  };

  return (
    <div className="card">
      <div style={{ cursor: 'pointer' }} onClick={() => setDetailsOpen(true)}>
        {videoUrl ? (
          <div className="media-thumb">
            <video
              ref={videoRef}
              src={videoUrl}
              poster={imageUrl}
              muted
              playsInline
              preload="metadata"
              onEnded={handleVideoEnded}
              onClick={(e) => {
                e.stopPropagation();
                if (isVideoPlaying) {
                  handleVideoStop();
                }
              }}
            />
            {!isVideoPlaying && (
              <button
                type="button"
                className="video-overlay"
                onClick={(e) => {
                  e.stopPropagation();
                  handleVideoStart();
                }}
              >
                <span className="video-overlay-content">
                  <span className="video-play-icon" aria-hidden="true" />
                  <span>Tap to play</span>
                </span>
              </button>
            )}
          </div>
        ) : (
          <img
            src={imageUrl}
            alt={product.name || product.strain}
            style={{ width: '100%', borderRadius: 12, objectFit: 'cover', aspectRatio: '1 / 1' }}
          />
        )}
      </div>

      <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
        {categoryLabel ? <small style={{ opacity: 0.7 }}>{categoryLabel}</small> : null}
        <strong>{strainName || product.productType || product.edibleType}</strong>
        {product.thc_percent || product.thcPercentage ? (
          <div>THC: {product.thc_percent ?? product.thcPercentage}%</div>
        ) : null}
        {product.weight ? <div>Weight: {product.weight}</div> : null}
        {product.price ? <div>${product.price}</div> : null}

        {type === 'flower' && (
          <select
            className="select"
            value={activeTier?.quantity ?? ''}
            onChange={(e) => {
              const quantity = Number(e.target.value);
              const nextTier = prices.find((pricePoint) => pricePoint.quantity === quantity) || null;
              setSelectedBulkTier(nextTier);
            }}
          >
            {prices.map((pricePoint) => (
              <option key={pricePoint.quantity} value={pricePoint.quantity}>
                {pricePoint.quantity}g - ${pricePoint.price}
              </option>
            ))}
          </select>
        )}

        {(type === 'concentrate' || type === 'disposable') && activeStrains.length > 0 && (
          <select
            className="select"
            value={selectedStrain?._id || ''}
            onChange={(e) => setSelectedStrainId(e.target.value)}
          >
            {activeStrains.map((strain) => (
              <option key={strain._id} value={strain._id}>
                {strain.strain}
              </option>
            ))}
          </select>
        )}

        {type === 'edible' && activeVariants.length > 0 && (
          <select
            className="select"
            value={selectedVariant?._id || ''}
            onChange={(e) => setSelectedVariantId(e.target.value)}
          >
            {activeVariants.map((variant) => (
              <option key={variant._id} value={variant._id}>
                {variant.name}
              </option>
            ))}
          </select>
        )}

        {type !== 'flower' && (
          <select
            className="select"
            value={selectedQuantity}
            onChange={(e) => setSelectedQuantity(Number(e.target.value))}
          >
            {Array.from({ length: 10 }, (_, i) => i + 1).map((qty) => (
              <option key={qty} value={qty}>
                Qty: {qty}
              </option>
            ))}
          </select>
        )}

        <button
          type="button"
          className="button"
          onClick={() => {
            if (type === 'flower') {
              if (!activeTier) return;
              handleAddToCart(`${activeTier.quantity}g`, activeTier.price, null, 1);
              return;
            }

            if (type === 'concentrate' || type === 'disposable') {
              handleAddToCart(null, product.price, selectedStrain, selectedQuantity);
              return;
            }

            if (type === 'edible') {
              handleAddToCart(product.weight, product.price, selectedVariant, selectedQuantity);
              return;
            }

            handleAddToCart(product.weight, product.price, null, selectedQuantity);
          }}
        >
          Add to Cart
        </button>
      </div>

      <Modal open={detailsOpen} onClose={() => setDetailsOpen(false)}>
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong>{strainName || product.productType || product.edibleType}</strong>
            <button className="button secondary" type="button" onClick={() => setDetailsOpen(false)}>
              Close
            </button>
          </div>
          {videoUrl ? (
            <div className="media-thumb" onClick={() => setImageOpen(true)}>
              <img
                src={imageUrl}
                alt={product.name || product.strain}
                style={{ width: '100%', borderRadius: 12, objectFit: 'cover' }}
              />
              {!isVideoPlaying && (
                <div className="video-overlay">
                  <span className="video-overlay-content">
                    <span className="video-play-icon" aria-hidden="true" />
                    <span>Tap to play</span>
                  </span>
                </div>
              )}
            </div>
          ) : (
            <img
              src={imageUrl}
              alt={product.name || product.strain}
              style={{ width: '100%', borderRadius: 12, objectFit: 'cover' }}
              onClick={() => setImageOpen(true)}
            />
          )}
          {product.description ? <p>{product.description}</p> : null}
          {(type === 'concentrate' || type === 'disposable') && activeStrains.length > 0 ? (
            <div>
              <strong>Flavors:</strong>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {activeStrains.map((strain) => (
                  <span key={strain._id} className="panel" style={{ padding: '6px 10px' }}>
                    {strain.strain}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          {type === 'edible' && activeVariants.length > 0 ? (
            <div>
              <strong>Variants:</strong>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {activeVariants.map((variant) => (
                  <span key={variant._id} className="panel" style={{ padding: '6px 10px' }}>
                    {variant.name}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </Modal>

      <Modal open={imageOpen} onClose={() => setImageOpen(false)} fullscreen>
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          <button
            className="button secondary"
            type="button"
            style={{ position: 'absolute', top: 16, right: 16, zIndex: 2 }}
            onClick={() => setImageOpen(false)}
          >
            Close
          </button>
          {videoUrl ? (
            <video
              src={videoUrl}
              poster={imageUrl}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              controls
              playsInline
            />
          ) : (
            <img
              src={imageUrl}
              alt={product.name || product.strain}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          )}
        </div>
      </Modal>

      <ConfirmDialog />
    </div>
  );
};

export default ProductCardUI;

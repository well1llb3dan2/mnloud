import { useCallback, useEffect, useRef, useState } from 'react';
import { useCartStore } from '../stores';
import { useConfirmDialog } from './ConfirmDialog';
import { useToast } from './ToastProvider';
import { useOverlayStack } from '../context';

const NO_IMAGE_URL = 'https://cdn.mnloud.com/uploads/noimage.png';

const getImageUrl = (image) => {
  if (!image) return NO_IMAGE_URL;
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
  const { register: registerOverlay, unregister: unregisterOverlay } = useOverlayStack();

  useEffect(() => {
    if (detailsOpen) {
      const closeFn = () => setDetailsOpen(false);
      registerOverlay(closeFn);
      return () => unregisterOverlay(closeFn);
    }
  }, [detailsOpen, registerOverlay, unregisterOverlay]);

  useEffect(() => {
    if (imageOpen) {
      const closeFn = () => setImageOpen(false);
      registerOverlay(closeFn);
      return () => unregisterOverlay(closeFn);
    }
  }, [imageOpen, registerOverlay, unregisterOverlay]);

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

  // Whether this product type uses a per-variant image carousel
  const useCarousel = (type === 'edible' && activeVariants.length > 0)
    || (type === 'concentrate' && activeStrains.length > 0);
  const carouselItems = type === 'edible'
    ? activeVariants.map((v) => ({ _id: v._id, label: v.name, image: v.imageUrl || getImageUrl(v.image) }))
    : type === 'concentrate'
      ? activeStrains.map((s) => ({ _id: s._id, label: s.strain2 ? `${s.strain} / ${s.strain2}` : s.strain, image: s.imageUrl || getImageUrl(s.image) }))
      : [];

  const carouselRef = useRef(null);
  const hasAutoScrolled = useRef(false);

  useEffect(() => {
    if (!useCarousel || carouselItems.length <= 1 || hasAutoScrolled.current) return;
    const el = carouselRef.current;
    if (!el) return;
    hasAutoScrolled.current = true;
    el.style.scrollSnapType = 'none';
    let i = 0;
    const delay = 300;
    const step = () => {
      i++;
      if (i < carouselItems.length) {
        el.children[i]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        setTimeout(step, delay);
      } else {
        setTimeout(() => {
          el.children[0]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
          setTimeout(() => { el.style.scrollSnapType = 'x mandatory'; }, 400);
        }, delay);
      }
    };
    setTimeout(step, 600);
  }, [useCarousel, carouselItems.length]);

  const handleCarouselScroll = useCallback(() => {
    const el = carouselRef.current;
    if (!el || carouselItems.length === 0) return;
    const scrollLeft = el.scrollLeft;
    const itemWidth = el.firstElementChild?.offsetWidth || 1;
    const centerIndex = Math.round(scrollLeft / itemWidth);
    const clamped = Math.max(0, Math.min(centerIndex, carouselItems.length - 1));
    const item = carouselItems[clamped];
    if (!item) return;
    if (type === 'edible' && item._id !== selectedVariantId) {
      setSelectedVariantId(item._id);
    } else if (type === 'concentrate' && item._id !== selectedStrainId) {
      setSelectedStrainId(item._id);
    }
  }, [carouselItems, selectedVariantId, selectedStrainId, type]);

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

  const strainTypeLabel = (st) => {
    if (!st) return '';
    const map = { sativa: 'Sativa', indica: 'Indica', hybrid: 'Hybrid', 'hybrid-s': 'Hybrid-S', 'hybrid-i': 'Hybrid-I' };
    return map[st] || st;
  };

  const handleAddToCart = async (weight = null, price = null, strain = null, quantity = 1) => {
    const parsedPrice = parseFloat(price) || parseFloat(product.price) || 0;
    const displayName =
      product.name ||
      product.strain ||
      `${product.brand || ''}${product.productType ? ` - ${product.productType}` : ''}${product.edibleType ? ` - ${product.edibleType}` : ''}`.trim();

    // Build detailed line matching cart display
    const lineParts = [];
    if (type === 'flower') {
      lineParts.push(displayName);
      if (product.strainType) lineParts.push(`(${strainTypeLabel(product.strainType)})`);
      if (weight) lineParts.push(`— ${weight}`);
    } else if (type === 'concentrate' || type === 'disposable') {
      if (product.brand) lineParts.push(product.brand);
      lineParts.push(displayName);
      if (strain?.strain) {
        const strainText = strain.strain2 ? `${strain.strain} / ${strain.strain2}` : strain.strain;
        lineParts.push(`— ${strainText}`);
      }
      if (strain?.strainType) {
        const typeText = strain.strainType2
          ? `${strainTypeLabel(strain.strainType)} / ${strainTypeLabel(strain.strainType2)}`
          : strainTypeLabel(strain.strainType);
        lineParts.push(`(${typeText})`);
      }
    } else if (type === 'edible') {
      if (product.brand) lineParts.push(product.brand);
      lineParts.push(displayName);
      if (strain?.name) lineParts.push(`— ${strain.name}`);
      if (product.weight) lineParts.push(product.weight);
    } else {
      lineParts.push(displayName);
      if (product.weight) lineParts.push(product.weight);
    }

    const itemLine = lineParts.join(' ');
    const priceLine = `$${(parsedPrice * quantity).toFixed(2)}`;
    const qtyLine = quantity > 1 ? `Qty: ${quantity}` : '';
    const details = [itemLine, qtyLine, priceLine].filter(Boolean).join('\n');

    const confirmed = await confirm({
      title: 'Add to cart',
      message: details,
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
      itemData.strainType = product.strainType;
      itemData.priceTierId = product.priceTier?._id;
      itemData.priceEach = parseFloat(price) || 0;
    } else if ((type === 'concentrate' || type === 'disposable') && strain) {
      itemData.brand = product.brand;
      itemData.strain = strain.strain;
      itemData.strainId = strain._id;
      itemData.strainType = strain.strainType;
      if (strain.strain2) {
        itemData.strain2 = strain.strain2;
        itemData.strainType2 = strain.strainType2;
      }
    } else if (type === 'edible' && strain) {
      itemData.brand = product.brand;
      itemData.variant = strain.name;
      itemData.variantId = strain._id;
    } else {
      itemData.strain = product.strain;
      itemData.weight = product.weight;
    }

    const result = await addItem(itemData);
    if (result?.success === false) {
      toast({
        title: 'Cannot add to cart',
        description: result.message || 'This item is currently unavailable.',
        status: 'error',
        duration: 4000,
        position: 'top',
        isClosable: true,
      });
      return;
    }
    toast({
      title: `${displayName || strainName || 'Product'} added to cart!`,
      status: 'success',
      duration: 3000,
      position: 'top',
      isClosable: true,
    });
  };

  // ── Flower-specific card ──
  if (type === 'flower') {
    const thc = product.thc_percent ?? product.thcPercentage;
    return (
      <div className="card">
        <img
          src={imageUrl}
          alt={strainName}
          style={{ width: '100%', borderRadius: 12, objectFit: 'cover', aspectRatio: '1 / 1', display: 'block', margin: '0 auto' }}
        />

        <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
          {/* Strain type | Strain | THC% */}
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 6 }}>
            {product.strainType && (
              <span style={{ fontSize: 11, opacity: 0.65, textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 }}>
                {strainTypeLabel(product.strainType)}
              </span>
            )}
            <strong style={{ fontSize: 15, textAlign: 'center' }}>{strainName}</strong>
            {thc != null && (
              <span style={{ fontSize: 11, opacity: 0.65, flexShrink: 0 }}>
                {thc}%
              </span>
            )}
          </div>

          <button
            type="button"
            className="button secondary"
            style={{ padding: '6px 0', fontSize: 12 }}
            onClick={() => setDetailsOpen(true)}
          >
            Details
          </button>

          <div>
            <div className="select-label">Select weight</div>
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
                  {pricePoint.quantity}g — ${pricePoint.price}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="button"
            onClick={() => {
              if (!activeTier) return;
              handleAddToCart(`${activeTier.quantity}g`, activeTier.price, null, 1);
            }}
          >
            Add to Cart
          </button>
        </div>

        {/* Flower details modal — no image */}
        <Modal open={detailsOpen} onClose={() => setDetailsOpen(false)}>
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: 16 }}>{strainName}</strong>
              <button className="button secondary" type="button" style={{ padding: '4px 12px', fontSize: 12 }} onClick={() => setDetailsOpen(false)}>
                Close
              </button>
            </div>

            {/* Quick stats row */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {product.strainType && (
                <span className="panel" style={{ padding: '4px 10px', fontSize: 12 }}>
                  {strainTypeLabel(product.strainType)}
                </span>
              )}
              {thc != null && (
                <span className="panel" style={{ padding: '4px 10px', fontSize: 12 }}>
                  THC {thc}%
                </span>
              )}
            </div>

            {/* Info sections — compact two-column where it fits */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {product.effects?.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.5, marginBottom: 4 }}>Effects</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {product.effects.map((e) => (
                      <span key={e} style={{ fontSize: 12, background: 'rgba(124,58,237,0.15)', borderRadius: 6, padding: '2px 8px' }}>{e}</span>
                    ))}
                  </div>
                </div>
              )}
              {product.flavors?.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.5, marginBottom: 4 }}>Flavors</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {product.flavors.map((f) => (
                      <span key={f} style={{ fontSize: 12, background: 'rgba(6,182,212,0.15)', borderRadius: 6, padding: '2px 8px' }}>{f}</span>
                    ))}
                  </div>
                </div>
              )}
              {product.may_relieve?.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.5, marginBottom: 4 }}>May Relieve</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {product.may_relieve.map((m) => (
                      <span key={m} style={{ fontSize: 12, background: 'rgba(34,197,94,0.15)', borderRadius: 6, padding: '2px 8px' }}>{m}</span>
                    ))}
                  </div>
                </div>
              )}
              {product.terpenes?.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.5, marginBottom: 4 }}>Terpenes</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {product.terpenes.map((t) => (
                      <span key={t} style={{ fontSize: 12, background: 'rgba(251,191,36,0.15)', borderRadius: 6, padding: '2px 8px' }}>{t}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {product.lineage && (
              <div>
                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.5, marginBottom: 4 }}>Lineage</div>
                <div style={{ fontSize: 13 }}>{product.lineage}</div>
              </div>
            )}

            {product.description && (
              <div>
                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.5, marginBottom: 4 }}>Description</div>
                <div style={{ fontSize: 13, lineHeight: 1.5 }}>{product.description}</div>
              </div>
            )}
          </div>
        </Modal>

        <ConfirmDialog />
      </div>
    );
  }

  // ── Non-flower card (concentrate, disposable, edible) ──
  return (
    <div className="card">
      {useCarousel ? (
        /* ── Per-variant image carousel (edible / concentrate) ── */
        <>
          <div
            className="carousel"
            ref={carouselRef}
            onScroll={handleCarouselScroll}
          >
            {carouselItems.map((item) => (
              <div className="carousel-slide" key={item._id}>
                <img
                  src={item.image}
                  alt={item.label}
                  style={{ width: '100%', borderRadius: 12, objectFit: 'cover', aspectRatio: '1 / 1', display: 'block' }}
                />
                <div className="carousel-label">{item.label}</div>
              </div>
            ))}
          </div>
          {carouselItems.length > 1 && (
            <div className="carousel-hint">
              <span>← swipe to select flavor →</span>
            </div>
          )}
          {carouselItems.length > 1 && (
            <div className="carousel-dots">
              {carouselItems.map((item) => {
                const isActive = type === 'edible'
                  ? item._id === (selectedVariant?._id || activeVariants[0]?._id)
                  : item._id === (selectedStrain?._id || activeStrains[0]?._id);
                return (
                  <span
                    key={item._id}
                    className={`carousel-dot${isActive ? ' active' : ''}`}
                    onClick={() => {
                      const idx = carouselItems.findIndex((ci) => ci._id === item._id);
                      const el = carouselRef.current;
                      if (el && el.children[idx]) {
                        el.children[idx].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                      }
                    }}
                  />
                );
              })}
            </div>
          )}
        </>
      ) : (
        /* ── Single image (disposable, or products without variants) ── */
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
      )}

      <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
        {categoryLabel ? <small style={{ opacity: 0.7 }}>{categoryLabel}</small> : null}
        <strong>{strainName || product.productType || product.edibleType}</strong>
        {product.thc_percent || product.thcPercentage ? (
          <div>THC: {product.thc_percent ?? product.thcPercentage}%</div>
        ) : null}
        {product.weight ? <div>Weight: {product.weight}</div> : null}
        {product.price ? <div>${product.price}</div> : null}

        {type === 'disposable' && activeStrains.length > 0 && (
          <div>
            <div className="select-label">Choose flavor</div>
            <select
              className="select"
              value={selectedStrain?._id || ''}
              onChange={(e) => setSelectedStrainId(e.target.value)}
            >
              {activeStrains.map((strain) => (
                <option key={strain._id} value={strain._id}>
                  {strain.strain2
                    ? `${strain.strain} / ${strain.strain2}`
                    : strain.strain}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <div className="select-label">Quantity</div>
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
        </div>

        <button
          type="button"
          className="button"
          onClick={() => {
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
          {!useCarousel && videoUrl ? (
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
          ) : !useCarousel ? (
            <img
              src={imageUrl}
              alt={product.name || product.strain}
              style={{ width: '100%', borderRadius: 12, objectFit: 'cover' }}
              onClick={() => setImageOpen(true)}
            />
          ) : null}}
          {product.description ? <p>{product.description}</p> : null}
          {(type === 'concentrate' || type === 'disposable') && activeStrains.length > 0 ? (
            <div>
              <strong>Flavors:</strong>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {activeStrains.map((strain) => (
                  <span key={strain._id} className="panel" style={{ padding: '6px 10px' }}>
                    {strain.strain2
                      ? `${strain.strain} / ${strain.strain2}`
                      : strain.strain}
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

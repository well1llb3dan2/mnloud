import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  IconButton,
  useColorMode,
  useToast,
  Spinner,
  Center,
  Switch,
  FormControl,
  FormLabel,
  Input,
  Select,
  Textarea,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  useDisclosure,
  Badge,
  Image,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
} from '@chakra-ui/react';
import { FiPlus, FiEdit2, FiTrash2, FiCamera, FiUpload, FiImage } from 'react-icons/fi';
import { useForm } from 'react-hook-form';
import { productService, priceTierService } from '../../services';
import { useOverlayStack } from '../../context';
import { useStrainGeneration } from '../../hooks';
import { StrainMatchSelector } from '../../components';
import { useConfirmDialog } from '../../components/ConfirmDialog';

const NO_IMAGE_URL = 'https://cdn.mnloud.com/uploads/noimage.png';

const resolveMediaUrl = (mediaUrl, mediaPath) => (
  mediaUrl || (mediaPath ? `/uploads/${mediaPath.replace('uploads/', '')}` : NO_IMAGE_URL)
);

const Flowers = () => {
  const navigate = useNavigate();
  const { colorMode } = useColorMode();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const {
    isOpen: isBatchOpen,
    onOpen: onBatchOpen,
    onClose: onBatchClose,
  } = useDisclosure();
  const [editingProduct, setEditingProduct] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRef = useRef();
  const cameraInputRef = useRef();
  const compressedImageRef = useRef(null);
  const {
    register: registerOverlay,
    unregister: unregisterOverlay,
    registerBackAction,
    unregisterBackAction,
  } = useOverlayStack();

  const { register, handleSubmit, reset, setValue, watch } = useForm();
  const [strainSearch, setStrainSearch] = useState('');
  const [addStep, setAddStep] = useState(1);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [pendingStrains, setPendingStrains] = useState([]);
  const [batchStep, setBatchStep] = useState(1);
  const [batchCount, setBatchCount] = useState(0);
  const [batchStrains, setBatchStrains] = useState([]);
  const [batchItems, setBatchItems] = useState([]);
  const [batchCandidates, setBatchCandidates] = useState([]);
  const [isBatchLoading, setIsBatchLoading] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, name: '' });
  const [strainMatches, setStrainMatches] = useState([]);
  const [strainSample, setStrainSample] = useState(null);
  const [isStrainSearching, setIsStrainSearching] = useState(false);
  const [strainInputText, setStrainInputText] = useState('');
  const [strainCandidates, setStrainCandidates] = useState([]);
  const [isMatchLoading, setIsMatchLoading] = useState(false);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [detailProgress, setDetailProgress] = useState({ current: 0, total: 0, name: '' });
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const { generateStrainData } = useStrainGeneration({
    setIsSearching: setIsStrainSearching,
    toast,
  });

  useEffect(() => {
    if (!isOpen || editingProduct || addStep <= 1) return;
    const handleStepBack = () => setAddStep((prev) => Math.max(1, prev - 1));
    registerBackAction(handleStepBack);
    return () => unregisterBackAction(handleStepBack);
  }, [isOpen, editingProduct, addStep, registerBackAction, unregisterBackAction]);

  useEffect(() => {
    if (!isBatchOpen || batchStep <= 1) return;
    const handleBatchBack = () => setBatchStep((prev) => Math.max(1, prev - 1));
    registerBackAction(handleBatchBack);
    return () => unregisterBackAction(handleBatchBack);
  }, [isBatchOpen, batchStep, registerBackAction, unregisterBackAction]);

  // Fetch products
  const { data, isLoading } = useQuery({
    queryKey: ['flowers'],
    queryFn: productService.getFlowers,
  });

  // Fetch price tiers
  const { data: tiersData } = useQuery({
    queryKey: ['priceTiers'],
    queryFn: priceTierService.getAll,
  });

  const products = data?.products || [];
  const tiers = tiersData?.tiers || [];

  // Mutations
  const createMutation = useMutation({
    mutationFn: productService.createFlower,
    onSuccess: () => {
      queryClient.invalidateQueries(['flowers']);
      toast({ title: 'Product created', status: 'success' });
      handleClose();
      navigate('/products/flower', { replace: true });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, status: 'error' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => productService.updateFlower(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['flowers']);
      toast({ title: 'Product updated', status: 'success' });
      handleClose();
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, status: 'error' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: productService.deleteFlower,
    onSuccess: () => {
      queryClient.invalidateQueries(['flowers']);
      toast({ title: 'Product deleted', status: 'success' });
    },
  });

  const confirmDelete = async (product) => {
    const label = product?.strain || product?.name || 'this product';
    return confirm({
      title: 'Delete product',
      message: `Delete ${label}? This cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
    });
  };

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }) => {
      const formData = new FormData();
      formData.append('isActive', isActive);
      return productService.updateFlower(id, formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['flowers']);
    },
  });

  const markCameraOpen = () => {
    try {
      window.__ignoreNextPopState = true;
      window.__ignorePopStateUntil = Date.now() + 3000;
      window.history.pushState(null, '', window.location.href);
    } catch (err) {}
  };
  const handleClose = () => {
    // Unregister from overlay stack (if registered)
    try {
      unregisterOverlay(handleClose);
    } catch (err) {
      // ignore
    }

    setEditingProduct(null);
    setImagePreview(null);
    setStrainSearch('');
    setSelectedMatch(null);
    setPendingStrains([]);
    setStrainInputText('');
    setStrainCandidates([]);
    setIsMatchLoading(false);
    setIsDetailsLoading(false);
    setDetailProgress({ current: 0, total: 0, name: '' });
    setAddStep(1);
    reset();
    onClose();
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setValue('name', product.name);
    setValue('strain', product.strain);
    setStrainSearch(product.strain || '');
    setValue('variety', product.variety || product.strainType || '');
    setValue('thc_percent', product.thc_percent ?? product.thcPercentage ?? '');
    setValue('effects', Array.isArray(product.effects) ? product.effects.join(', ') : '');
    setValue('flavors', Array.isArray(product.flavors) ? product.flavors.join(', ') : '');
    setValue('may_relieve', Array.isArray(product.may_relieve) ? product.may_relieve.join(', ') : '');
    setValue('terpenes', Array.isArray(product.terpenes) ? product.terpenes.join(', ') : '');
    setValue('lineage', product.lineage || '');
    setValue('priceTier', product.priceTier?._id || product.priceTier);
    setValue('isPrePack', product.isPrePack || false);
    setValue('description', product.description);
    if (product.image) {
      setImagePreview(resolveMediaUrl(product.imageUrl, product.image));
    }
    setAddStep(3);
    onOpen();
    // Register modal close handler so back button closes modal first
    registerOverlay(handleClose);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCameraChange = async (e) => {
    try {
      window.__lastCameraAccept = Date.now();
      window.__ignoreNextPopState = true;
      window.__ignorePopStateUntil = Date.now() + 3000;
      window.history.pushState(null, '', window.location.href);
    } catch (err) {}
    const file = e.target.files[0];
    if (file) {
      // Compress the image on the client to avoid large uploads
      try {
        const imgBitmap = await createImageBitmap(file);
        const maxWidth = 1200;
        const ratio = imgBitmap.height / imgBitmap.width;
        const canvas = document.createElement('canvas');
        const width = Math.min(imgBitmap.width, maxWidth);
        canvas.width = width;
        canvas.height = Math.round(width * ratio);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(imgBitmap, 0, 0, canvas.width, canvas.height);

        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
        if (blob) {
          // Create a File so multer receives a filename
          const compressedFile = new File([blob], file.name || `photo.jpg`, { type: 'image/jpeg' });
          compressedImageRef.current = compressedFile;

          const reader = new FileReader();
          reader.onloadend = () => {
            setImagePreview(reader.result);
            // Mark the time of camera accept so the global popstate handler can ignore the immediate pop
            try { window.__lastCameraAccept = Date.now(); } catch (err) {}
            // Prevent camera UI from causing a popstate that would close the modal
            try { window.history.pushState(null, '', window.location.href); } catch (err) {}
          };
          reader.readAsDataURL(compressedFile);
        } else {
          // Fallback to original file if compression fails
          const reader = new FileReader();
          reader.onloadend = () => setImagePreview(reader.result);
          reader.readAsDataURL(file);
          compressedImageRef.current = null;
        }
      } catch (err) {
        console.error('Camera image processing error:', err);
        const reader = new FileReader();
        reader.onloadend = () => setImagePreview(reader.result);
        reader.readAsDataURL(file);
        compressedImageRef.current = null;
      }
    }
  };

  const onSubmit = (data) => {
    if (editingProduct) {
      if (!data.priceTier) {
        toast({ title: 'Select a price tier', status: 'warning' });
        return;
      }
      const formData = new FormData();
      formData.append('priceTier', data.priceTier);
      formData.append('isPrePack', data.isPrePack ? 'true' : 'false');
      const compressedFile = compressedImageRef.current;
      const cameraFile = cameraInputRef.current?.files?.[0];
      const galleryFile = fileInputRef.current?.files?.[0];
      if (compressedFile) {
        formData.append('image', compressedFile);
      } else if (cameraFile) {
        formData.append('image', cameraFile);
      } else if (galleryFile) {
        formData.append('image', galleryFile);
      }
      updateMutation.mutate({ id: editingProduct._id, data: formData });
      return;
    }

    const requiredFields = [
      'strain',
      'variety',
      'thc_percent',
      'effects',
      'flavors',
      'may_relieve',
      'terpenes',
      'lineage',
      'description',
    ];
    const missing = requiredFields.filter((field) => !data[field]);
    if (missing.length > 0) {
      toast({
        title: 'Missing strain data',
        description: `Fill: ${missing.join(', ')}`,
        status: 'warning',
      });
      return;
    }

    const numericThc = Number(data.thc_percent);
    if (!Number.isNaN(numericThc) && numericThc > 35) {
      data.thc_percent = '35';
    }

    const formData = new FormData();
    Object.keys(data).forEach((key) => {
      if (data[key] !== undefined && data[key] !== '') {
        formData.append(key, data[key]);
      }
    });

    // Prefer compressed camera file if present, otherwise camera file, then gallery file
    const compressedFile = compressedImageRef.current;
    const cameraFile = cameraInputRef.current?.files[0];
    const galleryFile = fileInputRef.current?.files[0];

    if (compressedFile) {
      formData.append('image', compressedFile);
    } else if (cameraFile) {
      formData.append('image', cameraFile);
    } else if (galleryFile) {
      formData.append('image', galleryFile);
    }
    createMutation.mutate(formData);
  };

  const extractStrainName = (item) => {
    if (!item) return '';
    if (typeof item === 'string') return item;
    return (
      item.name ||
      item.strain ||
      item.strainName ||
      item.title ||
      item.displayName ||
      item.label ||
      ''
    );
  };

  const normalizeStrain = (value) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
      .trim();

  const normalizeTokens = (value) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  const getStrainVariants = (value) => {
    const base = normalizeStrain(value);
    if (!base) return [];
    const variants = new Set([base]);
    variants.add(base.replace(/^z/, 's'));
    variants.add(base.replace(/^s/, 'z'));
    variants.add(base.replace(/zz/g, 'z'));
    variants.add(base.replace(/ck/g, 'k'));
    variants.add(base.replace(/ph/g, 'f'));
    variants.add(base.replace(/c/g, 'k'));
    variants.add(base.replace(/y/g, 'i'));
    variants.add(base.replace(/[aeiou]/g, ''));
    return [...variants].filter(Boolean);
  };

  const buildStrainIndexItem = (item) => {
    const name = extractStrainName(item);
    return {
      name,
      normalized: normalizeStrain(name),
      tokens: normalizeTokens(name),
      raw: item,
    };
  };

  const parseThcValue = (value) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number') return value;
    if (typeof value !== 'string') return '';
    const matches = value.match(/\d+(?:\.\d+)?/g);
    if (!matches || matches.length === 0) return '';
    return parseFloat(matches[0]);
  };

  const normalizeList = (value) => {
    if (Array.isArray(value)) return value.filter(Boolean).map(String);
    if (typeof value === 'string') {
      return value
        .split(/[\n,]+/)
        .map((item) => item.trim())
        .filter(Boolean);
    }
    return [];
  };

  const mapStrainDetails = (raw) => {
    if (!raw) return {};
    const name = extractStrainName(raw);
    const variety =
      raw.variety ||
      raw.strain_type ||
      raw.type ||
      raw.category ||
      '';

    const thcValue = parseThcValue(
      raw.thc_percent ||
        raw.thc ||
        raw.thcPercentage ||
        raw.thcPercent ||
        raw.thc_level ||
        raw.thcLevel
    );
    const cappedThc = typeof thcValue === 'number' ? Math.min(thcValue, 35) : '';

    const description = typeof raw.description === 'string' ? raw.description : '';
    const lineage = typeof raw.lineage === 'string' ? raw.lineage : '';

    return {
      name,
      variety,
      thc_percent: cappedThc === '' ? '' : String(cappedThc),
      effects: normalizeList(raw.effects),
      flavors: normalizeList(raw.flavors),
      may_relieve: normalizeList(raw.may_relieve),
      terpenes: normalizeList(raw.terpenes),
      lineage,
      description,
    };
  };

  const getStrainSuggestions = () => strainMatches;

  const runStrainSearch = async (query) => {
    const result = await generateStrainData(query, { mode: 'matches', limit: 5 });
    setStrainMatches(result.matches || []);
    setStrainSample(result.matches?.[0] || null);
  };

  const resetStrainForm = () => {
    setStrainSearch('');
    setSelectedMatch(null);
    setStrainMatches([]);
    setStrainSample(null);
    setValue('strain', '');
    setValue('variety', '');
    setValue('thc_percent', '');
    setValue('effects', '');
    setValue('flavors', '');
    setValue('may_relieve', '');
    setValue('terpenes', '');
    setValue('lineage', '');
    setValue('description', '');
    setValue('priceTier', '');
    setValue('isPrePack', false);
  };

  const handleBatchClose = () => {
    try {
      unregisterOverlay(handleBatchClose);
    } catch (err) {
      // ignore
    }
    setBatchStep(1);
    setBatchCount(0);
    setBatchStrains([]);
    setBatchItems([]);
    setStrainMatches([]);
    setStrainSample(null);
    setBatchCandidates([]);
    setIsBatchLoading(false);
    setBatchProgress({ current: 0, total: 0, name: '' });
    onBatchClose();
  };

  const handleBatchCountNext = () => {
    const count = Number(batchCount);
    if (!Number.isFinite(count) || count < 1) {
      toast({ title: 'Enter a valid strain count', status: 'warning' });
      return;
    }
    setBatchStrains((prev) => {
      const next = [...prev];
      while (next.length < count) next.push('');
      while (next.length > count) next.pop();
      return next;
    });
    setBatchStep(2);
  };

  const handleBatchFindMatches = async () => {
    const trimmed = batchStrains.map((strain) => String(strain || '').trim());
    if (trimmed.some((name) => !name)) {
      toast({ title: 'Fill every strain name', status: 'warning' });
      return;
    }
    setIsBatchLoading(true);
    setBatchProgress({ current: 0, total: 0, name: '' });
    try {
      const candidates = await Promise.all(
        trimmed.map((name) => generateStrainData(name, { mode: 'matches', limit: 5 }))
      );
      setBatchCandidates(
        candidates.map((candidate) => ({
          ...candidate,
          selectedName: candidate.matches?.[0]?.name || candidate.input,
        }))
      );
      setBatchStep(3);
    } finally {
      setIsBatchLoading(false);
    }
  };

  const handleBatchGenerateDetails = async () => {
    if (!batchCandidates.length) {
      toast({ title: 'No matches to process', status: 'warning' });
      return;
    }
    setIsBatchLoading(true);
    setBatchProgress({ current: 0, total: batchCandidates.length, name: '' });
    try {
      let completed = 0;
      const items = await Promise.all(
        batchCandidates.map(async (candidate) => {
          const selectedName = candidate.selectedName || candidate.input;
          const matchCursor = (candidate.matches || []).findIndex(
            (match) => match.name === selectedName
          );
          const result = await generateStrainData(candidate.input, {
            mode: 'details',
            selectedName,
            limit: 5,
          });
          completed += 1;
          setBatchProgress({ current: completed, total: batchCandidates.length, name: selectedName });
          const fallbackMatch = (candidate.matches || []).find((match) => match.name === selectedName);
          const mapped = mapStrainDetails(result.details || fallbackMatch || { name: selectedName });
          return {
            strain: mapped.name || selectedName,
            thc_percent: mapped.thc_percent !== '' ? String(mapped.thc_percent) : '',
            variety: mapped.variety || '',
            priceTier: '',
            description: mapped.description || '',
            effects: mapped.effects?.length ? mapped.effects.join(', ') : '',
            flavors: mapped.flavors?.length ? mapped.flavors.join(', ') : '',
            may_relieve: mapped.may_relieve?.length ? mapped.may_relieve.join(', ') : '',
            terpenes: mapped.terpenes?.length ? mapped.terpenes.join(', ') : '',
            lineage: mapped.lineage || '',
            input: candidate.input,
            matches: candidate.matches || [],
            selectedName,
            matchCursor: matchCursor >= 0 ? matchCursor : 0,
            refreshName: '',
            refreshSelectedName: '',
            isRefreshing: false,
            showRefresh: false,
          };
        })
      );
      setBatchItems(items);
      setBatchStep(4);
    } finally {
      setIsBatchLoading(false);
    }
  };

  const updateBatchItemAt = (index, updates) => {
    setBatchItems((items) =>
      items.map((item, idx) => (idx === index ? { ...item, ...updates } : item))
    );
  };

  const validateBatchItem = (item) => {
    const requiredFields = [
      'strain',
      'variety',
      'thc_percent',
      'effects',
      'flavors',
      'may_relieve',
      'terpenes',
      'lineage',
      'description',
    ];

    const missing = requiredFields.filter((field) => !item[field]);
    if (missing.length > 0) {
      toast({
        title: 'Missing strain data',
        description: `Fill: ${missing.join(', ')}`,
        status: 'warning',
      });
      return false;
    }
    if (!item.priceTier) {
      toast({ title: 'Select a price tier', status: 'warning' });
      return false;
    }
    return true;
  };

  const batchCreateMutation = useMutation({
    mutationFn: async (items) => {
      await Promise.all(
        items.map((item) => {
          const formData = new FormData();
          formData.append('strain', item.strain);
          if (item.thc_percent !== '') {
            formData.append('thc_percent', item.thc_percent);
          }
          if (item.variety) formData.append('variety', item.variety);
          if (item.effects) formData.append('effects', item.effects);
          if (item.flavors) formData.append('flavors', item.flavors);
          if (item.may_relieve) formData.append('may_relieve', item.may_relieve);
          if (item.terpenes) formData.append('terpenes', item.terpenes);
          if (item.lineage) formData.append('lineage', item.lineage);
          formData.append('priceTier', item.priceTier);
          if (item.description) {
            formData.append('description', item.description);
          }
          return productService.createFlower(formData);
        })
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['flowers']);
      toast({ title: 'Batch created', status: 'success' });
      handleBatchClose();
      navigate('/products/flower', { replace: true });
    },
    onError: (error) => {
      toast({ title: 'Batch create failed', description: error.message, status: 'error' });
    },
  });

  const applyStrainToForm = (raw) => {
    const details = mapStrainDetails(raw);
    if (details.name) setValue('strain', details.name);
    if (details.name) setStrainSearch(details.name);
    if (details.variety) setValue('variety', details.variety);
    if (details.thc_percent !== '') setValue('thc_percent', details.thc_percent);
    if (details.description) setValue('description', details.description);
    if (details.effects?.length) setValue('effects', details.effects.join(', '));
    if (details.flavors?.length) setValue('flavors', details.flavors.join(', '));
    if (details.may_relieve?.length) setValue('may_relieve', details.may_relieve.join(', '));
    if (details.terpenes?.length) setValue('terpenes', details.terpenes.join(', '));
    if (details.lineage) setValue('lineage', details.lineage);
    return details;
  };

  const fetchStrainDetails = async (name) => {
    const result = await generateStrainData(name, { mode: 'details', selectedName: name, limit: 5 });
    return result.details;
  };

  const handleStrainSelect = async (item) => {
    const name = item?.name || item?.strain || item;
    if (name) {
      setStrainSearch(name);
      setValue('strain', name, { shouldDirty: true });
    }
    if (item && (item.effects || item.flavors || item.description || item.terpenes || item.lineage)) {
      return applyStrainToForm(item);
    }
    const details = await fetchStrainDetails(name);
    if (details) {
      return applyStrainToForm(details);
    }
    if (item) {
      const fallback = applyStrainToForm(item);
      toast({ title: 'Using match data (details unavailable)', status: 'info' });
      return fallback;
    }
    return null;
  };

  const parseStrainInputs = (value) =>
    String(value || '')
      .split(/[\n,]+/)
      .map((item) => item.trim())
      .filter(Boolean);

  const handleGenerateMatches = async () => {
    const names = parseStrainInputs(strainInputText);
    if (names.length === 0) {
      toast({ title: 'Enter at least one strain', status: 'warning' });
      return;
    }
    if (names.length > 1) {
      toast({ title: 'Use Batch Add for multiple strains', status: 'warning' });
      return;
    }
    setIsMatchLoading(true);
    try {
      const candidates = await Promise.all(
        names.map((name) => generateStrainData(name, { mode: 'matches', limit: 5 }))
      );
      setStrainCandidates(
        candidates.map((candidate) => ({
          ...candidate,
          selectedName: candidate.matches?.[0]?.name || candidate.input,
        }))
      );
      setAddStep(2);
    } finally {
      setIsMatchLoading(false);
    }
  };

  const handleGenerateDetails = async () => {
    if (!strainCandidates.length) {
      toast({ title: 'No matches to process', status: 'warning' });
      return;
    }
    setIsDetailsLoading(true);
    setDetailProgress({ current: 0, total: strainCandidates.length, name: '' });
    try {
      let completed = 0;
      const items = await Promise.all(
        strainCandidates.map(async (candidate) => {
          const selectedName = candidate.selectedName || candidate.input;
          const matchCursor = (candidate.matches || []).findIndex(
            (match) => match.name === selectedName
          );
          const result = await generateStrainData(candidate.input, {
            mode: 'details',
            selectedName,
            limit: 5,
          });
          completed += 1;
          setDetailProgress({ current: completed, total: strainCandidates.length, name: selectedName });
          const fallbackMatch = (candidate.matches || []).find((match) => match.name === selectedName);
          const mapped = mapStrainDetails(result.details || fallbackMatch || { name: selectedName });
          return {
            strain: mapped.name || selectedName,
            variety: mapped.variety || '',
            thc_percent: mapped.thc_percent !== '' ? String(mapped.thc_percent) : '',
            effects: mapped.effects?.length ? mapped.effects.join(', ') : '',
            flavors: mapped.flavors?.length ? mapped.flavors.join(', ') : '',
            may_relieve: mapped.may_relieve?.length ? mapped.may_relieve.join(', ') : '',
            terpenes: mapped.terpenes?.length ? mapped.terpenes.join(', ') : '',
            lineage: mapped.lineage || '',
            description: mapped.description || '',
            priceTier: '',
            input: candidate.input,
            matches: candidate.matches || [],
            selectedName,
            matchCursor: matchCursor >= 0 ? matchCursor : 0,
            refreshName: '',
            refreshSelectedName: '',
            isRefreshing: false,
            showRefresh: false,
          };
        })
      );
      setPendingStrains(items);
      setAddStep(3);
    } finally {
      setIsDetailsLoading(false);
    }
  };

  const refreshPendingStrainAt = async (idx) => {
    const current = pendingStrains[idx];
    if (!current) return;
    const refreshName = String(current.refreshName || '').trim();
    const refreshSelected = String(current.refreshSelectedName || '').trim();
    const query = refreshName || current.input || current.strain;
    const baseSelected = refreshName || refreshSelected || current.selectedName || current.strain;

    setPendingStrains((prev) =>
      prev.map((item, index) =>
        index === idx ? { ...item, isRefreshing: true } : item
      )
    );

    try {
      const result = await generateStrainData(query, {
        mode: 'details',
        selectedName: baseSelected,
        limit: 5,
        forceRefresh: true,
      });
      const nextMatches = result.matches?.length ? result.matches : current.matches || [];

      let nextSelected = baseSelected;
      if (!refreshName && !refreshSelected && nextMatches.length > 1) {
        const currentIndex = nextMatches.findIndex((match) => match.name === baseSelected);
        const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % nextMatches.length : 0;
        nextSelected = nextMatches[nextIndex]?.name || baseSelected;
      }

      const fallbackMatch = nextMatches.find((match) => match.name === nextSelected);
      const mapped = mapStrainDetails(result.details || fallbackMatch || { name: nextSelected });
      const nextMatchCursor = nextMatches.findIndex((match) => match.name === nextSelected);

      setPendingStrains((prev) =>
        prev.map((item, index) =>
          index === idx
            ? {
                ...item,
                strain: mapped.name || nextSelected,
                variety: mapped.variety || '',
                thc_percent: mapped.thc_percent !== '' ? String(mapped.thc_percent) : '',
                effects: mapped.effects?.length ? mapped.effects.join(', ') : '',
                flavors: mapped.flavors?.length ? mapped.flavors.join(', ') : '',
                may_relieve: mapped.may_relieve?.length ? mapped.may_relieve.join(', ') : '',
                terpenes: mapped.terpenes?.length ? mapped.terpenes.join(', ') : '',
                lineage: mapped.lineage || '',
                description: mapped.description || '',
                input: query,
                matches: nextMatches,
                selectedName: nextSelected,
                matchCursor: nextMatchCursor >= 0 ? nextMatchCursor : 0,
                refreshName: '',
                refreshSelectedName: '',
                isRefreshing: false,
              }
            : item
        )
      );
    } catch (error) {
      setPendingStrains((prev) =>
        prev.map((item, index) =>
          index === idx ? { ...item, isRefreshing: false } : item
        )
      );
      toast({ title: 'Refresh failed', status: 'error' });
    }
  };

  const refreshBatchItemAt = async (idx) => {
    const current = batchItems[idx];
    if (!current) return;
    const refreshName = String(current.refreshName || '').trim();
    const refreshSelected = String(current.refreshSelectedName || '').trim();
    const query = refreshName || current.input || current.strain;
    const baseSelected = refreshName || refreshSelected || current.selectedName || current.strain;

    setBatchItems((prev) =>
      prev.map((item, index) =>
        index === idx ? { ...item, isRefreshing: true } : item
      )
    );

    try {
      const result = await generateStrainData(query, {
        mode: 'details',
        selectedName: baseSelected,
        limit: 5,
        forceRefresh: true,
      });
      const nextMatches = result.matches?.length ? result.matches : current.matches || [];

      let nextSelected = baseSelected;
      if (!refreshName && !refreshSelected && nextMatches.length > 1) {
        const currentIndex = nextMatches.findIndex((match) => match.name === baseSelected);
        const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % nextMatches.length : 0;
        nextSelected = nextMatches[nextIndex]?.name || baseSelected;
      }

      const fallbackMatch = nextMatches.find((match) => match.name === nextSelected);
      const mapped = mapStrainDetails(result.details || fallbackMatch || { name: nextSelected });
      const nextMatchCursor = nextMatches.findIndex((match) => match.name === nextSelected);

      setBatchItems((prev) =>
        prev.map((item, index) =>
          index === idx
            ? {
                ...item,
                strain: mapped.name || nextSelected,
                variety: mapped.variety || '',
                thc_percent: mapped.thc_percent !== '' ? String(mapped.thc_percent) : '',
                effects: mapped.effects?.length ? mapped.effects.join(', ') : '',
                flavors: mapped.flavors?.length ? mapped.flavors.join(', ') : '',
                may_relieve: mapped.may_relieve?.length ? mapped.may_relieve.join(', ') : '',
                terpenes: mapped.terpenes?.length ? mapped.terpenes.join(', ') : '',
                lineage: mapped.lineage || '',
                description: mapped.description || '',
                input: query,
                matches: nextMatches,
                selectedName: nextSelected,
                matchCursor: nextMatchCursor >= 0 ? nextMatchCursor : 0,
                refreshName: '',
                refreshSelectedName: '',
                isRefreshing: false,
              }
            : item
        )
      );
    } catch (error) {
      setBatchItems((prev) =>
        prev.map((item, index) =>
          index === idx ? { ...item, isRefreshing: false } : item
        )
      );
      toast({ title: 'Refresh failed', status: 'error' });
    }
  };

  const handleAcceptDetails = (detailsOverride = null) => {
    const override = detailsOverride ? mapStrainDetails(detailsOverride) : null;
    const requiredFields = [
      'strain',
      'variety',
      'thc_percent',
      'effects',
      'flavors',
      'may_relieve',
      'terpenes',
      'lineage',
      'description',
    ];
    const formValues = {
      strain: override?.name || watch('strain') || strainSearch,
      variety: override?.variety || watch('variety') || '',
      thc_percent: override?.thc_percent !== '' && override?.thc_percent !== undefined
        ? String(override.thc_percent)
        : previewThc,
      effects: override?.effects?.length ? override.effects.join(', ') : watch('effects') || '',
      flavors: override?.flavors?.length ? override.flavors.join(', ') : watch('flavors') || '',
      may_relieve: override?.may_relieve?.length ? override.may_relieve.join(', ') : watch('may_relieve') || '',
      terpenes: override?.terpenes?.length ? override.terpenes.join(', ') : watch('terpenes') || '',
      lineage: override?.lineage || watch('lineage') || '',
      description: override?.description || watch('description') || '',
      priceTier: watch('priceTier') || '',
      isPrePack: watch('isPrePack') || false,
    };

    const missing = requiredFields.filter((field) => !formValues[field]);
    if (missing.length > 0) {
      toast({
        title: 'Missing strain data',
        description: `Fill: ${missing.join(', ')}`,
        status: 'warning',
      });
      return;
    }
    if (!formValues.priceTier) {
      toast({ title: 'Select a price tier', status: 'warning' });
      return;
    }

    setPendingStrains((items) => [...items, formValues]);
    setAddStep(3);
  };

  const buildFlowerFormData = (item) => {
    const formData = new FormData();
    formData.append('strain', item.strain);
    if (item.thc_percent !== '') formData.append('thc_percent', item.thc_percent);
    if (item.variety) formData.append('variety', item.variety);
    if (item.effects) formData.append('effects', item.effects);
    if (item.flavors) formData.append('flavors', item.flavors);
    if (item.may_relieve) formData.append('may_relieve', item.may_relieve);
    if (item.terpenes) formData.append('terpenes', item.terpenes);
    if (item.lineage) formData.append('lineage', item.lineage);
    if (item.description) formData.append('description', item.description);
    if (item.priceTier) formData.append('priceTier', item.priceTier);
    formData.append('isPrePack', item.isPrePack ? 'true' : 'false');
    return formData;
  };

  const handleSubmitPending = () => {
    if (pendingStrains.length === 0) {
      toast({ title: 'Add at least one strain', status: 'warning' });
      return;
    }
    if (pendingStrains.some((item) => !item.priceTier)) {
      toast({ title: 'Select a price tier', status: 'warning' });
      return;
    }

    if (pendingStrains.length === 1 && !editingProduct) {
      const formData = buildFlowerFormData(pendingStrains[0]);
      const compressedFile = compressedImageRef.current;
      const cameraFile = cameraInputRef.current?.files?.[0];
      const galleryFile = fileInputRef.current?.files?.[0];
      if (compressedFile) {
        formData.append('image', compressedFile);
      } else if (cameraFile) {
        formData.append('image', cameraFile);
      } else if (galleryFile) {
        formData.append('image', galleryFile);
      }
      createMutation.mutate(formData);
      return;
    }

    batchCreateMutation.mutate(pendingStrains);
  };

  const rawPreviewThc = watch('thc_percent');
  const previewThc =
    rawPreviewThc === undefined || rawPreviewThc === null || rawPreviewThc === ''
      ? ''
      : String(Math.min(Number(rawPreviewThc), 35));

  const previewValues = {
    strain: strainSearch,
    variety: watch('variety') || '',
    thc_percent: previewThc,
    effects: watch('effects') || '',
    flavors: watch('flavors') || '',
    may_relieve: watch('may_relieve') || '',
    terpenes: watch('terpenes') || '',
    lineage: watch('lineage') || '',
    description: watch('description') || '',
  };

  const toBulletItems = (value) =>
    String(value || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

  if (isLoading) {
    return (
      <Center h="50vh">
        <Spinner size="xl" color="purple.400" />
      </Center>
    );
  }

  return (
    <Box p={4}>
      <VStack spacing={4} align="stretch">
        <HStack justify="space-between">
          <Text fontSize="2xl" fontWeight="bold">
            Flower
          </Text>
          <HStack>
            <Button
              variant="outline"
              colorScheme="purple"
              onClick={() => {
                onBatchOpen();
                registerOverlay(handleBatchClose);
              }}
            >
              Batch Add
            </Button>
            <Button
              leftIcon={<FiPlus />}
              colorScheme="purple"
              onClick={() => {
                onOpen();
                registerOverlay(handleClose);
              }}
            >
              Add
            </Button>
          </HStack>
        </HStack>
        {products.length === 0 ? (
          <Center h="200px">
            <Text color="gray.500">No flower products</Text>
          </Center>
        ) : (
          <Accordion allowToggle>
            {products.map((product) => (
              <AccordionItem key={product._id}>
                <AccordionButton>
                  <Box flex="1" textAlign="left">
                    <HStack>
                      <Text fontWeight="bold">{product.strain}</Text>
                      <Badge colorScheme={product.isActive ? 'green' : 'red'}>
                        {product.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                      {product.isPrePack && (
                        <Badge colorScheme="blue" variant="subtle">
                          Pre-Pack
                        </Badge>
                      )}
                      <FiImage
                        size={14}
                        color={product.image || product.imageUrl ? '#38A169' : '#A0AEC0'}
                        style={{ flexShrink: 0 }}
                      />
                    </HStack>
                  </Box>
                  <Box
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                  >
                    <Switch
                      isChecked={product.isActive}
                      onChange={(e) =>
                        toggleMutation.mutate({
                          id: product._id,
                          isActive: e.target.checked,
                        })
                      }
                    />
                  </Box>
                </AccordionButton>
                <AccordionPanel pb={4}>
                  <HStack justify="space-between" align="start">
                    <HStack spacing={4} align="start">
                      <Image
                        src={resolveMediaUrl(product.imageUrl, product.image)}
                        boxSize="80px"
                        objectFit="cover"
                        borderRadius="md"
                      />
                      <VStack align="start" spacing={1}>
                        <Text fontSize="sm" color="gray.500">
                          {product.variety || product.strainType || 'Variety'} • THC: {product.thc_percent ?? product.thcPercentage ?? '—'}%
                        </Text>
                        <Text fontSize="sm" color="purple.400">
                          {product.priceTier?.name || 'No tier'}
                        </Text>
                      </VStack>
                    </HStack>
                    <HStack>
                      <IconButton
                        icon={<FiEdit2 />}
                        variant="ghost"
                        onClick={() => handleEdit(product)}
                        aria-label="Edit"
                      />
                      <IconButton
                        icon={<FiTrash2 />}
                        variant="ghost"
                        colorScheme="red"
                        onClick={() => {
                            confirmDelete(product).then((confirmed) => {
                              if (confirmed) deleteMutation.mutate(product._id);
                            });
                        }}
                        aria-label="Delete"
                      />
                    </HStack>
                  </HStack>
                </AccordionPanel>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </VStack>

      {/* Modal */}
      <Modal isOpen={isOpen} onClose={handleClose} size="full">
        <ModalOverlay />
        <ModalContent bg={colorMode === 'dark' ? 'gray.800' : 'white'}>
          <ModalHeader>
            {editingProduct ? 'Edit' : 'Add'} Flower
          </ModalHeader>
          <ModalCloseButton />
          <form onSubmit={handleSubmit(onSubmit)}>
            <ModalBody>
              <VStack spacing={4}>
                {/* Image upload */}
                <Box w="100%" textAlign="center">
                  {/* Hidden file inputs: gallery + camera (capture) */}
                  <Input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    onChange={handleImageChange}
                    display="none"
                  />
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    ref={cameraInputRef}
                    onChange={handleCameraChange}
                    style={{ display: 'none' }}
                  />
                  {imagePreview ? (
                    <Box position="relative" display="inline-block">
                      <Image
                        src={imagePreview}
                        maxH="200px"
                        borderRadius="lg"
                      />
                      <HStack position="absolute" bottom={2} right={2} spacing={2}>
                        <IconButton
                          icon={<FiCamera />}
                          onClick={() => {
                            markCameraOpen();
                            cameraInputRef.current.click();
                          }}
                          aria-label="Take photo"
                          size="sm"
                        />
                        <IconButton
                          icon={<FiUpload />}
                          onClick={() => fileInputRef.current.click()}
                          aria-label="Change image"
                          size="sm"
                        />
                      </HStack>
                    </Box>
                  ) : (
                    <HStack spacing={4} justify="center">
                      <Button
                        leftIcon={<FiUpload />}
                        onClick={() => fileInputRef.current.click()}
                      >
                        Upload Image
                      </Button>
                      <Button
                        leftIcon={<FiCamera />}
                        onClick={() => {
                          markCameraOpen();
                          cameraInputRef.current.click();
                        }}
                      >
                        Take Photo
                      </Button>
                    </HStack>
                  )}
                </Box>

                {addStep === 1 && !editingProduct && (
                  <VStack spacing={4} align="stretch">
                    <FormControl isRequired>
                      <FormLabel>Strain name</FormLabel>
                      <Input
                        value={strainInputText}
                        onChange={(e) => setStrainInputText(e.target.value)}
                        placeholder="e.g., Blue Dream"
                      />
                    </FormControl>
                    <Button colorScheme="purple" onClick={handleGenerateMatches} isLoading={isMatchLoading}>
                      Find Match
                    </Button>
                  </VStack>
                )}

                {addStep === 2 && !editingProduct && (
                  <VStack spacing={4} align="stretch">
                    {isDetailsLoading ? (
                      <Center flexDir="column" gap={3} py={10}>
                        <Spinner size="xl" />
                        <Text>Generating details...</Text>
                        {detailProgress.total > 0 && (
                          <Text fontSize="sm" color="gray.500">
                            {detailProgress.current}/{detailProgress.total} • {detailProgress.name}
                          </Text>
                        )}
                      </Center>
                    ) : (
                      <>
                        {strainCandidates.map((candidate, idx) => {
                          const selectedName = candidate.selectedName || candidate.input;
                          const selectedMatch =
                            candidate.matches?.find((match) => match.name === selectedName) ||
                            (selectedName ? { name: selectedName } : null);

                          return (
                            <StrainMatchSelector
                              key={`candidate-${idx}`}
                              title={`Matches for “${candidate.input}”`}
                              matches={candidate.matches || []}
                              selectedMatch={selectedMatch}
                              onSelect={(item) => {
                                const next = strainCandidates.map((entry, index) =>
                                  index === idx ? { ...entry, selectedName: item?.name } : entry
                                );
                                setStrainCandidates(next);
                              }}
                            />
                          );
                        })}
                        <Button colorScheme="purple" onClick={handleGenerateDetails}>
                          Generate Details
                        </Button>
                      </>
                    )}
                  </VStack>
                )}

                {editingProduct && (
                  <VStack spacing={4} align="stretch">
                    <VStack align="start" spacing={1}>
                      <Text fontSize="sm" color="gray.500">Strain</Text>
                      <Text fontWeight="semibold">{watch('strain') || strainSearch || '—'}</Text>
                    </VStack>
                    <HStack spacing={3} flexWrap="wrap">
                      <Badge colorScheme="purple" variant="subtle">
                        {watch('variety') || '—'}
                      </Badge>
                      <Badge colorScheme="green" variant="subtle">
                        THC {previewThc || '—'}%
                      </Badge>
                    </HStack>
                    <Box>
                      <Text fontSize="sm" fontWeight="semibold">Effects</Text>
                      {toBulletItems(watch('effects')).length ? (
                        <Box as="ul" pl={4} fontSize="sm" color="gray.500">
                          {toBulletItems(watch('effects')).map((effect) => (
                            <Box as="li" key={`edit-effect-${effect}`}>{effect}</Box>
                          ))}
                        </Box>
                      ) : (
                        <Text fontSize="sm" color="gray.500">—</Text>
                      )}
                    </Box>
                    <Box>
                      <Text fontSize="sm" fontWeight="semibold">Flavors</Text>
                      {toBulletItems(watch('flavors')).length ? (
                        <Box as="ul" pl={4} fontSize="sm" color="gray.500">
                          {toBulletItems(watch('flavors')).map((flavor) => (
                            <Box as="li" key={`edit-flavor-${flavor}`}>{flavor}</Box>
                          ))}
                        </Box>
                      ) : (
                        <Text fontSize="sm" color="gray.500">—</Text>
                      )}
                    </Box>
                    <Box>
                      <Text fontSize="sm" fontWeight="semibold">May Relieve</Text>
                      {toBulletItems(watch('may_relieve')).length ? (
                        <Box as="ul" pl={4} fontSize="sm" color="gray.500">
                          {toBulletItems(watch('may_relieve')).map((relief) => (
                            <Box as="li" key={`edit-relief-${relief}`}>{relief}</Box>
                          ))}
                        </Box>
                      ) : (
                        <Text fontSize="sm" color="gray.500">—</Text>
                      )}
                    </Box>
                    <Box>
                      <Text fontSize="sm" fontWeight="semibold">Terpenes</Text>
                      {toBulletItems(watch('terpenes')).length ? (
                        <Box as="ul" pl={4} fontSize="sm" color="gray.500">
                          {toBulletItems(watch('terpenes')).map((terpene) => (
                            <Box as="li" key={`edit-terpene-${terpene}`}>{terpene}</Box>
                          ))}
                        </Box>
                      ) : (
                        <Text fontSize="sm" color="gray.500">—</Text>
                      )}
                    </Box>
                    <Box>
                      <Text fontSize="sm" fontWeight="semibold">Lineage</Text>
                      <Text fontSize="sm" color="gray.500">{watch('lineage') || '—'}</Text>
                    </Box>
                    {watch('description') ? (
                      <Box>
                        <Text fontSize="sm" fontWeight="semibold">Description</Text>
                        <Text fontSize="sm" color="gray.500">{watch('description')}</Text>
                      </Box>
                    ) : null}
                    <FormControl isRequired>
                      <FormLabel>Price Tier</FormLabel>
                      <Select {...register('priceTier', { required: true })}>
                        <option value="">Select tier</option>
                        {tiers.map((tier) => (
                          <option key={tier._id} value={tier._id}>
                            {tier.name}
                          </option>
                        ))}
                      </Select>
                    </FormControl>
                    <FormControl display="flex" alignItems="center">
                      <Switch
                        id="isPrePack"
                        isChecked={watch('isPrePack') || false}
                        onChange={(e) => setValue('isPrePack', e.target.checked)}
                        mr={3}
                      />
                      <FormLabel htmlFor="isPrePack" mb="0">
                        Pre-Pack
                      </FormLabel>
                    </FormControl>
                  </VStack>
                )}

                {addStep === 3 && !editingProduct && (
                  <VStack spacing={4} align="stretch">
                    <Text fontWeight="semibold">Preview strains</Text>
                    {pendingStrains.length === 0 ? (
                      <Text color="gray.500">No strains added yet.</Text>
                    ) : (
                      pendingStrains.map((item, idx) => (
                        <Box key={`${item.strain}-${idx}`} borderWidth="1px" borderRadius="md" p={3}>
                          <VStack align="stretch" spacing={3}>
                            <VStack align="stretch" spacing={1}>
                              <HStack justify="space-between" align="center">
                                <Text fontWeight="bold" fontSize="lg">{item.strain}</Text>
                                <Button
                                  size="xs"
                                  variant="outline"
                                  onClick={() => {
                                    setPendingStrains((prev) =>
                                      prev.map((entry, entryIndex) =>
                                        entryIndex === idx
                                          ? { ...entry, showRefresh: !entry.showRefresh }
                                          : entry
                                      )
                                    );
                                  }}
                                >
                                  Refresh
                                </Button>
                              </HStack>
                              <HStack spacing={2} flexWrap="wrap">
                                <Badge colorScheme="purple" variant="subtle">
                                  {item.variety || '—'}
                                </Badge>
                                <Badge colorScheme="green" variant="subtle">
                                  THC {item.thc_percent || '—'}%
                                </Badge>
                              </HStack>
                            </VStack>

                            {item.showRefresh && (
                              <VStack align="stretch" spacing={2}>
                                <Input
                                  size="sm"
                                  placeholder="Enter a new strain name"
                                  value={item.refreshName || ''}
                                  onChange={(e) => {
                                    const nextValue = e.target.value;
                                    setPendingStrains((prev) =>
                                      prev.map((entry, entryIndex) =>
                                        entryIndex === idx
                                          ? { ...entry, refreshName: nextValue }
                                          : entry
                                      )
                                    );
                                  }}
                                />
                                {item.matches?.length ? (
                                  <Select
                                    size="sm"
                                    value={item.refreshSelectedName || ''}
                                    onChange={(e) => {
                                      const nextValue = e.target.value;
                                      setPendingStrains((prev) =>
                                        prev.map((entry, entryIndex) =>
                                          entryIndex === idx
                                            ? { ...entry, refreshSelectedName: nextValue }
                                            : entry
                                        )
                                      );
                                    }}
                                  >
                                    <option value="">Select previous match</option>
                                    {item.matches.map((match) => (
                                      <option key={`${item.strain}-match-${match.name}`} value={match.name}>
                                        {match.name}
                                      </option>
                                    ))}
                                  </Select>
                                ) : null}
                                <Button
                                  size="sm"
                                  colorScheme="purple"
                                  onClick={() => refreshPendingStrainAt(idx)}
                                  isLoading={item.isRefreshing}
                                >
                                  Refresh details
                                </Button>
                              </VStack>
                            )}

                            <Box>
                              <Text fontSize="sm" fontWeight="semibold">Effects</Text>
                              {toBulletItems(item.effects).length ? (
                                <Box as="ul" pl={4} fontSize="sm" color="gray.500">
                                  {toBulletItems(item.effects).map((effect) => (
                                    <Box as="li" key={`effect-${idx}-${effect}`}>
                                      {effect}
                                    </Box>
                                  ))}
                                </Box>
                              ) : (
                                <Text fontSize="sm" color="gray.500">—</Text>
                              )}
                            </Box>

                            <Box>
                              <Text fontSize="sm" fontWeight="semibold">Flavors</Text>
                              {toBulletItems(item.flavors).length ? (
                                <Box as="ul" pl={4} fontSize="sm" color="gray.500">
                                  {toBulletItems(item.flavors).map((flavor) => (
                                    <Box as="li" key={`flavor-${idx}-${flavor}`}>
                                      {flavor}
                                    </Box>
                                  ))}
                                </Box>
                              ) : (
                                <Text fontSize="sm" color="gray.500">—</Text>
                              )}
                            </Box>

                            <Box>
                              <Text fontSize="sm" fontWeight="semibold">May Relieve</Text>
                              {toBulletItems(item.may_relieve).length ? (
                                <Box as="ul" pl={4} fontSize="sm" color="gray.500">
                                  {toBulletItems(item.may_relieve).map((relief) => (
                                    <Box as="li" key={`relief-${idx}-${relief}`}>
                                      {relief}
                                    </Box>
                                  ))}
                                </Box>
                              ) : (
                                <Text fontSize="sm" color="gray.500">—</Text>
                              )}
                            </Box>

                            <Box>
                              <Text fontSize="sm" fontWeight="semibold">Terpenes</Text>
                              {toBulletItems(item.terpenes).length ? (
                                <Box as="ul" pl={4} fontSize="sm" color="gray.500">
                                  {toBulletItems(item.terpenes).map((terpene) => (
                                    <Box as="li" key={`terpene-${idx}-${terpene}`}>
                                      {terpene}
                                    </Box>
                                  ))}
                                </Box>
                              ) : (
                                <Text fontSize="sm" color="gray.500">—</Text>
                              )}
                            </Box>

                            <Box>
                              <Text fontSize="sm" fontWeight="semibold">Lineage</Text>
                              <Text fontSize="sm" color="gray.500">{item.lineage || '—'}</Text>
                            </Box>

                            {item.description ? (
                              <Box>
                                <Text fontSize="sm" fontWeight="semibold">Description</Text>
                                <Text fontSize="sm" color="gray.500">{item.description}</Text>
                              </Box>
                            ) : null}
                          </VStack>
                          <FormControl isRequired mt={3}>
                            <FormLabel>Price Tier</FormLabel>
                            <Select
                              value={item.priceTier || ''}
                              onChange={(e) => {
                                const next = pendingStrains.map((entry, entryIndex) =>
                                  entryIndex === idx ? { ...entry, priceTier: e.target.value } : entry
                                );
                                setPendingStrains(next);
                              }}
                            >
                              <option value="">Select tier</option>
                              {tiers.map((tier) => (
                                <option key={tier._id} value={tier._id}>
                                  {tier.name}
                                </option>
                              ))}
                            </Select>
                          </FormControl>
                        </Box>
                      ))
                    )}
                    <Button colorScheme="purple" onClick={handleSubmitPending}>
                      Finish Product
                    </Button>
                  </VStack>
                )}
              </VStack>
            </ModalBody>
            <ModalFooter>
              <Button variant="ghost" mr={3} onClick={handleClose}>
                Cancel
              </Button>
              {editingProduct && (
                <Button colorScheme="purple" type="submit">
                  Save
                </Button>
              )}
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>

      <ConfirmDialog />

      {/* Batch Add Modal */}
      <Modal isOpen={isBatchOpen} onClose={handleBatchClose} size="xl">
        <ModalOverlay />
        <ModalContent bg={colorMode === 'dark' ? 'gray.800' : 'white'}>
          <ModalHeader>Batch Add Flower</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4} align="stretch">
              <HStack justify="space-between">
                <Text fontWeight="semibold">Step {batchStep} of 4</Text>
                {batchStep > 1 && batchStep < 4 && (
                  <Button variant="ghost" onClick={() => setBatchStep(batchStep - 1)} isDisabled={isBatchLoading}>
                    Back
                  </Button>
                )}
              </HStack>

              {batchStep === 1 && (
                <VStack spacing={4} align="stretch">
                  <Text fontSize="sm" color="gray.500">
                    How many strains are you adding?
                  </Text>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={batchCount || ''}
                    onChange={(e) => {
                      const next = Number(e.target.value) || 0;
                      setBatchCount(next);
                    }}
                    placeholder="e.g., 5"
                  />
                  <Button colorScheme="purple" onClick={handleBatchCountNext}>
                    Next
                  </Button>
                </VStack>
              )}

              {batchStep === 2 && (
                <VStack spacing={4} align="stretch">
                  {batchStrains.map((value, idx) => (
                    <FormControl key={`batch-strain-${idx}`} isRequired>
                      <FormLabel>Strain #{idx + 1}</FormLabel>
                      <Input
                        value={value}
                        onChange={(e) => {
                          const next = e.target.value;
                          setBatchStrains((prev) =>
                            prev.map((v, i) => (i === idx ? next : v))
                          );
                        }}
                        placeholder="Strain name"
                      />
                    </FormControl>
                  ))}
                  <Button colorScheme="purple" onClick={handleBatchFindMatches} isLoading={isBatchLoading}>
                    Find Matches
                  </Button>
                </VStack>
              )}

              {batchStep === 3 && (
                <VStack spacing={4} align="stretch">
                  {isBatchLoading ? (
                    <Center flexDir="column" gap={3} py={10}>
                      <Spinner size="xl" />
                      <Text>
                        {batchProgress.total > 0 ? 'Generating details...' : 'Loading close matches...'}
                      </Text>
                      {batchProgress.total > 0 && (
                        <Text fontSize="sm" color="gray.500">
                          {batchProgress.current}/{batchProgress.total} • {batchProgress.name}
                        </Text>
                      )}
                    </Center>
                  ) : (
                    <>
                      {batchCandidates.map((candidate, idx) => {
                        const selectedName = candidate.selectedName || candidate.input;
                        const selectedMatch =
                          candidate.matches?.find((match) => match.name === selectedName) ||
                          (selectedName ? { name: selectedName } : null);

                        return (
                          <StrainMatchSelector
                            key={`batch-candidate-${idx}`}
                            title={`Matches for “${candidate.input}”`}
                            matches={candidate.matches || []}
                            selectedMatch={selectedMatch}
                            onSelect={(item) => {
                              const next = batchCandidates.map((entry, index) =>
                                index === idx ? { ...entry, selectedName: item?.name } : entry
                              );
                              setBatchCandidates(next);
                            }}
                          />
                        );
                      })}
                      <Button colorScheme="purple" onClick={handleBatchGenerateDetails}>
                        Generate Details
                      </Button>
                    </>
                  )}
                </VStack>
              )}

              {batchStep === 4 && batchItems.length > 0 && (
                <VStack spacing={4} align="stretch">
                  <Text fontWeight="semibold">Preview strains</Text>
                  {batchItems.map((item, idx) => (
                    <Box key={`${item.strain}-${idx}`} borderWidth="1px" borderRadius="md" p={3}>
                      <HStack justify="space-between" align="center" mb={1}>
                        <Text fontWeight="bold">{item.strain}</Text>
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => {
                            setBatchItems((prev) =>
                              prev.map((entry, entryIndex) =>
                                entryIndex === idx
                                  ? { ...entry, showRefresh: !entry.showRefresh }
                                  : entry
                              )
                            );
                          }}
                        >
                          Refresh
                        </Button>
                      </HStack>
                      <Text fontSize="sm">{item.variety || '—'} • THC: {item.thc_percent || '—'}%</Text>
                      <Text fontSize="sm" color="gray.500">effects: {item.effects || '—'}</Text>
                      <Text fontSize="sm" color="gray.500">flavors: {item.flavors || '—'}</Text>
                      <Text fontSize="sm" color="gray.500">may_relieve: {item.may_relieve || '—'}</Text>
                      <Text fontSize="sm" color="gray.500">terpenes: {item.terpenes || '—'}</Text>
                      <Text fontSize="sm" color="gray.500">lineage: {item.lineage || '—'}</Text>
                      <Text fontSize="sm" color="gray.500">description: {item.description || '—'}</Text>
                      {item.showRefresh && (
                        <VStack align="stretch" spacing={2} mt={3}>
                          <Input
                            size="sm"
                            placeholder="Enter a new strain name"
                            value={item.refreshName || ''}
                            onChange={(e) => {
                              const nextValue = e.target.value;
                              setBatchItems((prev) =>
                                prev.map((entry, entryIndex) =>
                                  entryIndex === idx
                                    ? { ...entry, refreshName: nextValue }
                                    : entry
                                )
                              );
                            }}
                          />
                          {item.matches?.length ? (
                            <Select
                              size="sm"
                              value={item.refreshSelectedName || ''}
                              onChange={(e) => {
                                const nextValue = e.target.value;
                                setBatchItems((prev) =>
                                  prev.map((entry, entryIndex) =>
                                    entryIndex === idx
                                      ? { ...entry, refreshSelectedName: nextValue }
                                      : entry
                                  )
                                );
                              }}
                            >
                              <option value="">Select previous match</option>
                              {item.matches.map((match) => (
                                <option key={`${item.strain}-batch-match-${match.name}`} value={match.name}>
                                  {match.name}
                                </option>
                              ))}
                            </Select>
                          ) : null}
                          <Button
                            size="sm"
                            colorScheme="purple"
                            onClick={() => refreshBatchItemAt(idx)}
                            isLoading={item.isRefreshing}
                          >
                            Refresh details
                          </Button>
                        </VStack>
                      )}
                      <FormControl mt={3} isRequired>
                        <FormLabel>Price Tier</FormLabel>
                        <Select
                          value={item.priceTier || ''}
                          onChange={(e) => updateBatchItemAt(idx, { priceTier: e.target.value })}
                        >
                          <option value="">Select tier</option>
                          {tiers.map((tier) => (
                            <option key={tier._id} value={tier._id}>
                              {tier.name}
                            </option>
                          ))}
                        </Select>
                      </FormControl>
                    </Box>
                  ))}
                  <Button
                    colorScheme="purple"
                    isLoading={batchCreateMutation.isPending}
                    onClick={() => {
                      const invalid = batchItems.find((item) => !validateBatchItem(item));
                      if (invalid) return;
                      batchCreateMutation.mutate(batchItems);
                    }}
                  >
                    Create {batchItems.length} Strains
                  </Button>
                </VStack>
              )}
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={handleBatchClose}>
              Cancel
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default Flowers;

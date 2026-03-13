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
import { FiPlus, FiEdit2, FiTrash2, FiCamera, FiUpload } from 'react-icons/fi';
import { useForm } from 'react-hook-form';
import { productService } from '../../services';
import { useOverlayStack } from '../../context';
import { useStrainGeneration } from '../../hooks';
import { StrainMatchSelector } from '../../components';
import { useConfirmDialog } from '../../components/ConfirmDialog';

const resolveMediaUrl = (mediaUrl, mediaPath) => (
  mediaUrl || (mediaPath ? `/uploads/${mediaPath.replace('uploads/', '')}` : null)
);

const PackagedFlowers = () => {
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
    const [videoPreview, setVideoPreview] = useState(null);
    const [videoFile, setVideoFile] = useState(null);
    const fileInputRef = useRef();
    const cameraInputRef = useRef();
    const videoInputRef = useRef();
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
    const [strainMatches, setStrainMatches] = useState([]);
    const [strainSample, setStrainSample] = useState(null);
    const [isStrainSearching, setIsStrainSearching] = useState(false);
    const [strainInputText, setStrainInputText] = useState('');
    const [strainCandidates, setStrainCandidates] = useState([]);
    const [isMatchLoading, setIsMatchLoading] = useState(false);
    const [isDetailsLoading, setIsDetailsLoading] = useState(false);
    const [detailProgress, setDetailProgress] = useState({ current: 0, total: 0, name: '' });
    const [batchStep, setBatchStep] = useState(1);
    const [batchCount, setBatchCount] = useState('');
    const [batchStrains, setBatchStrains] = useState([]);
    const [batchCandidates, setBatchCandidates] = useState([]);
    const [batchItems, setBatchItems] = useState([]);
    const [isBatchLoading, setIsBatchLoading] = useState(false);
    const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, name: '' });
    const [batchBase, setBatchBase] = useState({
      packagingType: '',
      brand: '',
      weight: '',
      price: '',
    });
    const { generateStrainData } = useStrainGeneration({
      setIsSearching: setIsStrainSearching,
      toast,
    });
    const { confirm, ConfirmDialog } = useConfirmDialog();

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

    const { data, isLoading } = useQuery({
      queryKey: ['packagedFlowers'],
      queryFn: productService.getPackagedFlowers,
    });
    const products = data?.products || [];

    const createMutation = useMutation({
      mutationFn: productService.createPackagedFlower,
      onSuccess: () => {
        queryClient.invalidateQueries(['packagedFlowers']);
        toast({ title: 'Product created', status: 'success' });
        handleClose();
        navigate('/products/packaged', { replace: true });
      },
      onError: (error) => {
        toast({ title: 'Error', description: error.message, status: 'error' });
      },
    });

    const updateMutation = useMutation({
      mutationFn: ({ id, data }) => productService.updatePackagedFlower(id, data),
      onSuccess: () => {
        queryClient.invalidateQueries(['packagedFlowers']);
        toast({ title: 'Product updated', status: 'success' });
        handleClose();
      },
      onError: (error) => {
        toast({ title: 'Error', description: error.message, status: 'error' });
      },
    });

    const deleteMutation = useMutation({
      mutationFn: productService.deletePackagedFlower,
      onSuccess: () => {
        queryClient.invalidateQueries(['packagedFlowers']);
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
        return productService.updatePackagedFlower(id, formData);
      },
      onSuccess: () => {
        queryClient.invalidateQueries(['packagedFlowers']);
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
      try { unregisterOverlay(handleClose); } catch (err) {}
      setEditingProduct(null);
      setImagePreview(null);
      setVideoPreview(null);
      setVideoFile(null);
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

    const handleBatchClose = () => {
      setBatchStep(1);
      setBatchCount('');
      setBatchStrains([]);
      setBatchCandidates([]);
      setBatchItems([]);
      setIsBatchLoading(false);
      setBatchProgress({ current: 0, total: 0, name: '' });
      setBatchBase({ packagingType: '', brand: '', weight: '', price: '' });
      onBatchClose();
    };

    const handleEdit = (product) => {
      setEditingProduct(product);
      setValue('brand', product.brand);
      setValue('packagingType', product.packagingType || '');
      setValue('strain', product.strain);
      setStrainSearch(product.strain || '');
      setValue('packagingType', product.packagingType || '');
      setValue('variety', product.variety || product.strainType || '');
      setValue('thc_percent', product.thc_percent ?? product.thcPercentage ?? '');
      setValue('effects', Array.isArray(product.effects) ? product.effects.join(', ') : '');
      setValue('flavors', Array.isArray(product.flavors) ? product.flavors.join(', ') : '');
      setValue('may_relieve', Array.isArray(product.may_relieve) ? product.may_relieve.join(', ') : '');
      setValue('terpenes', Array.isArray(product.terpenes) ? product.terpenes.join(', ') : '');
      setValue('lineage', product.lineage || '');
      setValue('weight', product.weight);
      setValue('price', product.price);
      setValue('description', product.description);
      if (product.image) {
        setImagePreview(resolveMediaUrl(product.imageUrl, product.image));
      }
      if (product.video) {
        setVideoPreview(resolveMediaUrl(product.videoUrl, product.video));
      } else {
        setVideoPreview(null);
      }
      setAddStep(2);
      onOpen();
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

    const validateVideoDuration = (file) => new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src);
        resolve(video.duration <= 15);
      };
      video.onerror = () => resolve(false);
      video.src = URL.createObjectURL(file);
    });

    const handleVideoChange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const isValid = await validateVideoDuration(file);
      if (!isValid) {
        toast({ title: 'Video too long', description: 'Max length is 15 seconds.', status: 'warning' });
        if (videoInputRef.current) videoInputRef.current.value = '';
        setVideoPreview(null);
        setVideoFile(null);
        return;
      }
      const nextUrl = URL.createObjectURL(file);
      setVideoPreview(nextUrl);
      setVideoFile(file);
    };

    useEffect(() => {
      if (videoPreview && videoPreview.startsWith('blob:')) {
        return () => URL.revokeObjectURL(videoPreview);
      }
      return undefined;
    }, [videoPreview]);

    const handleCameraChange = async (e) => {
      try {
        window.__lastCameraAccept = Date.now();
        window.__ignoreNextPopState = true;
        window.__ignorePopStateUntil = Date.now() + 3000;
        window.history.pushState(null, '', window.location.href);
      } catch (err) {}
      const file = e.target.files[0];
      if (file) {
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
            const compressedFile = new File([blob], file.name || `photo.jpg`, { type: 'image/jpeg' });
            compressedImageRef.current = compressedFile;
            const reader = new FileReader();
            reader.onloadend = () => {
              setImagePreview(reader.result);
              try { window.__lastCameraAccept = Date.now(); } catch (err) {}
              try { window.history.pushState(null, '', window.location.href); } catch (err) {}
            };
            reader.readAsDataURL(compressedFile);
          } else {
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

      const brand =
        raw.brand ||
        raw.producer ||
        raw.vendor ||
        raw.company ||
        '';

      return {
        name,
        variety,
        thc_percent: cappedThc === '' ? '' : String(cappedThc),
        description,
        brand,
        effects: normalizeList(raw.effects),
        flavors: normalizeList(raw.flavors),
        may_relieve: normalizeList(raw.may_relieve || raw.medical_purpose),
        terpenes: normalizeList(raw.terpenes),
        lineage,
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
      setValue('brand', '');
      setValue('variety', '');
      setValue('thc_percent', '');
      setValue('effects', '');
      setValue('flavors', '');
      setValue('may_relieve', '');
      setValue('terpenes', '');
      setValue('lineage', '');
      setValue('description', '');
      setValue('weight', '');
      setValue('price', '');
    };

    const applyStrainToForm = (raw) => {
      const details = mapStrainDetails(raw);
      if (details.name) setValue('strain', details.name);
      if (details.name) setStrainSearch(details.name);
      if (details.brand) setValue('brand', details.brand);
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
              brand: watch('brand') || '',
              packagingType: watch('packagingType') || '',
              weight: watch('weight') || '',
              price: watch('price') || '',
              variety: mapped.variety || '',
              thc_percent: mapped.thc_percent !== '' ? String(mapped.thc_percent) : '',
              effects: mapped.effects?.length ? mapped.effects.join(', ') : '',
              flavors: mapped.flavors?.length ? mapped.flavors.join(', ') : '',
              may_relieve: mapped.may_relieve?.length ? mapped.may_relieve.join(', ') : '',
              terpenes: mapped.terpenes?.length ? mapped.terpenes.join(', ') : '',
              lineage: mapped.lineage || '',
              description: mapped.description || '',
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
        setAddStep(4);
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

    const handleGenerateMatches = async () => {
      const names = parseStrainInputs(strainInputText);
      if (names.length === 0) {
        toast({ title: 'Enter at least one strain', status: 'warning' });
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
        setAddStep(3);
      } finally {
        setIsMatchLoading(false);
      }
    };

    const buildPackagedFormData = (item) => {
      const formData = new FormData();
      formData.append('strain', item.strain);
      if (item.brand) formData.append('brand', item.brand);
      if (item.packagingType) formData.append('packagingType', item.packagingType);
      if (item.thc_percent !== '') formData.append('thc_percent', item.thc_percent);
      if (item.variety) formData.append('variety', item.variety);
      if (item.effects) formData.append('effects', item.effects);
      if (item.flavors) formData.append('flavors', item.flavors);
      if (item.may_relieve) formData.append('may_relieve', item.may_relieve);
      if (item.terpenes) formData.append('terpenes', item.terpenes);
      if (item.lineage) formData.append('lineage', item.lineage);
      if (item.description) formData.append('description', item.description);
      if (item.weight) formData.append('weight', item.weight);
      if (item.price) formData.append('price', item.price);
      return formData;
    };

    const batchCreateMutation = useMutation({
      mutationFn: async (items) => {
        await Promise.all(items.map((item) => productService.createPackagedFlower(buildPackagedFormData(item))));
      },
      onSuccess: () => {
        queryClient.invalidateQueries(['packagedFlowers']);
        toast({ title: 'Products created', status: 'success' });
        handleBatchClose();
        navigate('/products/packaged', { replace: true });
      },
      onError: (error) => {
        toast({ title: 'Batch create failed', description: error.message, status: 'error' });
      },
    });

    const handleBatchStep1Next = () => {
      const requiredFields = ['packagingType', 'brand', 'weight', 'price'];
      const missing = requiredFields.filter((field) => !batchBase[field]);
      if (missing.length > 0) {
        toast({
          title: 'Missing details',
          description: `Fill: ${missing.join(', ')}`,
          status: 'warning',
        });
        return;
      }
      const count = Number(batchCount);
      if (!Number.isFinite(count) || count < 1) {
        toast({ title: 'Enter a valid strain count', status: 'warning' });
        return;
      }
      const nextStrains = Array.from({ length: count }, (_, idx) => batchStrains[idx] || '');
      setBatchStrains(nextStrains);
      setBatchStep(2);
    };

    const handleBatchStep2Next = async () => {
      const trimmed = batchStrains.map((name) => name.trim());
      if (trimmed.some((name) => !name)) {
        toast({ title: 'Fill every strain name', status: 'warning' });
        return;
      }
      setBatchProgress({ current: 0, total: 0, name: '' });
      setIsBatchLoading(true);
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
        const items = [];
        for (let i = 0; i < batchCandidates.length; i += 1) {
          const candidate = batchCandidates[i];
          const selectedName = candidate.selectedName || candidate.input;
          const matchCursor = (candidate.matches || []).findIndex(
            (match) => match.name === selectedName
          );
          setBatchProgress({ current: i + 1, total: batchCandidates.length, name: selectedName });
          const result = await generateStrainData(candidate.input, {
            mode: 'details',
            selectedName,
            limit: 5,
          });
          const fallbackMatch = (candidate.matches || []).find((match) => match.name === selectedName);
          const mapped = mapStrainDetails(result.details || fallbackMatch || { name: selectedName });
          items.push({
            strain: mapped.name || selectedName,
            brand: batchBase.brand,
            packagingType: batchBase.packagingType,
            weight: batchBase.weight,
            price: batchBase.price,
            variety: mapped.variety || '',
            thc_percent: mapped.thc_percent !== '' ? String(mapped.thc_percent) : '',
            effects: mapped.effects?.length ? mapped.effects.join(', ') : '',
            flavors: mapped.flavors?.length ? mapped.flavors.join(', ') : '',
            may_relieve: mapped.may_relieve?.length ? mapped.may_relieve.join(', ') : '',
            terpenes: mapped.terpenes?.length ? mapped.terpenes.join(', ') : '',
            lineage: mapped.lineage || '',
            description: mapped.description || '',
            input: candidate.input,
            matches: candidate.matches || [],
            selectedName,
            matchCursor: matchCursor >= 0 ? matchCursor : 0,
            refreshName: '',
            refreshSelectedName: '',
            isRefreshing: false,
            showRefresh: false,
          });
        }
        setBatchItems(items);
        setBatchStep(4);
      } finally {
        setIsBatchLoading(false);
      }
    };

    const handleSubmitPending = () => {
      if (pendingStrains.length === 0) {
        toast({ title: 'Add at least one strain', status: 'warning' });
        return;
      }

      if (pendingStrains.length === 1 && !editingProduct) {
        const formData = buildPackagedFormData(pendingStrains[0]);
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
        if (videoFile) {
          formData.append('video', videoFile);
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
      brand: watch('brand') || '',
      packagingType: watch('packagingType') || '',
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

    const onSubmit = (data) => {
      if (editingProduct) {
        if (!data.price && data.price !== 0) {
          toast({ title: 'Enter a price', status: 'warning' });
          return;
        }
        const formData = new FormData();
        formData.append('price', data.price);
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
        if (videoFile) {
          formData.append('video', videoFile);
        }
        updateMutation.mutate({ id: editingProduct._id, data: formData });
        return;
      }

      const requiredFields = [
        'strain',
        'packagingType',
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
      if (videoFile) {
        formData.append('video', videoFile);
      }
      createMutation.mutate(formData);
    };

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
            <Text fontSize="2xl" fontWeight="bold">Pre-Pack Flower</Text>
            <HStack>
              <Button
                variant="outline"
                colorScheme="purple"
                onClick={onBatchOpen}
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
              >Add</Button>
            </HStack>
          </HStack>
          {products.length === 0 ? (
            <Center h="200px">
              <Text color="gray.500">No pre-pack flower products</Text>
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
                        {product.image && (
                          <Image
                            src={resolveMediaUrl(product.imageUrl, product.image)}
                            boxSize="80px"
                            objectFit="cover"
                            borderRadius="md"
                          />
                        )}
                        <VStack align="start" spacing={1}>
                          <Text fontSize="sm" color="gray.500">
                            {product.variety || product.strainType || 'Variety'} • THC: {product.thc_percent ?? product.thcPercentage ?? '—'}%
                          </Text>
                          <Text fontSize="sm" color="gray.500">Packaging: {product.packagingType || '—'}</Text>
                          <Text fontSize="sm" color="gray.500">Brand: {product.brand || '—'}</Text>
                          <Text fontSize="sm" color="purple.400">
                            {product.price ? `$${product.price}` : 'No price'}
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
        <Modal isOpen={isOpen} onClose={handleClose} size="full">
          <ModalOverlay />
          <ModalContent bg={colorMode === 'dark' ? 'gray.800' : 'white'}>
            <ModalHeader>{editingProduct ? 'Edit' : 'Add'} Pre-Pack Flower</ModalHeader>
            <ModalCloseButton />
            <form onSubmit={handleSubmit(onSubmit)}>
              <ModalBody>
                <VStack spacing={4}>
                  <Box w="100%" textAlign="center">
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
                    <Input
                      type="file"
                      accept="video/*"
                      ref={videoInputRef}
                      onChange={handleVideoChange}
                      display="none"
                    />
                    {imagePreview ? (
                      <Box position="relative" display="inline-block">
                        <Image src={imagePreview} maxH="200px" borderRadius="lg" />
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
                        <Button leftIcon={<FiUpload />} onClick={() => fileInputRef.current.click()}>
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

                  <Box w="100%" textAlign="center">
                    {videoPreview ? (
                      <Box position="relative" display="inline-block">
                        <Box
                          as="video"
                          src={videoPreview}
                          maxH="200px"
                          borderRadius="lg"
                          controls
                        />
                        <HStack position="absolute" bottom={2} right={2} spacing={2}>
                          <IconButton
                            icon={<FiUpload />}
                            onClick={() => videoInputRef.current.click()}
                            aria-label="Change video"
                          />
                        </HStack>
                      </Box>
                    ) : (
                      <Button leftIcon={<FiUpload />} onClick={() => videoInputRef.current.click()}>
                        Upload Video (15s max)
                      </Button>
                    )}
                  </Box>
                  {addStep === 1 && !editingProduct && (
                    <VStack spacing={4} align="stretch">
                      <FormControl isRequired>
                        <FormLabel>Packaging Type</FormLabel>
                        <Select {...register('packagingType', { required: true })}>
                          <option value="">Select packaging</option>
                          <option value="bag">Bag</option>
                          <option value="jar">Jar</option>
                          <option value="pre-roll">Pre-roll</option>
                        </Select>
                      </FormControl>
                      <FormControl isRequired>
                        <FormLabel>Brand</FormLabel>
                        <Input {...register('brand', { required: true })} />
                      </FormControl>
                      <FormControl isRequired>
                        <FormLabel>Weight</FormLabel>
                        <Input {...register('weight', { required: true })} placeholder="e.g., 3.5g, 7g" />
                      </FormControl>
                      <FormControl isRequired>
                        <FormLabel>Price ($)</FormLabel>
                        <Input type="number" step="0.01" {...register('price', { required: true })} />
                      </FormControl>
                      <Button
                        colorScheme="purple"
                        onClick={() => {
                          const requiredFields = ['packagingType', 'brand', 'weight', 'price'];
                          const missing = requiredFields.filter((field) => !watch(field));
                          if (missing.length > 0) {
                            toast({
                              title: 'Missing details',
                              description: `Fill: ${missing.join(', ')}`,
                              status: 'warning',
                            });
                            return;
                          }
                          setAddStep(2);
                        }}
                      >
                        Next
                      </Button>
                    </VStack>
                  )}

                  {addStep === 2 && !editingProduct && (
                    <VStack spacing={4} align="stretch">
                      <FormControl isRequired>
                        <FormLabel>Strain name</FormLabel>
                        <Textarea
                          value={strainInputText}
                          onChange={(e) => setStrainInputText(e.target.value)}
                          placeholder="Pink Runtz"
                        />
                      </FormControl>
                      <Button colorScheme="purple" onClick={handleGenerateMatches} isLoading={isMatchLoading}>
                        {parseStrainInputs(strainInputText).length > 1 ? 'Find Matches' : 'Find Match'}
                      </Button>
                    </VStack>
                  )}

                  {addStep === 3 && !editingProduct && (
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
                      <HStack spacing={2} flexWrap="wrap">
                        <Badge colorScheme="purple" variant="subtle">
                          {watch('variety') || '—'}
                        </Badge>
                        <Badge colorScheme="green" variant="subtle">
                          THC {previewThc || '—'}%
                        </Badge>
                      </HStack>
                      <VStack align="start" spacing={1}>
                        <Text fontSize="sm" color="gray.500">Brand</Text>
                        <Text fontWeight="semibold">{watch('brand') || '—'}</Text>
                      </VStack>
                      <VStack align="start" spacing={1}>
                        <Text fontSize="sm" color="gray.500">Packaging</Text>
                        <Text fontWeight="semibold">{watch('packagingType') || '—'}</Text>
                      </VStack>
                      <VStack align="start" spacing={1}>
                        <Text fontSize="sm" color="gray.500">Weight</Text>
                        <Text fontWeight="semibold">{watch('weight') || '—'}</Text>
                      </VStack>
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
                        <FormLabel>Price ($)</FormLabel>
                        <Input type="number" step="0.01" {...register('price', { required: true })} />
                      </FormControl>
                    </VStack>
                  )}

                  {addStep === 4 && !editingProduct && (
                    <VStack spacing={4} align="stretch">
                      <Text fontWeight="semibold">Preview strains</Text>
                      {pendingStrains.length === 0 ? (
                        <Text color="gray.500">No strains added yet.</Text>
                      ) : (
                        pendingStrains.map((item, idx) => (
                          <Box key={`${item.strain}-${idx}`} borderWidth="1px" borderRadius="md" p={3}>
                            <HStack justify="space-between" align="center" mb={1}>
                              <Text fontWeight="bold">{item.strain}</Text>
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
                            <Text fontSize="sm">{item.variety} • THC: {item.thc_percent}%</Text>
                            <Text fontSize="sm" color="gray.500">Packaging: {item.packagingType || '—'}</Text>
                            <Text fontSize="sm" color="gray.500" noOfLines={2}>
                              {item.description}
                            </Text>
                            {item.showRefresh && (
                              <VStack align="stretch" spacing={2} mt={3}>
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
                                      )
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
                          </Box>
                        ))
                      )}
                      <Button colorScheme="purple" onClick={handleSubmitPending}>
                        {pendingStrains.length > 1 ? 'Add Strains' : 'Add Strain'}
                      </Button>
                    </VStack>
                  )}
                </VStack>
              </ModalBody>
              <ModalFooter>
                <Button variant="ghost" mr={3} onClick={handleClose}>Cancel</Button>
                {editingProduct && (
                  <Button colorScheme="purple" type="submit">
                    Save
                  </Button>
                )}
              </ModalFooter>
            </form>
          </ModalContent>
        </Modal>

        <Modal isOpen={isBatchOpen} onClose={handleBatchClose} size="full">
          <ModalOverlay />
          <ModalContent bg={colorMode === 'dark' ? 'gray.800' : 'white'}>
            <ModalHeader>Batch Add Pre-Pack Flower</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <VStack spacing={4} align="stretch">
                <HStack justify="space-between">
                  <Text fontWeight="semibold">Step {batchStep} of 4</Text>
                  {batchStep > 1 && batchStep < 4 && (
                    <Button variant="ghost" onClick={() => setBatchStep(batchStep - 1)}>
                      Back
                    </Button>
                  )}
                </HStack>

                {batchStep === 1 && (
                  <VStack spacing={4} align="stretch">
                    <FormControl isRequired>
                      <FormLabel>Packaging Type</FormLabel>
                      <Select
                        value={batchBase.packagingType}
                        onChange={(e) => setBatchBase((prev) => ({ ...prev, packagingType: e.target.value }))}
                      >
                        <option value="">Select packaging</option>
                        <option value="bag">Bag</option>
                        <option value="jar">Jar</option>
                        <option value="pre-roll">Pre-roll</option>
                      </Select>
                    </FormControl>
                    <FormControl isRequired>
                      <FormLabel>Brand</FormLabel>
                      <Input
                        value={batchBase.brand}
                        onChange={(e) => setBatchBase((prev) => ({ ...prev, brand: e.target.value }))}
                      />
                    </FormControl>
                    <FormControl isRequired>
                      <FormLabel>Weight</FormLabel>
                      <Input
                        value={batchBase.weight}
                        onChange={(e) => setBatchBase((prev) => ({ ...prev, weight: e.target.value }))}
                        placeholder="e.g., 3.5g, 7g"
                      />
                    </FormControl>
                    <FormControl isRequired>
                      <FormLabel>Price ($)</FormLabel>
                      <Input
                        type="number"
                        step="0.01"
                        value={batchBase.price}
                        onChange={(e) => setBatchBase((prev) => ({ ...prev, price: e.target.value }))}
                      />
                    </FormControl>
                    <FormControl isRequired>
                      <FormLabel>How many strains?</FormLabel>
                      <Input
                          type="number"
                          min={1}
                          value={batchCount}
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (raw === '') {
                              setBatchCount('');
                              return;
                            }
                            const next = Math.max(1, Number(raw));
                            setBatchCount(Number.isNaN(next) ? '' : next);
                          }}
                        />
                    </FormControl>
                    <Button colorScheme="purple" onClick={handleBatchStep1Next}>
                      Next
                    </Button>
                  </VStack>
                )}

                {batchStep === 2 && (
                  <VStack spacing={4} align="stretch">
                    {batchStrains.map((name, idx) => (
                      <FormControl key={`batch-strain-${idx}`} isRequired>
                        <FormLabel>Strain #{idx + 1}</FormLabel>
                        <Input
                          value={name}
                          onChange={(e) => {
                            const next = [...batchStrains];
                            next[idx] = e.target.value;
                            setBatchStrains(next);
                          }}
                          placeholder="Enter strain name"
                        />
                      </FormControl>
                    ))}
                    <Button colorScheme="purple" onClick={handleBatchStep2Next}>
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
                                  index === idx
                                    ? { ...entry, selectedName: item?.name }
                                    : entry
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
                  <VStack spacing={3} align="stretch">
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
                        <Text fontSize="sm">{item.variety} • THC: {item.thc_percent || '—'}%</Text>
                        <Text fontSize="sm" color="gray.500">Packaging: {item.packagingType || '—'}</Text>
                        <Text fontSize="sm" color="gray.500">effects: {item.effects || '—'}</Text>
                        <Text fontSize="sm" color="gray.500">flavors: {item.flavors || '—'}</Text>
                        <Text fontSize="sm" color="gray.500">may_relieve: {item.may_relieve || '—'}</Text>
                        <Text fontSize="sm" color="gray.500">terpenes: {item.terpenes || '—'}</Text>
                        <Text fontSize="sm" color="gray.500">lineage: {item.lineage || '—'}</Text>
                        <Text fontSize="sm" color="purple.400">{item.price ? `$${item.price}` : 'No price'}</Text>
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
                      </Box>
                    ))}
                    <Button colorScheme="purple" onClick={() => batchCreateMutation.mutate(batchItems)}>
                      Add Strains
                    </Button>
                  </VStack>
                )}
              </VStack>
            </ModalBody>
            <ModalFooter>
              <Button variant="ghost" mr={3} onClick={handleBatchClose}>Cancel</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        <ConfirmDialog />
      </Box>
    );
};

export default PackagedFlowers;

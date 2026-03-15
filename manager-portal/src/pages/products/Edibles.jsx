import { useMemo, useState, useRef, useEffect } from 'react';
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
import { useConfirmDialog } from '../../components/ConfirmDialog';

const NO_IMAGE_URL = 'https://cdn.mnloud.com/uploads/noimage.png';

const resolveMediaUrl = (mediaUrl, mediaPath) => (
  mediaUrl || (mediaPath ? `/uploads/${mediaPath.replace('uploads/', '')}` : NO_IMAGE_URL)
);

const Edibles = () => {
  const { register, handleSubmit, reset, setValue, watch } = useForm();
  const navigate = useNavigate();
  const { colorMode } = useColorMode();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [editingProduct, setEditingProduct] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const fileInputRef = useRef();
  const cameraInputRef = useRef();
  const videoInputRef = useRef();
  const compressedImageRef = useRef(null);
  const [variantCount, setVariantCount] = useState('1');
  const [variants, setVariants] = useState([{ name: '' }]);
  const [editVariants, setEditVariants] = useState([]);
  const { register: registerOverlay, unregister: unregisterOverlay } = useOverlayStack?.() || {};
  const [newTypeName, setNewTypeName] = useState('');
  const [typeToRemove, setTypeToRemove] = useState('');
  const { confirm, ConfirmDialog } = useConfirmDialog();

  const { data, isLoading } = useQuery({
    queryKey: ['edibles'],
    queryFn: productService.getEdibles,
  });

  const products = data?.products || [];

  const { data: typeData } = useQuery({
    queryKey: ['edibleTypes'],
    queryFn: productService.getEdibleTypes,
  });
  const edibleTypes = typeData?.types || [];

  const currentEdibleType = watch('edibleType');
  const edibleTypeOptions = useMemo(() => {
    if (!currentEdibleType) return edibleTypes;
    const exists = edibleTypes.some((type) => type.name === currentEdibleType);
    if (exists) return edibleTypes;
    return [{ _id: 'current', name: currentEdibleType }, ...edibleTypes];
  }, [edibleTypes, currentEdibleType]);

  const handleClose = () => {
    try { unregisterOverlay?.(handleClose); } catch (err) {}
    setEditingProduct(null);
    setImagePreview(null);
    setVideoPreview(null);
    setVideoFile(null);
    compressedImageRef.current = null;
    setNewTypeName('');
    setTypeToRemove('');
    setVariantCount('1');
    setVariants([{ name: '' }]);
    setEditVariants([]);
    reset();
    onClose();
  };

  useEffect(() => {
    if (!isOpen || editingProduct) return;
    setVariantCount('1');
    setVariants([{ name: '' }]);
    setValue('variantCount', 1, { shouldDirty: false });
  }, [isOpen, editingProduct, setValue]);

  useEffect(() => {
    if (variantCount === '') return;
    const safeCount = Math.max(1, Number(variantCount) || 1);
    setVariantCount(String(safeCount));
    setVariants((prev) => {
      const next = [...prev];
      while (next.length < safeCount) next.push({ name: '' });
      while (next.length > safeCount) next.pop();
      return next;
    });
  }, [variantCount]);

  useEffect(() => {
    if (!isOpen || editingProduct) return;
    setValue('variantCount', 1, { shouldDirty: false });
  }, [isOpen, editingProduct, setValue]);

  const createMutation = useMutation({
    mutationFn: productService.createEdible,
    onSuccess: () => {
      queryClient.invalidateQueries(['edibles']);
      toast({ title: 'Product created', status: 'success' });
      handleClose();
      navigate('/products/edibles', { replace: true });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, status: 'error' });
    },
  });

  const markCameraOpen = () => {
    try {
      window.__ignoreNextPopState = true;
      window.history.pushState(null, '', window.location.href);
    } catch (err) {}
  };

  const updateMutation = useMutation({
    mutationFn: ({ id, data: payload }) => productService.updateEdible(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries(['edibles']);
      toast({ title: 'Product updated', status: 'success' });
      handleClose();
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, status: 'error' });
    },
  });

  const updateVariantMutation = useMutation({
    mutationFn: ({ id, data: payload }) => productService.updateEdibleVariant(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries(['edibles']);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: productService.deleteEdible,
    onSuccess: () => {
      queryClient.invalidateQueries(['edibles']);
      toast({ title: 'Product deleted', status: 'success' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, status: 'error' });
    },
  });

  const confirmDelete = async (product) => {
    const label = product?.name || product?.edibleType || 'this product';
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
      return productService.updateEdible(id, formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['edibles']);
    },
  });

  const createTypeMutation = useMutation({
    mutationFn: productService.createEdibleType,
    onSuccess: () => {
      queryClient.invalidateQueries(['edibleTypes']);
    },
  });

  const deleteTypeMutation = useMutation({
    mutationFn: productService.deleteEdibleType,
    onSuccess: () => {
      queryClient.invalidateQueries(['edibleTypes']);
    },
  });

  const handleEdit = (product) => {
    setEditingProduct(product);
    setValue('brand', product.brand || '');
    setValue('edibleType', product.edibleType || product.name || '');
    setValue('weight', product.weight || '');
    setValue('price', product.price || '');
    setValue('description', product.description || '');
    setEditVariants(product.variants || []);
    if (product.image) {
      setImagePreview(resolveMediaUrl(product.imageUrl, product.image));
    }
    if (product.video) {
      setVideoPreview(resolveMediaUrl(product.videoUrl, product.video));
    } else {
      setVideoPreview(null);
    }
    onOpen();
  };

  const handleAddType = async () => {
    const trimmed = newTypeName.trim();
    if (!trimmed) return;
    try {
      await createTypeMutation.mutateAsync(trimmed);
      setNewTypeName('');
    } catch (error) {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to add edible type',
        status: 'error',
      });
    }
  };

  const handleDeleteType = async (type) => {
    const shouldDelete = await confirm({
      title: 'Delete type',
      message: `Delete "${type.name}"?`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
    });
    if (!shouldDelete) return;
    try {
      await deleteTypeMutation.mutateAsync(type._id);
      if (typeToRemove === type._id) {
        setTypeToRemove('');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to delete edible type',
        status: 'error',
      });
    }
  };

  const handleRemoveSelectedType = async () => {
    const target = edibleTypes.find((type) => type._id === typeToRemove);
    if (!target) return;
    await handleDeleteType(target);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result);
      reader.readAsDataURL(file);
      compressedImageRef.current = null;
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
          const compressedFile = new File([blob], file.name || 'photo.jpg', { type: 'image/jpeg' });
          compressedImageRef.current = compressedFile;
          const reader = new FileReader();
          reader.onloadend = () => {
            setImagePreview(reader.result);
            try { window.__lastCameraAccept = Date.now(); } catch (err) {}
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

  const onSubmit = (data) => {
    if (editingProduct) {
      if (!data.price && data.price !== 0) {
        toast({ title: 'Enter a price', status: 'warning' });
        return;
      }
      if (!data.edibleType) {
        toast({ title: 'Select an edible type', status: 'warning' });
        return;
      }
      const formData = new FormData();
      formData.append('price', data.price);
      formData.append('edibleType', data.edibleType);
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

    const requiredFields = ['edibleType', 'weight', 'price', 'variantCount'];
    const missing = requiredFields.filter((field) => !data[field]);
    if (missing.length > 0) {
      toast({
        title: 'Missing fields',
        description: `Fill: ${missing.join(', ')}`,
        status: 'warning',
      });
      return;
    }

    const trimmedVariants = variants
      .map((variant) => ({ name: String(variant.name || '').trim() }))
      .filter((variant) => variant.name);
    if (trimmedVariants.length === 0) {
      toast({ title: 'Enter at least one variant', status: 'warning' });
      return;
    }

    const formData = new FormData();
    Object.keys(data).forEach((key) => {
      if (data[key] !== undefined && data[key] !== '') {
        formData.append(key, data[key]);
      }
    });
    formData.append('variants', JSON.stringify(trimmedVariants));

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
          <Text fontSize="2xl" fontWeight="bold">
            Edible
          </Text>
          <Button leftIcon={<FiPlus />} colorScheme="purple" onClick={() => { onOpen(); registerOverlay?.(handleClose); }}>
            Add
          </Button>
        </HStack>

        {products.length === 0 ? (
          <Center h="200px">
            <Text color="gray.500">No edible products</Text>
          </Center>
        ) : (
          <Accordion allowToggle>
            {products.map((product) => (
              <AccordionItem key={product._id}>
                <AccordionButton>
                  <Box flex="1" textAlign="left">
                    <HStack>
                      <Text fontWeight="bold">{product.name || product.edibleType}</Text>
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
                      <Image
                        src={resolveMediaUrl(product.imageUrl, product.image)}
                        boxSize="80px"
                        objectFit="cover"
                        borderRadius="md"
                      />
                      <VStack align="start" spacing={1}>
                        <Text fontSize="sm" color="gray.500">
                          Brand: {product.brand || '—'}
                        </Text>
                        <Text fontSize="sm" color="gray.500">
                          Weight: {product.weight || '—'}
                        </Text>
                        <Text fontSize="sm" color="purple.400">
                          {product.price ? `$${product.price}` : 'No price'}
                        </Text>
                      </VStack>
                    </HStack>
                    <HStack>
                      <IconButton
                        icon={<FiEdit2 />}
                        variant="ghost"
                        onClick={() => {
                          handleEdit(product);
                          registerOverlay?.(handleClose);
                        }}
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
                  {product.variants?.length ? (
                    <Box mt={4}>
                      <Text fontWeight="semibold" mb={2}>Variants</Text>
                      <VStack align="stretch" spacing={2}>
                        {product.variants.map((variant) => (
                          <HStack key={variant._id || variant.name} justify="space-between">
                            <HStack>
                              <Badge colorScheme={variant.isActive !== false ? 'green' : 'red'}>
                                {variant.isActive !== false ? 'Active' : 'Inactive'}
                              </Badge>
                              <Text>{variant.name}</Text>
                            </HStack>
                            <Switch
                              isChecked={variant.isActive !== false}
                              onChange={(e) =>
                                updateVariantMutation.mutate({
                                  id: variant._id,
                                  data: { isActive: e.target.checked },
                                })
                              }
                            />
                          </HStack>
                        ))}
                      </VStack>
                    </Box>
                  ) : null}
                </AccordionPanel>
              </AccordionItem>
            ))}
          </Accordion>
        )}
          </VStack>

          <Modal isOpen={isOpen} onClose={handleClose} size="full">
            <ModalOverlay />
            <ModalContent bg={colorMode === 'dark' ? 'gray.800' : 'white'}>
              <ModalHeader>{editingProduct ? 'Edit' : 'Add'} Edible</ModalHeader>
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

                      {editingProduct ? (
                        <VStack spacing={4} align="stretch">
                          <VStack align="start" spacing={1}>
                            <Text fontSize="sm" color="gray.500">Brand</Text>
                            <Text fontWeight="semibold">{watch('brand') || '—'}</Text>
                          </VStack>
                          <VStack spacing={3} align="stretch">
                            <Text fontWeight="semibold">Variants</Text>
                            {editVariants.length === 0 ? (
                              <Text color="gray.500">No variants</Text>
                            ) : (
                              <VStack spacing={3} align="stretch">
                                {editVariants.map((variant) => (
                                  <HStack key={variant._id || variant.name} justify="space-between">
                                    <Text>{variant.name}</Text>
                                    <Switch
                                      isChecked={variant.isActive !== false}
                                      onChange={(e) => {
                                        const isActive = e.target.checked;
                                        setEditVariants((prev) =>
                                          prev.map((item) =>
                                            item._id === variant._id
                                              ? { ...item, isActive }
                                              : item
                                          )
                                        );
                                        if (variant._id) {
                                          updateVariantMutation.mutate({
                                            id: variant._id,
                                            data: { isActive },
                                          });
                                        }
                                      }}
                                    />
                                  </HStack>
                                ))}
                              </VStack>
                            )}
                          </VStack>
                          <VStack align="stretch" spacing={2}>
                            <Text fontSize="sm" color="gray.500">Edible Type</Text>
                            <HStack spacing={2} flexWrap="wrap">
                              {edibleTypeOptions.map((type) => (
                                <Button
                                  key={`edit-type-${type._id}`}
                                  size="sm"
                                  variant={currentEdibleType === type.name ? 'solid' : 'outline'}
                                  colorScheme="purple"
                                  onClick={() => setValue('edibleType', type.name, { shouldDirty: true })}
                                >
                                  {type.name}
                                </Button>
                              ))}
                            </HStack>
                            <Input type="hidden" {...register('edibleType', { required: true })} />
                          </VStack>
                          <VStack align="start" spacing={1}>
                            <Text fontSize="sm" color="gray.500">THC Content</Text>
                            <Text fontWeight="semibold">{watch('weight') || '—'}</Text>
                          </VStack>
                          {watch('description') ? (
                            <Box>
                              <Text fontSize="sm" fontWeight="semibold">Description</Text>
                              <Text fontSize="sm" color="gray.500">{watch('description')}</Text>
                            </Box>
                          ) : null}
                          <FormControl isRequired>
                            <FormLabel>Price ($)</FormLabel>
                            <Input
                              type="number"
                              step="0.01"
                              {...register('price', { required: true })}
                            />
                          </FormControl>
                        </VStack>
                      ) : (
                        <>
                          <FormControl>
                            <FormLabel>Brand (optional)</FormLabel>
                            <Input {...register('brand')} />
                          </FormControl>

                          <FormControl isRequired>
                            <FormLabel>Edible Type</FormLabel>
                            <VStack align="stretch" spacing={2}>
                              <HStack spacing={2} flexWrap="wrap">
                                {edibleTypeOptions.map((type) => (
                                  <Button
                                    key={type._id}
                                    size="sm"
                                    variant={currentEdibleType === type.name ? 'solid' : 'outline'}
                                    colorScheme="purple"
                                    onClick={() => setValue('edibleType', type.name, { shouldDirty: true })}
                                  >
                                    {type.name}
                                  </Button>
                                ))}
                              </HStack>
                              <Input
                                placeholder="Selected edible type"
                                value={currentEdibleType || ''}
                                readOnly
                              />
                              <Input type="hidden" {...register('edibleType', { required: true })} />
                            </VStack>
                          </FormControl>

                          <HStack>
                            <Input
                              placeholder="Add new edible type"
                              value={newTypeName}
                              onChange={(e) => setNewTypeName(e.target.value)}
                            />
                            <Button
                              colorScheme="purple"
                              onClick={handleAddType}
                              isLoading={createTypeMutation.isPending}
                            >
                              Add
                            </Button>
                          </HStack>

                          {edibleTypeOptions.length > 0 && (
                            <HStack>
                              <Select
                                placeholder="Remove a type"
                                value={typeToRemove}
                                onChange={(e) => setTypeToRemove(e.target.value)}
                              >
                                {edibleTypes.map((type) => (
                                  <option key={`remove-${type._id}`} value={type._id}>
                                    {type.name}
                                  </option>
                                ))}
                              </Select>
                              <Button
                                variant="outline"
                                colorScheme="red"
                                onClick={handleRemoveSelectedType}
                                isDisabled={!typeToRemove || deleteTypeMutation.isPending}
                                isLoading={deleteTypeMutation.isPending}
                              >
                                Remove
                              </Button>
                            </HStack>
                          )}

                          <FormControl isRequired>
                            <FormLabel>THC Content</FormLabel>
                            <Input
                              {...register('weight', { required: true })}
                              placeholder="e.g., 100mg, 50mg"
                            />
                          </FormControl>

                          <FormControl isRequired>
                            <FormLabel>Number of Variants (flavors)</FormLabel>
                            <Input
                              type="number"
                              min={1}
                              step={1}
                              value={variantCount}
                              {...register('variantCount', { required: true, min: 1 })}
                              onChange={(e) => {
                                const raw = e.target.value;
                                setVariantCount(raw);
                                if (raw === '') {
                                  setValue('variantCount', '', { shouldDirty: true });
                                  return;
                                }
                                const next = Math.max(1, Number(raw) || 1);
                                setValue('variantCount', next, { shouldDirty: true });
                              }}
                              onBlur={() => {
                                if (variantCount === '') {
                                  setVariantCount('1');
                                  setValue('variantCount', 1, { shouldDirty: true });
                                }
                              }}
                            />
                          </FormControl>

                          <VStack align="stretch" spacing={3}>
                            <Text fontSize="sm" color="gray.500">Variant names</Text>
                            {variants.map((variant, idx) => (
                              <FormControl key={`variant-${idx}`} isRequired>
                                <FormLabel>Variant #{idx + 1}</FormLabel>
                                <Input
                                  value={variant.name}
                                  onChange={(e) => {
                                    const next = e.target.value;
                                    setVariants((prev) =>
                                      prev.map((item, index) =>
                                        index === idx ? { ...item, name: next } : item
                                      )
                                    );
                                  }}
                                  placeholder="e.g., Blueberry"
                                />
                              </FormControl>
                            ))}
                          </VStack>

                          <FormControl isRequired>
                            <FormLabel>Price ($)</FormLabel>
                            <Input
                              type="number"
                              step="0.01"
                              {...register('price', { required: true })}
                            />
                          </FormControl>

                          <FormControl>
                            <FormLabel>Description</FormLabel>
                            <Textarea {...register('description')} />
                          </FormControl>
                        </>
                      )}
                  </VStack>
                </ModalBody>
                <ModalFooter>
                  <Button variant="ghost" mr={3} onClick={handleClose}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    colorScheme="purple"
                    isLoading={createMutation.isPending || updateMutation.isPending}
                  >
                    {editingProduct ? 'Update' : 'Create'}
                  </Button>
                </ModalFooter>
              </form>
            </ModalContent>
          </Modal>
          <ConfirmDialog />
        </Box>
      );
    }

    export default Edibles;

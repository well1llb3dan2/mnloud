import { useEffect, useMemo, useState, useRef } from 'react';
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
  Wrap,
  WrapItem,
  Divider,
} from '@chakra-ui/react';
import { FiPlus, FiEdit2, FiCamera, FiUpload, FiTrash2 } from 'react-icons/fi';
import { useConfirmDialog } from '../../components/ConfirmDialog';
import { useOverlayStack } from '../../context';
import { productService } from '../../services';

const strainTypeOptions = [
  { value: 'sativa', label: 'Sativa' },
  { value: 'indica', label: 'Indica' },
  { value: 'hybrid-s', label: 'Hybrid (Sativa)' },
  { value: 'hybrid-i', label: 'Hybrid (Indica)' },
];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const defaultFlavor = () => ({ name: '', strainType: 'hybrid-s' });

const Concentrates = () => {
  const navigate = useNavigate();
  const { colorMode } = useColorMode();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const {
    isOpen: isEditOpen,
    onOpen: onEditOpen,
    onClose: onEditClose,
  } = useDisclosure();
  const [editingProduct, setEditingProduct] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const fileInputRef = useRef();
  const videoInputRef = useRef();
  const [addStep, setAddStep] = useState(1);
  const [selectedType, setSelectedType] = useState('');
  const [newTypeName, setNewTypeName] = useState('');
  const [typeToRemove, setTypeToRemove] = useState('');
  const [brand, setBrand] = useState('');
  const [weight, setWeight] = useState('1g');
  const [flavorCount, setFlavorCount] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [flavors, setFlavors] = useState([defaultFlavor()]);
  const [editFlavors, setEditFlavors] = useState([]);
  const [newFlavorName, setNewFlavorName] = useState('');
  const [newFlavorType, setNewFlavorType] = useState('hybrid-s');
  const [isAddFlavorOpen, setIsAddFlavorOpen] = useState(false);
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const { registerBackAction, unregisterBackAction } = useOverlayStack();

  useEffect(() => {
    if (!isOpen || editingProduct || addStep <= 1) return;
    const handleStepBack = () => setAddStep((prev) => Math.max(1, prev - 1));
    registerBackAction(handleStepBack);
    return () => unregisterBackAction(handleStepBack);
  }, [isOpen, editingProduct, addStep, registerBackAction, unregisterBackAction]);

  const [editFields, setEditFields] = useState({
    brand: '',
    productType: '',
    weight: '',
    price: '',
    description: '',
  });
  const { data, isLoading } = useQuery({
    queryKey: ['concentrates'],
    queryFn: productService.getConcentrates,
  });
  const products = data?.products || [];

  const { data: typeData } = useQuery({
    queryKey: ['concentrateTypes'],
    queryFn: productService.getConcentrateTypes,
  });
  const concentrateTypes = typeData?.types || [];

  const createMutation = useMutation({
    mutationFn: productService.createConcentrateBase,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => productService.updateConcentrateBase(id, data),
  });

  const addStrainMutation = useMutation({
    mutationFn: ({ baseId, data }) => productService.addConcentrateStrain(baseId, data),
  });

  const updateStrainMutation = useMutation({
    mutationFn: ({ id, data }) => productService.updateConcentrateStrain(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['concentrates']);
    },
  });

  const deleteStrainMutation = useMutation({
    mutationFn: (id) => productService.deleteConcentrateStrain(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['concentrates']);
    },
  });

  const toggleBaseMutation = useMutation({
    mutationFn: ({ id, isActive }) => {
      const formData = new FormData();
      formData.append('isActive', isActive);
      return productService.updateConcentrateBase(id, formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['concentrates']);
    },
  });

  const deleteBaseMutation = useMutation({
    mutationFn: productService.deleteConcentrateBase,
    onSuccess: () => {
      queryClient.invalidateQueries(['concentrates']);
      toast({ title: 'Product deleted', status: 'success' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error?.message || 'Failed to delete product', status: 'error' });
    },
  });

  const toggleFlavorMutation = useMutation({
    mutationFn: ({ id, isActive }) => productService.updateConcentrateStrain(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries(['concentrates']);
    },
  });

  const createTypeMutation = useMutation({
    mutationFn: productService.createConcentrateType,
    onSuccess: () => {
      queryClient.invalidateQueries(['concentrateTypes']);
    },
  });

  const deleteTypeMutation = useMutation({
    mutationFn: productService.deleteConcentrateType,
    onSuccess: () => {
      queryClient.invalidateQueries(['concentrateTypes']);
    },
  });

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result);
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

  const handleEdit = (product) => {
    setEditingProduct(product);
    setEditFields({
      brand: product.brand || '',
      productType: product.productType || '',
      weight: product.weight || '',
      price: product.price || '',
      description: product.description || '',
    });
    setEditFlavors(
      (product.strains || []).map((strain) => ({
        _id: strain._id,
        strain: strain.strain || '',
        strainType: strain.strainType || 'hybrid-s',
        isActive: strain.isActive,
      }))
    );
    setNewFlavorName('');
    setNewFlavorType('hybrid-s');
    setIsAddFlavorOpen(false);
    setImagePreview(product.imageUrl || null);
    setImageFile(null);
    if (product.video) { 
      setVideoPreview(product.videoUrl || `/uploads/${product.video.replace('uploads/', '')}`); 
    } else { 
      setVideoPreview(null); 
    }
    setImageFile(null); 
    setVideoFile(null); 
    onEditOpen();
  };

  const handleAdd = () => {
    setEditingProduct(null);
    setAddStep(1);
    setSelectedType('');
    setNewTypeName('');
    setTypeToRemove('');
    setBrand('');
    setWeight('1g');
    setFlavorCount('');
    setPrice('');
    setDescription('');
    setFlavors([]);
    setImagePreview(null);
    setImageFile(null);
    setVideoPreview(null);
    setVideoFile(null);
    onOpen();
  };

  useEffect(() => {
    if (flavorCount === '') {
      setFlavors([]);
      return;
    }
    const safeCount = clamp(Number(flavorCount) || 1, 1, 12);
    setFlavorCount(safeCount);
    setFlavors((prev) => {
      const next = [...prev];
      while (next.length < safeCount) next.push(defaultFlavor());
      while (next.length > safeCount) next.pop();
      return next;
    });
  }, [flavorCount]);

  const flavorIsValid = useMemo(
    () => flavors.every((flavor) => flavor.name?.trim()),
    [flavors]
  );

  const stepOneValid = Boolean(selectedType || newTypeName.trim());
  const stepTwoValid = Boolean(price) && Boolean(weight) && Number(flavorCount) > 0;
  const stepThreeValid = flavorIsValid;

  const handleCreate = async () => {
    const shouldCreate = await confirm({
      title: 'Create concentrate',
      message: 'Add this concentrate to the database?',
      confirmText: 'Create',
      cancelText: 'Cancel',
    });
    if (!shouldCreate) return;

    try {
      const formData = new FormData();
      formData.append('productType', selectedType);
      formData.append('brand', brand || '');
      formData.append('weight', weight);
      formData.append('price', price);
      formData.append('description', description || '');
      if (imageFile) formData.append('image', imageFile);
      if (videoFile) formData.append('video', videoFile);

      const response = await createMutation.mutateAsync(formData);
      const base = response?.product;
      if (!base?._id) {
        throw new Error('Failed to create concentrate base.');
      }

      const payloads = flavors.map((flavor, index) => ({
        baseId: base._id,
        data: {
          strain: flavor.name.trim(),
          strainType: flavor.strainType || 'hybrid-s',
          sortOrder: index,
        },
      }));

      await Promise.all(payloads.map((payload) => addStrainMutation.mutateAsync(payload)));

      queryClient.invalidateQueries(['concentrates']);
      toast({ title: 'Concentrate created', status: 'success' });
      onClose();
      navigate('/products/concentrates', { replace: true });
    } catch (error) {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to create concentrate',
        status: 'error',
      });
    }
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
        description: error?.message || 'Failed to add type',
        status: 'error',
      });
    }
  };

  const handleNextStep = async () => {
    if (addStep === 1) {
      const trimmed = newTypeName.trim();
      if (!selectedType && trimmed) {
        try {
          await createTypeMutation.mutateAsync(trimmed);
          setSelectedType(trimmed);
          setNewTypeName('');
        } catch (error) {
          toast({
            title: 'Error',
            description: error?.message || 'Failed to add type',
            status: 'error',
          });
          return;
        }
      }
      if (!selectedType && !trimmed) {
        toast({ title: 'Select or enter a type', status: 'warning' });
        return;
      }
    }

    setAddStep((prev) => prev + 1);
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
      if (selectedType === type.name) {
        setSelectedType('');
      }
      if (typeToRemove === type._id) {
        setTypeToRemove('');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to delete type',
        status: 'error',
      });
    }
  };

  const handleRemoveSelectedType = async () => {
    const target = concentrateTypes.find((type) => type._id === typeToRemove);
    if (!target) return;
    await handleDeleteType(target);
  };

  const handleUpdate = async (event) => {
    event.preventDefault();
    if (!editingProduct) return;

    const trimmedFlavors = editFlavors.map((flavor) => ({
      ...flavor,
      strain: flavor.strain?.trim() || '',
      strainType: flavor.strainType || 'hybrid-s',
    }));

    if (trimmedFlavors.some((flavor) => !flavor.strain)) {
      toast({ title: 'Fill every flavor name', status: 'warning' });
      return;
    }

    try {
      const formData = new FormData();
      formData.append('price', editFields.price || '');
      if (imageFile) {
        formData.append('image', imageFile);
      }
      if (videoFile) {
        formData.append('video', videoFile);
      }

      await updateMutation.mutateAsync({ id: editingProduct._id, data: formData });
      await Promise.all(
        trimmedFlavors.map((flavor) =>
          updateStrainMutation.mutateAsync({
            id: flavor._id,
            data: { strain: flavor.strain, strainType: flavor.strainType },
          })
        )
      );
      queryClient.invalidateQueries(['concentrates']);
      toast({ title: 'Product updated', status: 'success' });
      onEditClose();
      setEditingProduct(null);
    } catch (error) {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to update concentrate',
        status: 'error',
      });
    }
  };

  const handleSaveFlavor = async (flavor) => {
    const trimmed = flavor.strain?.trim();
    if (!trimmed) return;
    try {
      await updateStrainMutation.mutateAsync({
        id: flavor._id,
        data: { strain: trimmed, strainType: flavor.strainType || 'hybrid-s' },
      });
      toast({ title: 'Flavor updated', status: 'success' });
    } catch (error) {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to update flavor',
        status: 'error',
      });
    }
  };

  const handleDeleteFlavor = async (flavor) => {
    const shouldDelete = await confirm({
      title: 'Delete flavor',
      message: `Delete "${flavor.strain || 'this flavor'}"?`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
    });
    if (!shouldDelete) return;
    try {
      await deleteStrainMutation.mutateAsync(flavor._id);
      setEditFlavors((prev) => prev.filter((item) => item._id !== flavor._id));
      toast({ title: 'Flavor deleted', status: 'success' });
    } catch (error) {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to delete flavor',
        status: 'error',
      });
    }
  };

  const handleAddFlavor = async () => {
    if (!editingProduct?._id) return;
    const trimmed = newFlavorName.trim();
    if (!trimmed) return;
    try {
      const response = await addStrainMutation.mutateAsync({
        baseId: editingProduct._id,
        data: {
          strain: trimmed,
          strainType: newFlavorType || 'hybrid-s',
          sortOrder: editFlavors.length,
        },
      });
      const created = response?.strain;
      if (created?._id) {
        setEditFlavors((prev) => [
          ...prev,
          { _id: created._id, strain: created.strain, strainType: created.strainType || 'hybrid-s' },
        ]);
      }
      setNewFlavorName('');
      setNewFlavorType('hybrid-s');
      setIsAddFlavorOpen(false);
      toast({ title: 'Flavor added', status: 'success' });
    } catch (error) {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to add flavor',
        status: 'error',
      });
    }
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
          <Text fontSize="2xl" fontWeight="bold">Concentrate</Text>
          <Button leftIcon={<FiPlus />} colorScheme="purple" onClick={handleAdd}>
            Add Product
          </Button>
        </HStack>

        {products.length === 0 ? (
          <Center h="200px">
            <Text color="gray.500">No concentrate products</Text>
          </Center>
        ) : (
          <Accordion allowToggle>
            {products.map((product) => (
              <AccordionItem key={product._id}>
                <AccordionButton>
                  <Box flex="1" textAlign="left">
                    <HStack>
                      <Text>
                        {product.brand ? `${product.brand} - ` : ''}{product.productType}
                      </Text>
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
                        toggleBaseMutation.mutate({
                          id: product._id,
                          isActive: e.target.checked,
                        })
                      }
                    />
                  </Box>
                </AccordionButton>
                <AccordionPanel pb={4}>
                  <HStack justify="space-between" align="start">
                    <VStack align="start" spacing={1}>
                      <Text>Brand: {product.brand || '—'}</Text>
                      <Text>Type: {product.productType}</Text>
                      <Text>Weight: {product.weight}</Text>
                      <Text>Price: ${product.price}</Text>
                      <Text>Description: {product.description || '—'}</Text>
                    </VStack>
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
                        onClick={async () => {
                          const shouldDelete = await confirm({
                            title: 'Delete product',
                            message: `Delete ${product.brand ? `${product.brand} - ` : ''}${product.productType}?`,
                            confirmText: 'Delete',
                            cancelText: 'Cancel',
                          });
                          if (shouldDelete) deleteBaseMutation.mutate(product._id);
                        }}
                        aria-label="Delete"
                      />
                    </HStack>
                  </HStack>
                  {product.strains?.length ? (
                    <Box mt={3}>
                      <Text fontWeight="semibold" mb={2}>Flavors</Text>
                      <VStack align="stretch" spacing={2}>
                        {product.strains.map((strain) => (
                          <HStack key={strain._id} justify="space-between">
                            <HStack>
                              <Badge colorScheme={strain.isActive ? 'green' : 'red'}>
                                {strain.isActive ? 'Active' : 'Inactive'}
                              </Badge>
                              <Text>{strain.strain}</Text>
                            </HStack>
                            <Switch
                              isChecked={strain.isActive}
                              onChange={(e) =>
                                toggleFlavorMutation.mutate({
                                  id: strain._id,
                                  isActive: e.target.checked,
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

      <Modal isOpen={isOpen} onClose={onClose} size="full">
        <ModalOverlay />
        <ModalContent bg={colorMode === 'dark' ? 'gray.800' : 'white'}>
          <ModalHeader>Add Concentrate</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={6} align="stretch">
              <HStack justify="space-between">
                <Text fontWeight="semibold">Step {addStep} of 4</Text>
                <Text color="gray.500">
                  {addStep === 1 && 'Choose concentrate type'}
                  {addStep === 2 && 'Base details'}
                  {addStep === 3 && 'Flavor details'}
                  {addStep === 4 && 'Preview & confirm'}
                </Text>
              </HStack>

              {addStep === 1 && (
                <VStack align="stretch" spacing={4}>
                  <Text fontWeight="semibold">Select a concentrate type</Text>
                  <VStack spacing={3} align="stretch">
                    {concentrateTypes.map((type) => (
                      <Button
                        key={type._id}
                        variant={selectedType === type.name ? 'solid' : 'outline'}
                        colorScheme="purple"
                        onClick={() => setSelectedType(type.name)}
                        w="100%"
                      >
                        {type.name}
                      </Button>
                    ))}
                  </VStack>
                  {concentrateTypes.length === 0 && (
                    <Text color="gray.500">No concentrate types yet. Add one below.</Text>
                  )}
                  <Input
                    placeholder="Type a new concentrate type"
                    value={newTypeName}
                    onChange={(e) => setNewTypeName(e.target.value)}
                  />
                </VStack>
              )}

              {addStep === 2 && (
                <VStack spacing={4} align="stretch">
                  <Box w="100%" textAlign="center">
                    <Input
                      type="file"
                      accept="image/*"
                      ref={fileInputRef}
                      onChange={handleImageChange}
                      display="none"
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
                        <IconButton
                          icon={<FiCamera />}
                          position="absolute"
                          bottom={2}
                          right={2}
                          onClick={() => fileInputRef.current.click()}
                          aria-label="Change image"
                        />
                      </Box>
                    ) : (
                      <Button leftIcon={<FiUpload />} onClick={() => fileInputRef.current.click()}>
                        Upload Image (optional)
                      </Button>
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
                        <IconButton
                          icon={<FiUpload />}
                          position="absolute"
                          bottom={2}
                          right={2}
                          onClick={() => videoInputRef.current.click()}
                          aria-label="Change video"
                        />
                      </Box>
                    ) : (
                      <Button leftIcon={<FiUpload />} onClick={() => videoInputRef.current.click()}>
                        Upload Video (15s max)
                      </Button>
                    )}
                  </Box>

                  <FormControl>
                    <FormLabel>Brand (optional)</FormLabel>
                    <Input value={brand} onChange={(e) => setBrand(e.target.value)} />
                  </FormControl>
                  <FormControl isRequired>
                    <FormLabel>How many flavors?</FormLabel>
                    <Input
                      type="number"
                      min={1}
                      max={12}
                      value={flavorCount}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === '') {
                          setFlavorCount('');
                          return;
                        }
                        const next = Math.max(1, Number(raw));
                        setFlavorCount(Number.isNaN(next) ? '' : next);
                      }}
                    />
                  </FormControl>
                  <FormControl isRequired>
                    <FormLabel>Price each</FormLabel>
                    <Input
                      type="number"
                      step="0.01"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                    />
                  </FormControl>
                  <FormControl isRequired>
                    <FormLabel>Weight / Size</FormLabel>
                    <Input value={weight} onChange={(e) => setWeight(e.target.value)} />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Description (optional)</FormLabel>
                    <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
                  </FormControl>
                </VStack>
              )}

              {addStep === 3 && (
                <VStack spacing={4} align="stretch">
                  <Text fontWeight="semibold">Flavor details</Text>
                  {flavors.map((flavor, index) => (
                    <Box key={`flavor-${index}`} borderWidth="1px" borderRadius="lg" p={4}>
                      <HStack justify="space-between" mb={3}>
                        <Text fontWeight="semibold">Flavor {index + 1}</Text>
                      </HStack>
                      <FormControl isRequired>
                        <FormLabel>Flavor name</FormLabel>
                        <Input
                          value={flavor.name}
                          onChange={(e) => {
                            const next = [...flavors];
                            next[index] = { ...next[index], name: e.target.value };
                            setFlavors(next);
                          }}
                        />
                      </FormControl>
                      <FormControl mt={3}>
                        <FormLabel>Strain type</FormLabel>
                        <Select
                          value={flavor.strainType}
                          onChange={(e) => {
                            const next = [...flavors];
                            next[index] = { ...next[index], strainType: e.target.value };
                            setFlavors(next);
                          }}
                        >
                          {strainTypeOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </Select>
                      </FormControl>
                    </Box>
                  ))}
                </VStack>
              )}

              {addStep === 4 && (
                <VStack spacing={4} align="stretch">
                  <Text fontWeight="semibold">Sample card preview</Text>
                  <Box
                    borderWidth="1px"
                    borderRadius="xl"
                    overflow="hidden"
                    bg={colorMode === 'dark' ? 'gray.700' : 'white'}
                  >
                    {imagePreview ? (
                      <Image src={imagePreview} alt="preview" h="160px" w="100%" objectFit="cover" />
                    ) : (
                      <Box h="160px" bg={colorMode === 'dark' ? 'gray.600' : 'gray.100'} />
                    )}
                    <VStack align="start" spacing={2} p={4}>
                      <Text fontWeight="bold">
                        {brand ? `${brand} - ` : ''}{selectedType || 'Concentrate'}
                      </Text>
                      <HStack spacing={3}>
                        <Badge colorScheme="purple">{weight}</Badge>
                        <Text fontWeight="bold" color="purple.300">
                          ${price || '0.00'}
                        </Text>
                      </HStack>
                      {description ? (
                        <Text fontSize="sm" color="gray.500">
                          {description}
                        </Text>
                      ) : null}
                      <Divider />
                      <Text fontWeight="semibold">Flavors</Text>
                      <Wrap>
                        {flavors.map((flavor, index) => (
                          <WrapItem key={`preview-flavor-${index}`}>
                            <Badge variant="outline">
                              {flavor.name || `Flavor ${index + 1}`}
                            </Badge>
                          </WrapItem>
                        ))}
                      </Wrap>
                    </VStack>
                  </Box>
                </VStack>
              )}
            </VStack>
          </ModalBody>
          <ModalFooter>
            <HStack w="100%" justify="space-between">
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <HStack>
                <Button
                  variant="outline"
                  onClick={() => setAddStep((prev) => Math.max(1, prev - 1))}
                  isDisabled={addStep === 1}
                >
                  Back
                </Button>
                {addStep < 4 && (
                  <Button
                    colorScheme="purple"
                    onClick={handleNextStep}
                    isDisabled={
                      (addStep === 1 && !stepOneValid) ||
                      (addStep === 2 && !stepTwoValid) ||
                      (addStep === 3 && !stepThreeValid)
                    }
                  >
                    Next
                  </Button>
                )}
                {addStep === 4 && (
                  <Button
                    colorScheme="purple"
                    onClick={handleCreate}
                    isLoading={createMutation.isPending || addStrainMutation.isPending}
                  >
                    Confirm & Create
                  </Button>
                )}
              </HStack>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={isEditOpen} onClose={onEditClose} size="lg">
        <ModalOverlay />
        <ModalContent bg={colorMode === 'dark' ? 'gray.800' : 'white'}>
          <ModalHeader>Edit Concentrate</ModalHeader>
          <ModalCloseButton />
          <form onSubmit={handleUpdate}>
            <ModalBody>
              <VStack spacing={4} align="stretch">
                <Box w="100%" textAlign="center">
                  <Input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    onChange={handleImageChange}
                    display="none"
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
                      <IconButton
                        icon={<FiUpload />}
                        position="absolute"
                        bottom={2}
                        right={2}
                        onClick={() => fileInputRef.current.click()}
                        aria-label="Change image"
                        size="sm"
                      />
                    </Box>
                  ) : (
                    <Button leftIcon={<FiUpload />} onClick={() => fileInputRef.current.click()}>
                      Upload Image
                    </Button>
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
                      <IconButton
                        icon={<FiUpload />}
                        position="absolute"
                        bottom={2}
                        right={2}
                        onClick={() => videoInputRef.current.click()}
                        aria-label="Change video"
                        size="sm"
                      />
                    </Box>
                  ) : (
                    <Button leftIcon={<FiUpload />} onClick={() => videoInputRef.current.click()}>
                      Upload Video (15s max)
                    </Button>
                  )}
                </Box>
                <VStack align="start" spacing={1}>
                  <Text fontSize="sm" color="gray.500">Brand</Text>
                  <Text fontWeight="semibold">{editFields.brand || '—'}</Text>
                </VStack>
                <VStack align="stretch" spacing={3}>
                  <Text fontSize="sm" color="gray.500">Concentrate Type</Text>
                  <HStack spacing={2} flexWrap="wrap">
                    {concentrateTypes.map((type) => (
                      <Button
                        key={`edit-type-${type._id}`}
                        size="sm"
                        variant={editFields.productType === type.name ? 'solid' : 'outline'}
                        colorScheme="purple"
                        onClick={() =>
                          setEditFields((prev) => ({ ...prev, productType: type.name }))
                        }
                      >
                        {type.name}
                      </Button>
                    ))}
                  </HStack>
                </VStack>
                <VStack align="start" spacing={1}>
                  <Text fontSize="sm" color="gray.500">Weight / Size</Text>
                  <Text fontWeight="semibold">{editFields.weight || '—'}</Text>
                </VStack>
                {editFields.description ? (
                  <Box>
                    <Text fontSize="sm" fontWeight="semibold">Description</Text>
                    <Text fontSize="sm" color="gray.500">{editFields.description}</Text>
                  </Box>
                ) : null}
                <FormControl isRequired>
                  <FormLabel>Price each</FormLabel>
                  <Input
                    type="number"
                    step="0.01"
                    value={editFields.price}
                    onChange={(e) => setEditFields((prev) => ({ ...prev, price: e.target.value }))}
                  />
                </FormControl>
                <Divider />
                <VStack spacing={3} align="stretch">
                  <Text fontWeight="semibold">Flavors</Text>
                  {editFlavors.length === 0 ? (
                    <Text color="gray.500">No flavors yet</Text>
                  ) : (
                    <VStack spacing={3} align="stretch">
                      {editFlavors.map((flavor, index) => (
                        <Box key={flavor._id} borderWidth="1px" borderRadius="lg" p={3}>
                          <HStack justify="space-between" align="start" spacing={3}>
                            <VStack align="stretch" spacing={3} flex={1}>
                              <HStack spacing={2}>
                                <Badge colorScheme={flavor.isActive ? 'green' : 'red'}>
                                  {flavor.isActive ? 'Active' : 'Inactive'}
                                </Badge>
                                <Text fontSize="sm" color="gray.500">Flavor</Text>
                              </HStack>
                              <FormControl isRequired>
                                <FormLabel>Flavor name</FormLabel>
                                <Input
                                  value={flavor.strain}
                                  onChange={(e) => {
                                    const next = [...editFlavors];
                                    next[index] = { ...next[index], strain: e.target.value };
                                    setEditFlavors(next);
                                  }}
                                />
                              </FormControl>
                              <FormControl>
                                <FormLabel>Strain type</FormLabel>
                                <Select
                                  value={flavor.strainType}
                                  onChange={(e) => {
                                    const next = [...editFlavors];
                                    next[index] = { ...next[index], strainType: e.target.value };
                                    setEditFlavors(next);
                                  }}
                                >
                                  {strainTypeOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </Select>
                              </FormControl>
                            </VStack>
                            <IconButton
                              icon={<FiTrash2 />}
                              variant="ghost"
                              colorScheme="red"
                              aria-label="Remove flavor"
                              onClick={async () => {
                                const shouldDelete = await confirm({
                                  title: 'Delete flavor',
                                  message: `Delete "${flavor.strain || 'this flavor'}"?`,
                                  confirmText: 'Delete',
                                  cancelText: 'Cancel',
                                });
                                if (shouldDelete) {
                                  await handleDeleteFlavor(flavor);
                                }
                              }}
                            />
                          </HStack>
                        </Box>
                      ))}
                    </VStack>
                  )}
                  <Button
                    size="sm"
                    colorScheme="purple"
                    variant="outline"
                    onClick={() => setIsAddFlavorOpen(true)}
                  >
                    Add Flavor
                  </Button>
                  {isAddFlavorOpen ? (
                    <Box borderWidth="1px" borderRadius="lg" p={3}>
                      <VStack spacing={3} align="stretch">
                        <FormControl isRequired>
                          <FormLabel>Flavor name</FormLabel>
                          <Input
                            value={newFlavorName}
                            onChange={(e) => setNewFlavorName(e.target.value)}
                          />
                        </FormControl>
                        <FormControl>
                          <FormLabel>Strain type</FormLabel>
                          <Select
                            value={newFlavorType}
                            onChange={(e) => setNewFlavorType(e.target.value)}
                          >
                            {strainTypeOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </Select>
                        </FormControl>
                        <HStack justify="flex-end">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setIsAddFlavorOpen(false);
                              setNewFlavorName('');
                              setNewFlavorType('hybrid-s');
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            colorScheme="purple"
                            onClick={handleAddFlavor}
                            isLoading={addStrainMutation.isPending}
                          >
                            Add Flavor
                          </Button>
                        </HStack>
                      </VStack>
                    </Box>
                  ) : null}
                </VStack>
              </VStack>
            </ModalBody>
            <ModalFooter>
              <Button variant="ghost" mr={3} onClick={onEditClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                colorScheme="purple"
                isLoading={updateMutation.isPending}
                isDisabled={!editFields.productType || !editFields.weight || !editFields.price}
              >
                Save
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>

      <ConfirmDialog />
    </Box>
  );
};

export default Concentrates;

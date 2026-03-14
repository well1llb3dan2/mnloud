import { useState } from 'react';
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
  FormControl,
  FormLabel,
  Input,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  useDisclosure,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
} from '@chakra-ui/react';
import { FiPlus, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { useForm, useFieldArray } from 'react-hook-form';
import { priceTierService } from '../services';

const PriceTiers = () => {
  const { colorMode } = useColorMode();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [editingTier, setEditingTier] = useState(null);

  const { register, handleSubmit, reset, control, setValue } = useForm({
    defaultValues: {
      name: '',
      prices: [{ quantity: '', price: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'prices',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['priceTiers'],
    queryFn: priceTierService.getAll,
  });

  const tiers = data?.tiers || [];

  const createMutation = useMutation({
    mutationFn: priceTierService.create,
    onSuccess: () => {
      queryClient.invalidateQueries(['priceTiers']);
      toast({ title: 'Tier created', status: 'success' });
      handleClose();
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, status: 'error' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => priceTierService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['priceTiers']);
      toast({ title: 'Tier updated', status: 'success' });
      handleClose();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: priceTierService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries(['priceTiers']);
      toast({ title: 'Tier deleted', status: 'success' });
    },
  });

  const handleClose = () => {
    setEditingTier(null);
    reset({ name: '', prices: [{ quantity: '', price: '' }] });
    onClose();
  };

  const handleEdit = (tier) => {
    setEditingTier(tier);
    setValue('name', tier.name);
    setValue(
      'prices',
      tier.prices.map((p) => ({
        quantity: p.quantity,
        price: p.price,
      }))
    );
    onOpen();
  };

  const onSubmit = (data) => {
    const formattedData = {
      name: data.name,
      prices: data.prices.map((p) => ({
        quantity: parseFloat(p.quantity),
        price: parseFloat(p.price),
      })),
    };

    if (editingTier) {
      updateMutation.mutate({ id: editingTier._id, data: formattedData });
    } else {
      createMutation.mutate(formattedData);
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
          <Text fontSize="2xl" fontWeight="bold">
            Price Tiers
          </Text>
          <Button leftIcon={<FiPlus />} colorScheme="purple" onClick={onOpen}>
            Add Tier
          </Button>
        </HStack>

        {tiers.length === 0 ? (
          <Center h="200px">
            <Text color="gray.500">No price tiers</Text>
          </Center>
        ) : (
          tiers.map((tier) => (
            <Box
              key={tier._id}
              bg={colorMode === 'dark' ? 'gray.800' : 'white'}
              p={4}
              borderRadius="lg"
              boxShadow="md"
            >
              <HStack justify="space-between" mb={3}>
                <Text fontWeight="bold" fontSize="lg">
                  {tier.name}
                </Text>
                <HStack>
                  <IconButton
                    icon={<FiEdit2 />}
                    variant="ghost"
                    onClick={() => handleEdit(tier)}
                    aria-label="Edit"
                  />
                  <IconButton
                    icon={<FiTrash2 />}
                    variant="ghost"
                    colorScheme="red"
                    onClick={() => deleteMutation.mutate(tier._id)}
                    aria-label="Delete"
                  />
                </HStack>
              </HStack>
              <TableContainer>
                <Table size="sm">
                  <Thead>
                    <Tr>
                      <Th>Quantity (g)</Th>
                      <Th isNumeric>Price ($)</Th>
                      <Th isNumeric>$/g</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {tier.prices.map((price, idx) => (
                      <Tr key={idx}>
                        <Td>{price.quantity}g</Td>
                        <Td isNumeric>${price.price}</Td>
                        <Td isNumeric color="gray.500">
                          ${(price.price / price.quantity).toFixed(2)}/g
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </TableContainer>
            </Box>
          ))
        )}
      </VStack>

      {/* Modal */}
      <Modal isOpen={isOpen} onClose={handleClose} size="xl">
        <ModalOverlay />
        <ModalContent bg={colorMode === 'dark' ? 'gray.800' : 'white'}>
          <ModalHeader>
            {editingTier ? 'Edit' : 'Create'} Price Tier
          </ModalHeader>
          <ModalCloseButton />
          <form onSubmit={handleSubmit(onSubmit)}>
            <ModalBody>
              <VStack spacing={4}>
                <FormControl isRequired>
                  <FormLabel>Tier Name</FormLabel>
                  <Input
                    {...register('name', { required: true })}
                    placeholder="e.g., Top Shelf, Mid Grade"
                  />
                </FormControl>

                <Box w="100%">
                  <HStack justify="space-between" mb={2}>
                    <Text fontWeight="bold">Price Points</Text>
                    <Button
                      size="sm"
                      leftIcon={<FiPlus />}
                      onClick={() => append({ quantity: '', price: '' })}
                    >
                      Add
                    </Button>
                  </HStack>

                  <VStack spacing={2}>
                    {fields.map((field, index) => (
                      <HStack key={field.id} w="100%">
                        <FormControl>
                          <Input
                            type="number"
                            step="any"
                            placeholder="Quantity (g)"
                            {...register(`prices.${index}.quantity`, {
                              required: true,
                            })}
                          />
                        </FormControl>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="Price ($)"
                            {...register(`prices.${index}.price`, {
                              required: true,
                            })}
                          />
                        </FormControl>
                        {fields.length > 1 && (
                          <IconButton
                            icon={<FiTrash2 />}
                            variant="ghost"
                            colorScheme="red"
                            onClick={() => remove(index)}
                            aria-label="Remove"
                          />
                        )}
                      </HStack>
                    ))}
                  </VStack>
                </Box>
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
                {editingTier ? 'Update' : 'Create'}
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default PriceTiers;

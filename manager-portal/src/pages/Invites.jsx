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
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  useDisclosure,
  Badge,
  useClipboard,
} from '@chakra-ui/react';
import { FiPlus, FiTrash2, FiCopy, FiCheck } from 'react-icons/fi';
import { QRCodeSVG } from 'qrcode.react';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import { inviteService } from '../services';
import { useOverlayStack } from '../context';

const Invites = () => {
  const { colorMode } = useColorMode();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedInvite, setSelectedInvite] = useState(null);
  const { register: registerOverlay, unregister: unregisterOverlay } = useOverlayStack();

  const { data, isLoading } = useQuery({
    queryKey: ['invites'],
    queryFn: inviteService.getAll,
  });

  const invites = data?.invites || [];

  const createMutation = useMutation({
    mutationFn: inviteService.create,
    onSuccess: (data) => {
      queryClient.invalidateQueries(['invites']);
      toast({ title: 'Invite created', status: 'success' });
      setSelectedInvite(data.invite);
      onOpen();
      registerOverlay(handleCloseModal);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: inviteService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries(['invites']);
      toast({ title: 'Invite deleted', status: 'success' });
    },
  });

  const handleCreate = () => {
    createMutation.mutate();
  };

  const handleViewQR = (invite) => {
    setSelectedInvite(invite);
    onOpen();
    registerOverlay(handleCloseModal);
  };

  const handleCloseModal = () => {
    try { unregisterOverlay(handleCloseModal); } catch (err) {}
    setSelectedInvite(null);
    onClose();
  };

  const getInviteUrl = (code) => {
    // Use path param to match customer portal route: /register/:inviteCode
    const customerUrl = window.location.origin.replace('manager', 'app');
    return `${customerUrl}/register/${code}`;
  };

  const InviteLink = ({ invite }) => {
    const { onCopy, hasCopied } = useClipboard(getInviteUrl(invite.code));

    return (
      <HStack>
        <IconButton
          icon={hasCopied ? <FiCheck /> : <FiCopy />}
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            onCopy();
          }}
          aria-label="Copy link"
          colorScheme={hasCopied ? 'green' : 'gray'}
        />
      </HStack>
    );
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
            Customer Invites
          </Text>
          <Button
            leftIcon={<FiPlus />}
            colorScheme="purple"
            onClick={handleCreate}
            isLoading={createMutation.isPending}
          >
            Create
          </Button>
        </HStack>

        {invites.length === 0 ? (
          <Center h="200px">
            <VStack>
              <Text color="gray.500">No invites created</Text>
              <Button colorScheme="purple" onClick={handleCreate}>
                Create First Invite
              </Button>
            </VStack>
          </Center>
        ) : (
          invites.map((invite) => {
            const isExpired = isPast(new Date(invite.expiresAt));
            const isUsed = invite.usedBy;

            return (
              <Box
                key={invite._id}
                bg={colorMode === 'dark' ? 'gray.800' : 'white'}
                p={4}
                borderRadius="lg"
                boxShadow="md"
                cursor="pointer"
                onClick={() => handleViewQR(invite)}
                opacity={isExpired || isUsed ? 0.6 : 1}
              >
                <HStack justify="space-between">
                  <VStack align="start" spacing={1}>
                    <HStack>
                      <Text fontFamily="mono" fontWeight="bold">
                        {invite.code}
                      </Text>
                      {isUsed ? (
                        <Badge colorScheme="green">Used</Badge>
                      ) : isExpired ? (
                        <Badge colorScheme="red">Expired</Badge>
                      ) : (
                        <Badge colorScheme="purple">Active</Badge>
                      )}
                    </HStack>
                    <Text fontSize="sm" color="gray.500">
                      {isUsed
                        ? `Used by ${invite.usedBy?.firstName}`
                        : `Expires ${formatDistanceToNow(new Date(invite.expiresAt), {
                            addSuffix: true,
                          })}`}
                    </Text>
                  </VStack>
                  <HStack onClick={(e) => e.stopPropagation()}>
                    {!isUsed && !isExpired && <InviteLink invite={invite} />}
                    <IconButton
                      icon={<FiTrash2 />}
                      variant="ghost"
                      colorScheme="red"
                      onClick={() => deleteMutation.mutate(invite._id)}
                      aria-label="Delete"
                    />
                  </HStack>
                </HStack>
              </Box>
            );
          })
        )}
      </VStack>

      {/* QR Modal */}
      <Modal isOpen={isOpen} onClose={handleCloseModal}>
        <ModalOverlay />
        <ModalContent bg={colorMode === 'dark' ? 'gray.800' : 'white'}>
          <ModalHeader>Invite QR Code</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {selectedInvite && (
              <VStack spacing={4}>
                <Box p={4} bg="white" borderRadius="lg">
                  <QRCodeSVG
                    value={getInviteUrl(selectedInvite.code)}
                    size={200}
                    level="H"
                  />
                </Box>
                <Text fontFamily="mono" fontSize="xl" fontWeight="bold">
                  {selectedInvite.code}
                </Text>
                <Text fontSize="sm" color="gray.500" textAlign="center">
                  Customer can scan this QR code or use the code to register
                </Text>
              </VStack>
            )}
          </ModalBody>
          <ModalFooter>
            <Button onClick={onClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default Invites;

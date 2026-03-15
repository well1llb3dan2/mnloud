import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Button,
  Text,
} from '@chakra-ui/react';
import { useOverlayStack } from '../context';

export const useConfirmDialog = () => {
  const cancelRef = useRef();
  const resolverRef = useRef(null);
  const [dialogState, setDialogState] = useState({
    isOpen: false,
    title: 'Confirm',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
  });

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setDialogState((prev) => ({
        ...prev,
        isOpen: true,
        title: options?.title ?? prev.title,
        message: options?.message ?? '',
        confirmText: options?.confirmText ?? 'Confirm',
        cancelText: options?.cancelText ?? 'Cancel',
      }));
    });
  }, []);

  const handleClose = useCallback(() => {
    if (resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }
    setDialogState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const { register: registerOverlay, unregister: unregisterOverlay } = useOverlayStack();

  useEffect(() => {
    if (dialogState.isOpen) {
      registerOverlay(handleClose);
      return () => unregisterOverlay(handleClose);
    }
  }, [dialogState.isOpen, handleClose, registerOverlay, unregisterOverlay]);

  const handleConfirm = useCallback(() => {
    if (resolverRef.current) {
      resolverRef.current(true);
      resolverRef.current = null;
    }
    setDialogState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const ConfirmDialog = useCallback(() => (
    <AlertDialog
      isOpen={dialogState.isOpen}
      leastDestructiveRef={cancelRef}
      onClose={handleClose}
      isCentered
    >
      <AlertDialogOverlay />
      <AlertDialogContent>
        <AlertDialogHeader fontSize="lg" fontWeight="bold">
          {dialogState.title}
        </AlertDialogHeader>
        <AlertDialogBody>
          <Text>{dialogState.message}</Text>
        </AlertDialogBody>
        <AlertDialogFooter>
          <Button ref={cancelRef} onClick={handleClose}>
            {dialogState.cancelText}
          </Button>
          <Button colorScheme="red" onClick={handleConfirm} ml={3}>
            {dialogState.confirmText}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ), [dialogState, handleClose, handleConfirm]);

  return { confirm, ConfirmDialog };
};

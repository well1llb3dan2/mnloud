import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Flex,
  IconButton,
  Badge,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  OrderedList,
  ListItem,
  useColorMode,
  useDisclosure,
  VStack,
  HStack,
  Text,
} from '@chakra-ui/react';
import { FiDownload } from 'react-icons/fi';
import {
  FiHome,
  FiPackage,
  FiMessageCircle,
  FiClipboard,
} from 'react-icons/fi';
import { useChatStore, useAuthStore } from '../stores';
import { useBackButton } from '../hooks';

const BottomNavItem = ({ icon, label, path, badge }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = location.pathname === path || 
    (path !== '/' && location.pathname.startsWith(path));

  return (
    <VStack
      spacing={1}
      cursor="pointer"
      onClick={() => navigate(path)}
      color={isActive ? 'purple.400' : 'gray.400'}
      transition="all 0.2s"
      position="relative"
      flex={1}
      py={2}
      _active={{ bg: 'transparent' }}
    >
      <Box position="relative">
        <IconButton
          icon={icon}
          variant="ghost"
          size="lg"
          aria-label={label}
          color="inherit"
          _hover={{ bg: 'transparent' }}
          _active={{ bg: 'transparent' }}
        />
        {badge > 0 && (
          <Badge
            position="absolute"
            top={0}
            right={0}
            colorScheme="red"
            borderRadius="full"
            fontSize="xs"
            minW={5}
            textAlign="center"
          >
            {badge > 99 ? '99+' : badge}
          </Badge>
        )}
      </Box>
      <Text fontSize="xs" fontWeight={isActive ? 'bold' : 'normal'}>
        {label}
      </Text>
    </VStack>
  );
};

const Layout = () => {
  const { colorMode } = useColorMode();
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuthStore();
  const totalUnread = useChatStore((state) => state.totalUnread);
  const isChatDetail = location.pathname.startsWith('/chats/');
  const { isOpen: isGuideOpen, onOpen: onGuideOpen, onClose: onGuideClose } = useDisclosure();

  // Handle back button behavior for PWA
  useBackButton();

  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const isStandalone = useMemo(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) return true;
    if (window.navigator.standalone) return true;
    return false;
  }, []);
  const isIos = useMemo(() => {
    const ua = window.navigator.userAgent || '';
    const iOSDevice = /iphone|ipad|ipod/i.test(ua);
    const iPadOs = window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1;
    return iOSDevice || iPadOs;
  }, []);

  useEffect(() => {
    const handler = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const showInstallButton = !isStandalone && isAuthenticated && (Boolean(deferredPrompt) || isIos);

  const handleInstallPrompt = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try {
      await deferredPrompt.userChoice;
    } finally {
      setDeferredPrompt(null);
      onGuideClose();
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <Flex
      direction="column"
      h="100dvh"
      maxW="100vw"
      overflow="hidden"
      userSelect="none"
      sx={{ WebkitTouchCallout: 'none', WebkitTapHighlightColor: 'transparent' }}
    >
      {/* Main content */}
      <Box
        flex={1}
        overflow={isChatDetail ? 'hidden' : 'auto'}
        pb={isChatDetail ? 0 : '90px'}
        bg={colorMode === 'dark' ? 'gray.900' : 'gray.50'}
      >
        {showInstallButton && (
          <HStack
            justify="center"
            py={2}
            px={4}
            bg={colorMode === 'dark' ? 'purple.800' : 'purple.50'}
          >
            <Button
              size="sm"
              colorScheme="purple"
              leftIcon={<FiDownload />}
              onClick={onGuideOpen}
            >
              {isIos ? 'Add to Home Screen' : 'Install App'}
            </Button>
          </HStack>
        )}
        <Outlet />
      </Box>

      {/* Install guide modal */}
      <Modal isOpen={isGuideOpen} onClose={onGuideClose} isCentered>
        <ModalOverlay />
        <ModalContent mx={4}>
          <ModalHeader>Install Loud Manager</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            {isIos ? (
              <VStack align="stretch" spacing={3}>
                <Text>On iPhone or iPad, use the Share menu to add the app.</Text>
                <OrderedList spacing={2} pl={2}>
                  <ListItem>Tap the Share button in Safari.</ListItem>
                  <ListItem>Scroll and select "Add to Home Screen".</ListItem>
                  <ListItem>Confirm the name, then tap Add.</ListItem>
                </OrderedList>
                <Text fontSize="sm" color="gray.500">
                  Tip: Install works best in Safari, not in an in-app browser.
                </Text>
              </VStack>
            ) : (
              <VStack align="stretch" spacing={3}>
                <Text>Install the app for quick access from your home screen.</Text>
                <OrderedList spacing={2} pl={2}>
                  <ListItem>Tap the Install button below.</ListItem>
                  <ListItem>When the prompt appears, confirm Install.</ListItem>
                  <ListItem>Open the app from your home screen.</ListItem>
                </OrderedList>
                {deferredPrompt ? (
                  <Button colorScheme="purple" onClick={handleInstallPrompt}>
                    Install Now
                  </Button>
                ) : (
                  <Text fontSize="sm" color="gray.500">
                    If you do not see a prompt, open the browser menu and choose "Install app".
                  </Text>
                )}
              </VStack>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* Bottom navigation */}
      <HStack
        position="fixed"
        bottom={0}
        left={0}
        right={0}
        bg={colorMode === 'dark' ? 'gray.800' : 'white'}
        borderTop="1px"
        borderColor={colorMode === 'dark' ? 'gray.700' : 'gray.200'}
        px={2}
        py={2}
        pb={4}
        justify="space-around"
        zIndex={100}
        h="80px"
        sx={{
          paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
        }}
      >
        <BottomNavItem icon={<FiHome size={24} />} label="Dashboard" path="/" />
        <BottomNavItem icon={<FiPackage size={24} />} label="Products" path="/products" />
        <BottomNavItem 
          icon={<FiMessageCircle size={24} />} 
          label="Chats" 
          path="/chats" 
          badge={totalUnread}
        />
        <BottomNavItem icon={<FiClipboard size={24} />} label="Orders" path="/orders" />
      </HStack>

    </Flex>
  );
};

export default Layout;

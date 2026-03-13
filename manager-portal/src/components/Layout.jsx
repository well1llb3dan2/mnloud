import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Flex,
  IconButton,
  Badge,
  useColorMode,
  VStack,
  HStack,
  Text,
} from '@chakra-ui/react';
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
  
  // Handle back button behavior for PWA
  useBackButton();

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
        <Outlet />
      </Box>

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

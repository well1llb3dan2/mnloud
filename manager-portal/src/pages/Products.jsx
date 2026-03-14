import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  VStack,
  HStack,
  Text,
  SimpleGrid,
  useColorMode,
  useBreakpointValue,
} from '@chakra-ui/react';
import { productService } from '../services';

const CategoryCard = ({ emoji, title, subtitle, count, path, color }) => {
  const navigate = useNavigate();
  const { colorMode } = useColorMode();
  const isMobile = useBreakpointValue({ base: true, md: false });

  return (
    <Box
      bg={colorMode === 'dark' ? 'gray.800' : 'white'}
      borderRadius="2xl"
      p={isMobile ? 3 : 1.5}
      cursor="pointer"
      onClick={() => navigate(path)}
      transition="all 0.2s"
      _hover={{ transform: 'scale(1.01)', boxShadow: 'xl' }}
      boxShadow="lg"
      h="100%"
      w="100%"
      maxW={{ base: '100%', md: '360px', xl: '420px' }}
      mx="auto"
    >
      {isMobile ? (
        <HStack spacing={4} align="center">
          <Box
            p={3}
            borderRadius="xl"
            bg={`${color}.500`}
            color="white"
            fontSize="2xl"
            display="flex"
            alignItems="center"
            justifyContent="center"
            w="48px"
            h="48px"
          >
            {emoji}
          </Box>
          <VStack align="start" spacing={1} flex={1}>
            <Text fontWeight="bold" fontSize="md">
              {title}
            </Text>
            <Text fontSize="sm" color="gray.500">
              {typeof count === 'number' ? `${count} active` : subtitle}
            </Text>
          </VStack>
        </HStack>
      ) : (
        <VStack spacing={3} py={6}>
          <Box
            p={4}
            borderRadius="full"
            bg={`${color}.500`}
            color="white"
            fontSize="3xl"
            display="flex"
            alignItems="center"
            justifyContent="center"
            w="64px"
            h="64px"
          >
            {emoji}
          </Box>
          <Text fontWeight="bold" fontSize="lg">
            {title}
          </Text>
          <Text fontSize="sm" color="gray.500" textAlign="center">
            {typeof count === 'number' ? `${count} active` : subtitle}
          </Text>
        </VStack>
      )}
    </Box>
  );
};

const Products = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['productCounts', 'categories'],
    queryFn: async () => {
      const [flowers, concentrates, disposables, edibles] = await Promise.all([
        productService.getFlowers(),
        productService.getConcentrates(),
        productService.getDisposables(),
        productService.getEdibles(),
      ]);

      const activeCount = (items = []) =>
        items.filter((item) => item.isActive !== false).length;

      return {
        flowers: activeCount(flowers?.products),
        concentrates: activeCount(concentrates?.products),
        disposables: activeCount(disposables?.products),
        edibles: activeCount(edibles?.products),
      };
    },
  });

  const counts = data || {};

  return (
    <Box p={4}>
      <VStack spacing={6} align="stretch">
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} justifyItems="center">
          <CategoryCard
            emoji="🌿"
            title="Flower"
            subtitle="All flower products"
            count={isLoading ? null : counts.flowers}
            path="/products/flower"
            color="green"
          />
          <CategoryCard
            emoji="💨"
            title="Disposables"
            subtitle="Disposable vapes"
            count={isLoading ? null : counts.disposables}
            path="/products/disposables"
            color="cyan"
          />
          <CategoryCard
            emoji="🧪"
            title="Concentrates"
            subtitle="Wax, shatter & more"
            count={isLoading ? null : counts.concentrates}
            path="/products/concentrates"
            color="purple"
          />
          <CategoryCard
            emoji="🍬"
            title="Edibles"
            subtitle="Gummies, chocolates"
            count={isLoading ? null : counts.edibles}
            path="/products/edibles"
            color="orange"
          />
          <CategoryCard
            emoji="💲"
            title="Price Tiers"
            subtitle="Manage pricing"
            path="/price-tiers"
            color="yellow"
          />
        </SimpleGrid>
      </VStack>
    </Box>
  );
};

export default Products;

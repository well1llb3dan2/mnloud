import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  VStack,
  HStack,
  Text,
  SimpleGrid,
  useColorMode,
  Icon,
  Image,
  AspectRatio,
  useBreakpointValue,
} from '@chakra-ui/react';
import { GiFlowerPot } from 'react-icons/gi';
import { FiPackage, FiDroplet, FiCoffee, FiDollarSign } from 'react-icons/fi';
import { productService } from '../services';

const CategoryCard = ({ icon, title, subtitle, count, path, color, imageSrc }) => {
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
      maxW={{ base: '100%', sm: '100%' }}
      mx="auto"
    >
      {imageSrc ? (
        isMobile ? (
          <HStack spacing={4} align="center">
            <Box
              w="96px"
              borderRadius="xl"
              bg={colorMode === 'dark' ? 'gray.700' : 'gray.900'}
              p={2}
            >
              <AspectRatio ratio={1} w="100%">
                <Image
                  src={imageSrc}
                  alt={title}
                  w="100%"
                  h="100%"
                  objectFit="contain"
                  borderRadius="lg"
                />
              </AspectRatio>
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
          <VStack spacing={2} w="100%">
            <Box
              w="100%"
              borderRadius="xl"
              bg={colorMode === 'dark' ? 'gray.700' : 'gray.900'}
              p={2}
            >
              <AspectRatio ratio={1} w="100%">
                <Image
                  src={imageSrc}
                  alt={title}
                  w="100%"
                  h="100%"
                  objectFit="contain"
                  borderRadius="lg"
                />
              </AspectRatio>
            </Box>
            <Text fontWeight="bold" fontSize="md" textAlign="center">
              {title}
            </Text>
          </VStack>
        )
      ) : (
        isMobile ? (
          <HStack spacing={4} align="center">
            <Box p={3} borderRadius="xl" bg={`${color}.500`} color="white">
              <Icon as={icon} boxSize={6} />
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
            <Box p={4} borderRadius="full" bg={`${color}.500`} color="white">
              <Icon as={icon} boxSize={8} />
            </Box>
            <Text fontWeight="bold" fontSize="lg">
              {title}
            </Text>
            <Text fontSize="sm" color="gray.500" textAlign="center">
              {typeof count === 'number' ? `${count} active` : subtitle}
            </Text>
          </VStack>
        )
      )}
    </Box>
  );
};

const Products = () => {
  const baseUrl = import.meta.env.BASE_URL || '/';
  const { data, isLoading } = useQuery({
    queryKey: ['productCounts', 'categories'],
    queryFn: async () => {
      const [bulk, packaged, concentrates, edibles] = await Promise.all([
        productService.getBulkFlowers(),
        productService.getPackagedFlowers(),
        productService.getConcentrates(),
        productService.getEdibles(),
      ]);

      const activeCount = (items = []) =>
        items.filter((item) => item.isActive !== false).length;

      return {
        bulk: activeCount(bulk?.products),
        packaged: activeCount(packaged?.products),
        concentrates: activeCount(concentrates?.products),
        edibles: activeCount(edibles?.products),
      };
    },
  });

  const counts = data || {};

  return (
    <Box p={4}>
      <VStack spacing={6} align="stretch">
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
          <CategoryCard
            icon={GiFlowerPot}
            title="Deli-Style Flower"
            subtitle="Tier-priced flower"
            count={isLoading ? null : counts.bulk}
            path="/products/bulk"
            color="green"
            imageSrc={`${baseUrl}images/deli-style_flower_cryptic.png`}
          />
          <CategoryCard
            icon={FiPackage}
            title="Pre-Pack Flower"
            subtitle="Pre-packaged brands"
            count={isLoading ? null : counts.packaged}
            path="/products/packaged"
            color="teal"
            imageSrc={`${baseUrl}images/pre-pack_flower_cryptic.png`}
          />
          <CategoryCard
            icon={FiDroplet}
            title="Concentrate"
            subtitle="Vapes, wax & more"
            count={isLoading ? null : counts.concentrates}
            path="/products/concentrates"
            color="purple"
            imageSrc={`${baseUrl}images/concentrate_cryptic.png`}
          />
          <CategoryCard
            icon={FiCoffee}
            title="Edible"
            subtitle="Gummies, chocolates"
            count={isLoading ? null : counts.edibles}
            path="/products/edibles"
            color="orange"
            imageSrc={`${baseUrl}images/edible_cryptic.png`}
          />
          <CategoryCard
            icon={FiDollarSign}
            title="Price Tiers"
            subtitle="Manage pricing"
            path="/price-tiers"
            color="purple"
            imageSrc={`${baseUrl}images/price-tier_cryptic.png`}
          />
        </SimpleGrid>
      </VStack>
    </Box>
  );
};

export default Products;

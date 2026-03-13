import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Spinner,
} from '@chakra-ui/react';

const StrainMatchSelector = ({
  title = 'Closest matches',
  matches = [],
  isLoading = false,
  selectedMatch = null,
  onSelect,
  onNext,
  nextLabel = 'Next',
  emptyText,
}) => {
  const emptyLabel = emptyText || (isLoading ? 'Loading strain matches...' : 'No matches found yet.');

  return (
    <Box
      borderWidth="1px"
      borderRadius="md"
      p={3}
      bg={{ base: 'gray.50', _dark: 'gray.700' }}
    >
      <HStack justify="space-between" mb={2}>
        <Text fontSize="sm" fontWeight="semibold">
          {title}
        </Text>
        {isLoading && <Spinner size="xs" />}
      </HStack>
      {matches.length > 0 ? (
        <VStack align="stretch" spacing={2} maxH="200px" overflowY="auto">
          {matches.map((item) => (
            <Button
              key={item.name}
              size="sm"
              variant={selectedMatch?.name === item.name ? 'solid' : 'outline'}
              colorScheme={selectedMatch?.name === item.name ? 'purple' : 'gray'}
              onClick={() => onSelect?.(item)}
            >
              {item.name}
            </Button>
          ))}
        </VStack>
      ) : (
        <Text fontSize="sm" color="gray.500">
          {emptyLabel}
        </Text>
      )}
      {onNext && (
        <Button mt={3} colorScheme="purple" onClick={onNext}>
          {nextLabel}
        </Button>
      )}
    </Box>
  );
};

export default StrainMatchSelector;

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  VStack,
  HStack,
  Text,
  useColorMode,
  useToast,
  Spinner,
  Center,
  Badge,
  Switch,
  Avatar,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
} from '@chakra-ui/react';
import { userService } from '../services';

const Users = () => {
  const { colorMode } = useColorMode();
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: customersData, isLoading: isLoadingCustomers } = useQuery({
    queryKey: ['customers'],
    queryFn: userService.getCustomers,
  });

  const { data: managersData, isLoading: isLoadingManagers } = useQuery({
    queryKey: ['managers'],
    queryFn: userService.getManagers,
  });

  const customers = customersData?.customers || [];
  const managers = managersData?.managers || [];

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }) => userService.updateStatus(id, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries(['customers']);
      queryClient.invalidateQueries(['managers']);
      toast({ title: 'User updated', status: 'success' });
    },
  });

  const renderUserCard = (user) => {
    const displayName = user.nickname || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User';

    return (
    <Box
      key={user._id}
      bg={colorMode === 'dark' ? 'gray.800' : 'white'}
      p={4}
      borderRadius="lg"
      boxShadow="md"
    >
      <HStack justify="space-between">
        <HStack spacing={4}>
          <Avatar name={displayName} size="md" />
          <VStack align="start" spacing={0}>
            <HStack>
              <Text fontWeight="bold">
                {displayName}
              </Text>
              <Badge colorScheme={user.isActive ? 'green' : 'red'}>
                {user.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </HStack>
            {user.firstName || user.lastName ? (
              <Text fontSize="sm" color="gray.500">
                {user.firstName} {user.lastName}
              </Text>
            ) : null}
          </VStack>
        </HStack>
        <Switch
          isChecked={user.isActive}
          onChange={(e) =>
            toggleMutation.mutate({
              id: user._id,
              isActive: e.target.checked,
            })
          }
        />
      </HStack>
    </Box>
    );
  };

  return (
    <Box p={4}>
      <VStack spacing={4} align="stretch">
        <Text fontSize="2xl" fontWeight="bold">
          Users
        </Text>

        <Tabs colorScheme="purple" isFitted>
          <TabList>
            <Tab>Customers ({customers.length})</Tab>
            <Tab>Managers ({managers.length})</Tab>
          </TabList>

          <TabPanels>
            <TabPanel px={0}>
              {isLoadingCustomers ? (
                <Center h="200px">
                  <Spinner size="xl" color="purple.400" />
                </Center>
              ) : customers.length === 0 ? (
                <Center h="200px">
                  <Text color="gray.500">No customers yet</Text>
                </Center>
              ) : (
                <VStack spacing={3} align="stretch">
                  {customers.map(renderUserCard)}
                </VStack>
              )}
            </TabPanel>

            <TabPanel px={0}>
              {isLoadingManagers ? (
                <Center h="200px">
                  <Spinner size="xl" color="purple.400" />
                </Center>
              ) : managers.length === 0 ? (
                <Center h="200px">
                  <Text color="gray.500">No managers</Text>
                </Center>
              ) : (
                <VStack spacing={3} align="stretch">
                  {managers.map(renderUserCard)}
                </VStack>
              )}
            </TabPanel>
          </TabPanels>
        </Tabs>
      </VStack>
    </Box>
  );
};

export default Users;

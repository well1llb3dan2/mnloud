import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  VStack,
  Input,
  Button,
  FormControl,
  FormLabel,
  useToast,
  useColorMode,
  Center,
  InputGroup,
  InputRightElement,
  IconButton,
  Text,
} from '@chakra-ui/react';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import { useAuthStore } from '../stores';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuthStore();
  const navigate = useNavigate();
  const toast = useToast();
  const { colorMode } = useColorMode();

  useEffect(() => {
    const reason = localStorage.getItem('auth:logoutReason');
    if (reason) {
      toast({
        title: 'Signed out',
        description: reason,
        status: 'warning',
        duration: 5000,
        isClosable: true,
        position: 'top-right',
      });
      localStorage.removeItem('auth:logoutReason');
    }
  }, [toast]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (error) {
      toast({
        title: 'Login failed',
        description: error.response?.data?.message || error.message || 'Invalid credentials',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Center minH="100vh" bg={colorMode === 'dark' ? 'gray.900' : 'gray.50'}>
      <Box
        w="100%"
        maxW="400px"
        p={8}
        mx={4}
        bg={colorMode === 'dark' ? 'gray.800' : 'white'}
        borderRadius="xl"
        boxShadow="xl"
      >
        <form onSubmit={handleSubmit}>
          <VStack spacing={6}>
            <Text fontSize="2xl" fontWeight="bold" color="purple.400">
              Manager Login
            </Text>

            <FormControl isRequired>
              <FormLabel>Email</FormLabel>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                size="lg"
                autoComplete="email"
              />
            </FormControl>

            <FormControl isRequired>
              <FormLabel>Password</FormLabel>
              <InputGroup size="lg">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
                <InputRightElement>
                  <IconButton
                    variant="ghost"
                    icon={showPassword ? <FiEyeOff /> : <FiEye />}
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  />
                </InputRightElement>
              </InputGroup>
            </FormControl>

            <Button
              type="submit"
              colorScheme="purple"
              size="lg"
              w="100%"
              isLoading={isLoading}
              loadingText="Signing in..."
            >
              Sign In
            </Button>
          </VStack>
        </form>
      </Box>
    </Center>
  );
};

export default Login;

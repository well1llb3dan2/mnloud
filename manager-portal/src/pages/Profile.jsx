import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  FormControl,
  FormLabel,
  Input,
  useColorMode,
  useToast,
  InputGroup,
  InputRightElement,
  IconButton,
  Switch,
} from '@chakra-ui/react';
import { FiEye, FiEyeOff, FiBell, FiBellOff } from 'react-icons/fi';
import { useForm } from 'react-hook-form';
import { useAuthStore } from '../stores';
import { authService } from '../services';

const Profile = () => {
  const { colorMode } = useColorMode();
  const toast = useToast();
  const { user, setUser } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const {
    register: registerProfile,
    handleSubmit: handleProfileSubmit,
    formState: { isDirty: isProfileDirty },
  } = useForm({
    defaultValues: {
      nickname: user?.nickname || user?.firstName || '',
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
    },
  });

  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    reset: resetPassword,
  } = useForm();

  const updateProfileMutation = useMutation({
    mutationFn: authService.updateProfile,
    onSuccess: (data) => {
      setUser(data.user);
      toast({ title: 'Profile updated', status: 'success' });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        status: 'error',
      });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: authService.changePassword,
    onSuccess: () => {
      toast({ title: 'Password changed', status: 'success' });
      resetPassword();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        status: 'error',
      });
    },
  });

  const muteMutation = useMutation({
    mutationFn: (muted) => authService.updateProfile({ muteNotifications: muted }),
    onSuccess: (data) => {
      setUser(data.user);
      toast({
        title: data.user?.muteNotifications ? 'Notifications muted' : 'Notifications unmuted',
        status: 'success',
      });
    },
  });

  const onProfileSubmit = (data) => {
    updateProfileMutation.mutate(data);
  };

  const onPasswordSubmit = (data) => {
    if (data.newPassword !== data.confirmPassword) {
      toast({
        title: 'Error',
        description: 'Passwords do not match',
        status: 'error',
      });
      return;
    }
    changePasswordMutation.mutate({
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
    });
  };

  return (
    <Box p={4}>
      <VStack spacing={6} align="stretch">
        <Text fontSize="2xl" fontWeight="bold">
          Profile
        </Text>

        {/* Profile Form */}
        <Box
          bg={colorMode === 'dark' ? 'gray.800' : 'white'}
          p={6}
          borderRadius="lg"
          boxShadow="md"
        >
          <form onSubmit={handleProfileSubmit(onProfileSubmit)}>
            <VStack spacing={4}>
              <Text fontWeight="bold" alignSelf="start">
                Account Information
              </Text>

              <FormControl>
                <FormLabel>First Name</FormLabel>
                <Input {...registerProfile('firstName')} />
              </FormControl>

              <FormControl>
                <FormLabel>Last Name</FormLabel>
                <Input {...registerProfile('lastName')} />
              </FormControl>

              <FormControl>
                <FormLabel>Nickname</FormLabel>
                <Input {...registerProfile('nickname')} placeholder="Display name" />
              </FormControl>

              <Button
                type="submit"
                colorScheme="purple"
                w="100%"
                isLoading={updateProfileMutation.isPending}
                isDisabled={!isProfileDirty}
              >
                Save Changes
              </Button>
            </VStack>
          </form>
        </Box>

        {/* Notification Preferences */}
        <Box
          bg={colorMode === 'dark' ? 'gray.800' : 'white'}
          p={6}
          borderRadius="lg"
          boxShadow="md"
        >
          <VStack spacing={4}>
            <Text fontWeight="bold" alignSelf="start">
              Notifications
            </Text>
            <HStack w="100%" justify="space-between">
              <HStack spacing={3}>
                {user?.muteNotifications ? <FiBellOff size={20} /> : <FiBell size={20} />}
                <Text>{user?.muteNotifications ? 'Notifications muted' : 'Notifications enabled'}</Text>
              </HStack>
              <Switch
                isChecked={!user?.muteNotifications}
                onChange={() => muteMutation.mutate(!user?.muteNotifications)}
                colorScheme="purple"
              />
            </HStack>
          </VStack>
        </Box>

        {/* Password Form */}
        <Box
          bg={colorMode === 'dark' ? 'gray.800' : 'white'}
          p={6}
          borderRadius="lg"
          boxShadow="md"
        >
          <form onSubmit={handlePasswordSubmit(onPasswordSubmit)}>
            <VStack spacing={4}>
              <Text fontWeight="bold" alignSelf="start">
                Change Password
              </Text>

              <FormControl>
                <FormLabel>Current Password</FormLabel>
                <InputGroup>
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    {...registerPassword('currentPassword', { required: true })}
                  />
                  <InputRightElement>
                    <IconButton
                      variant="ghost"
                      icon={showPassword ? <FiEyeOff /> : <FiEye />}
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label="Toggle password"
                    />
                  </InputRightElement>
                </InputGroup>
              </FormControl>

              <FormControl>
                <FormLabel>New Password</FormLabel>
                <InputGroup>
                  <Input
                    type={showNewPassword ? 'text' : 'password'}
                    {...registerPassword('newPassword', { required: true })}
                  />
                  <InputRightElement>
                    <IconButton
                      variant="ghost"
                      icon={showNewPassword ? <FiEyeOff /> : <FiEye />}
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      aria-label="Toggle password"
                    />
                  </InputRightElement>
                </InputGroup>
              </FormControl>

              <FormControl>
                <FormLabel>Confirm New Password</FormLabel>
                <Input
                  type={showNewPassword ? 'text' : 'password'}
                  {...registerPassword('confirmPassword', { required: true })}
                />
              </FormControl>

              <Button
                type="submit"
                colorScheme="purple"
                w="100%"
                isLoading={changePasswordMutation.isPending}
              >
                Change Password
              </Button>
            </VStack>
          </form>
        </Box>
      </VStack>
    </Box>
  );
};

export default Profile;

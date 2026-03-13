import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import { useForm } from 'react-hook-form';
import { useAuthStore } from '../stores';
import { authService } from '../services';
import { useToast } from '../components/ToastProvider';

const Register = () => {
  const { inviteCode } = useParams();
  const [showPassword, setShowPassword] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [inviteValid, setInviteValid] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register: registerUser } = useAuthStore();
  const navigate = useNavigate();
  const toast = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  useEffect(() => {
    const validateInvite = async () => {
      try {
        const result = await authService.validateInvite(inviteCode);
        if (result.valid && result.role === 'customer') {
          setInviteValid(true);
        } else {
          throw new Error('Invalid invite');
        }
      } catch (error) {
        toast({
          title: 'Invalid Invite',
          description: 'This invite link is invalid or has expired.',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
        navigate('/login', { replace: true });
      } finally {
        setIsValidating(false);
      }
    };

    validateInvite();
  }, [inviteCode, navigate, toast]);

  const onSubmit = async (data) => {
    setIsSubmitting(true);

    try {
      await registerUser({
        ...data,
        inviteCode,
      });
        if (isValidating) {
          return (
            <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="panel">Validating invite...</div>
            </div>
          );
        }

        if (!inviteValid) {
          return null;
        }

      toast({
        title: 'Welcome!',
        description: 'Your account has been created.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      navigate('/', { replace: true });
    } catch (error) {
      toast({
        title: 'Registration failed',
        description: error.response?.data?.message || 'Unable to create account',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="panel" style={{ width: '100%', maxWidth: 420 }}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div style={{ display: 'grid', gap: 16 }}>
            <h2>Create Account</h2>

            <label>
              Nickname
              <input
                className="input"
                {...register('nickname')}
                placeholder="What should we call you?"
                autoComplete="nickname"
              />
            </label>

            <label>
              Email
              <input
                className="input"
                type="email"
                {...register('email', {
                  required: 'Email is required',
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: 'Invalid email address',
                  },
                })}
                placeholder="Enter your email"
                autoComplete="email"
              />
              {errors.email?.message ? <small>{errors.email.message}</small> : null}
            </label>

            <label>
              Password
              <div style={{ position: 'relative' }}>
                <input
                  className="input"
                  type={showPassword ? 'text' : 'password'}
                  {...register('password', {
                    required: 'Password is required',
                    minLength: {
                      value: 6,
                      message: 'Password must be at least 6 characters',
                    },
                  })}
                  placeholder="Create a password"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: 8, top: 8, padding: '6px 10px' }}
                >
                  {showPassword ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
              {errors.password?.message ? <small>{errors.password.message}</small> : null}
            </label>

            <button type="submit" className="button" disabled={isSubmitting}>
              {isSubmitting ? 'Creating account...' : 'Create Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Register;

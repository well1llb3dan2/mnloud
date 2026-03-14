import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiLogOut, FiLock, FiUser, FiBellOff, FiBell } from 'react-icons/fi';
import { useForm } from 'react-hook-form';
import { useAuthStore } from '../stores';
import { authService } from '../services';
import { useToast } from '../components/ToastProvider';

const Profile = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const { user, logout, updateUser } = useAuthStore();
  const [isMuting, setIsMuting] = useState(false);

  const profileForm = useForm({
    defaultValues: {
      nickname: user?.nickname || user?.firstName || '',
    },
  });

  const passwordForm = useForm();

  const handleUpdateProfile = async (data) => {
    setIsUpdating(true);
    try {
      const response = await authService.updateProfile(data);
      updateUser(response.user);
      toast({
        title: 'Profile updated',
        status: 'success',
        duration: 2000,
      });
    } catch (error) {
      toast({
        title: 'Error updating profile',
        description: error.response?.data?.message || 'Please try again',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleChangePassword = async (data) => {
    setIsChangingPassword(true);
    try {
      await authService.changePassword(data.currentPassword, data.newPassword);
      toast({
        title: 'Password changed',
        status: 'success',
        duration: 2000,
      });
      onClose();
      passwordForm.reset();
    } catch (error) {
      toast({
        title: 'Error changing password',
        description: error.response?.data?.message || 'Please try again',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const handleToggleMute = async () => {
    setIsMuting(true);
    try {
      const newValue = !user?.muteNotifications;
      const response = await authService.updateProfile({ muteNotifications: newValue });
      updateUser(response.user);
      toast({
        title: newValue ? 'Notifications muted' : 'Notifications unmuted',
        status: 'success',
        duration: 2000,
      });
    } catch (error) {
      toast({
        title: 'Error updating notifications',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setIsMuting(false);
    }
  };

  return (
    <section className="page">
      <div style={{ display: 'grid', gap: 16 }}>
        <div className="panel" style={{ textAlign: 'center' }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#2f6b3b', margin: '0 auto 12px' }} />
          <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>
            {user?.nickname || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Customer'}
          </div>
        </div>

        <div className="panel">
          <form onSubmit={profileForm.handleSubmit(handleUpdateProfile)}>
            <div style={{ display: 'grid', gap: 12 }}>
              <label>
                Nickname
                <input className="input" {...profileForm.register('nickname')} placeholder="What should we call you?" />
              </label>
              <button className="button" type="submit" disabled={isUpdating}>
                <FiUser /> Update Profile
              </button>
            </div>
          </form>
        </div>

        <div className="panel" style={{ display: 'grid', gap: 12 }}>
          <button
            className={`button ${user?.muteNotifications ? 'secondary' : ''}`}
            type="button"
            onClick={handleToggleMute}
            disabled={isMuting}
          >
            {user?.muteNotifications ? <><FiBellOff /> Notifications Muted</> : <><FiBell /> Mute Notifications</>}
          </button>
          <button className="button" type="button" onClick={() => setIsPasswordOpen(true)}>
            <FiLock /> Change Password
          </button>
          <button className="button secondary" type="button" onClick={handleLogout}>
            <FiLogOut /> Sign Out
          </button>
        </div>
      </div>

      {isPasswordOpen ? (
        <div className="modal-backdrop" onClick={() => setIsPasswordOpen(false)} role="presentation">
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <h3>Change Password</h3>
            <form onSubmit={passwordForm.handleSubmit(handleChangePassword)}>
              <div style={{ display: 'grid', gap: 12 }}>
                <label>
                  Current Password
                  <input
                    className="input"
                    type="password"
                    {...passwordForm.register('currentPassword', { required: true })}
                  />
                </label>
                <label>
                  New Password
                  <input
                    className="input"
                    type="password"
                    {...passwordForm.register('newPassword', { required: true, minLength: 6 })}
                  />
                </label>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button className="button secondary" type="button" onClick={() => setIsPasswordOpen(false)}>
                    Cancel
                  </button>
                  <button className="button" type="submit" disabled={isChangingPassword}>
                    {isChangingPassword ? 'Saving...' : 'Change Password'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default Profile;

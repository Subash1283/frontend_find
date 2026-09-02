import React, { useState } from 'react';
import imageCompression from 'browser-image-compression';
import { encryptFile } from '../utils/crypto';



interface ProfileModalProps {
  token: string;
  apiBase: string;
  currentUser: any;
  onClose: () => void;
  onUserUpdated: (user: any) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  token,
  apiBase,
  currentUser,
  onClose,
  onUserUpdated,
  showToast,
}) => {
  
  const [address, setAddress] = useState(currentUser?.address || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');

  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // Password fields & visibility toggles
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Identity Verification fields
  const [docType, setDocType] = useState<'citizenship' | 'passport' | 'driving_license' | 'student_id'>('citizenship');
  const [docFiles, setDocFiles] = useState<File[] | null>(null);
  const [isUploadingDocs, setIsUploadingDocs] = useState(false);

  const vStatus = currentUser?.verificationStatus || (currentUser?.isVerified ? 'verified' : 'unverified');

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsUpdatingProfile(true);
    try {
      const res = await fetch(`${apiBase}/users/profile`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address: address.trim(), phone: phone.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        onUserUpdated(data);
        showToast('Profile details updated successfully!', 'success');
      } else {
        const text = await res.text();
        showToast(text || 'Failed to update profile', 'error');
      }
    } catch {
      showToast('Connection error to backend', 'error');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      return showToast('Please fill out all password fields', 'error');
    }
    if (newPassword.length < 6) {
      return showToast('New password must be at least 6 characters', 'error');
    }
    if (newPassword !== confirmPassword) {
      return showToast('Passwords do not match', 'error');
    }

    setIsChangingPassword(true);
    try {
      const res = await fetch(`${apiBase}/users/profile`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ oldPassword: currentPassword, newPassword }),
      });
      if (res.ok) {
        showToast('Password updated successfully!', 'success');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        const data = await res.json();
        showToast(data.message || 'Failed to change password. Double check current password.', 'error');
      }
    } catch {
      showToast('Connection error to backend', 'error');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    const compressedFiles: File[] = [];
    const options = {
      maxSizeMB: 1,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
    };

    try {
      showToast('Optimizing document...', 'info');
      for (let i = 0; i < selectedFiles.length; i++) {
        const compressedBlob = await imageCompression(selectedFiles[i], options);
        const compressedFile = new File([compressedBlob], selectedFiles[i].name, {
          type: selectedFiles[i].type,
          lastModified: Date.now(),
        });
        compressedFiles.push(compressedFile);
      }
      setDocFiles(compressedFiles);
    } catch (error) {
      console.error('Compression error:', error);
      showToast('Document optimization failed, using original', 'error');
      setDocFiles(Array.from(selectedFiles));
    }
  };

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docFiles || docFiles.length === 0) {
      return showToast('Please select document files to upload', 'error');
    }

    // Check count matching document types
    if ((docType === 'passport' || docType === 'student_id') && docFiles.length !== 1) {
      return showToast('Passport and Student ID upload requires exactly 1 image (front only).', 'error');
    }
    if ((docType === 'citizenship' || docType === 'driving_license') && docFiles.length !== 2) {
      return showToast('Citizenship card and Driver\'s License uploads require exactly 2 images (front & back).', 'error');
    }

    setIsUploadingDocs(true);
    const formData = new FormData();
    formData.append('documentType', docType);
    // Encrypt files before sending
    try {
      if (docFiles.length >= 1) {
        const encryptedFront = await encryptFile(docFiles[0]);
        formData.append('document', encryptedFront);
      }
      if (docFiles.length >= 2) {
        const encryptedBack = await encryptFile(docFiles[1]);
        formData.append('documentBack', encryptedBack);
      }
    } catch (err) {
      console.error('Encryption failed:', err);
      setIsUploadingDocs(false);
      return showToast('Failed to encrypt documents before upload.', 'error');
    }

    try {
      const res = await fetch(`${apiBase}/users/upload-document`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        onUserUpdated(data);
        
        // Check autoVerification result and show appropriate message
        if (data.autoVerification) {
          if (data.autoVerification.verified) {
            showToast(' Verification Successful! Your identity has been verified.', 'success');
          } else if (data.autoVerification.rejected) {
            const count = data.autoVerification.attemptsCount || 1;
            const attemptsLeft = Math.max(0, 6 - count);
            showToast(data.autoVerification.reason || ` Verification Failed (Attempt ${count}/6). You have ${attemptsLeft} retry attempt(s) left.`, 'error');
          } else {
            showToast(data.autoVerification.reason || 'Documents uploaded! Your verification has been submitted for manual admin review.', 'info');
          }
        } else {
          showToast('Documents uploaded successfully! Processing verification...', 'success');
        }
        
        setDocFiles(null);
        // Clear input element
        const input = document.getElementById('profileDocInput') as HTMLInputElement;
        if (input) input.value = '';
      } else {
        const data = await res.json();
        showToast(data.message || 'Failed to upload verification documents.', 'error');
      }
    } catch {
      showToast('Connection error to backend', 'error');
    } finally {
      setIsUploadingDocs(false);
    }
  };

  const getStatusBadge = () => {
    if (currentUser?.role === 'admin') return <span className="status-badge found-tag" style={{ background: '#dbeafe', color: '#1e40af', border: '1px solid #93c5fd' }}>ADMINISTRATOR 🛡️</span>;
    if (vStatus === 'verified') return <span className="status-badge found-tag" style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #86efac' }}>VERIFIED ✓</span>;
    if (vStatus === 'pending') return <span className="status-badge" style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}>PENDING REVIEW</span>;
    return <span className="status-badge lost-tag" style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5' }}>UNVERIFIED</span>;
  };

  return (
    <div className="modal active" onClick={onClose} style={{ backdropFilter: 'blur(6px)' }}>
      <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px', padding: '28px', borderRadius: '20px' }}>
        <div className="modal-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', paddingBottom: '14px', borderBottom: '1px solid var(--border-soft)' }}>
          <h3 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>⚙️</span> Profile & Verification Control
          </h3>
          <button 
            type="button"
            className="modal-close" 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            style={{ width: '32px', height: '32px', borderRadius: '50%', border: 'none', background: 'var(--bg-secondary)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', color: 'var(--text-soft)' }}
          >
            &times;
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* PROFILE INFO SECTION */}
          <div style={{ background: 'var(--bg-secondary)', borderRadius: '14px', padding: '20px', border: '1px solid var(--border-soft)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fas fa-user-circle" style={{ color: '#2563eb' }}></i> Basic Details
              </h4>
            </div>
            <form onSubmit={handleUpdateProfile}>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="profile-name">Full Name (Permanent)</label>
                  <input id="profile-name" name="name" type="text" value={currentUser?.name || ''} disabled style={{ opacity: 0.7, cursor: 'not-allowed', backgroundColor: 'var(--bg-primary)' }} />
                </div>
                <div className="form-group">
                  <label htmlFor="profile-email">Email (Account ID)</label>
                  <input id="profile-email" name="email" type="email" value={currentUser?.email || ''} disabled style={{ opacity: 0.7, cursor: 'not-allowed', backgroundColor: 'var(--bg-primary)' }} />
                </div>
              </div>
              <div className="form-row" style={{ marginTop: '12px' }}>
                <div className="form-group">
                  <label htmlFor="profile-address">Home Address</label>
                  <input id="profile-address" name="address" type="text" placeholder="e.g. Lalitpur, Nepal" value={address} onChange={e => setAddress(e.target.value)} />
                </div>
                <div className="form-group">
                  <label htmlFor="profile-phone">Phone Number</label>
                  <input id="profile-phone" name="phone" type="text" placeholder="e.g. 98XXXXXXXX" value={phone} onChange={e => setPhone(e.target.value)} />
                </div>
              </div>
              <div className="form-row" style={{ marginTop: '12px' }}>

              </div>

              <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" disabled={isUpdatingProfile} className="btn-primary" style={{ padding: '9px 24px', fontSize: '0.88rem', borderRadius: '10px', fontWeight: 700 }}>
                  {isUpdatingProfile ? 'Saving...' : 'Save Profile Details'}
                </button>
              </div>
            </form>
          </div>

          {/* CHANGE PASSWORD */}
          <div style={{ background: 'var(--bg-secondary)', borderRadius: '14px', padding: '20px', border: '1px solid var(--border-soft)' }}>
            <h4 style={{ marginBottom: '16px', fontSize: '1rem', fontWeight: 700, margin: '0 0 16px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fas fa-key" style={{ color: '#059669' }}></i> Change Account Password
            </h4>
            <form onSubmit={handleChangePassword}>
              <div className="form-row">
                <div className="form-group" style={{ position: 'relative' }}>
                  <label htmlFor="profile-current-password">Current Password</label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      id="profile-current-password" 
                      name="currentPassword" 
                      type={showCurrentPass ? 'text' : 'password'} 
                      value={currentPassword} 
                      onChange={e => setCurrentPassword(e.target.value)} 
                      style={{ paddingRight: '40px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPass(!showCurrentPass)}
                      style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-soft)', fontSize: '0.9rem' }}
                    >
                      <i className={showCurrentPass ? 'fas fa-eye-slash' : 'fas fa-eye'}></i>
                    </button>
                  </div>
                </div>
              </div>
              <div className="form-row" style={{ marginTop: '12px' }}>
                <div className="form-group" style={{ position: 'relative' }}>
                  <label htmlFor="profile-new-password">New Password (min 6 chars)</label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      id="profile-new-password" 
                      name="newPassword" 
                      type={showNewPass ? 'text' : 'password'} 
                      value={newPassword} 
                      onChange={e => setNewPassword(e.target.value)} 
                      style={{ paddingRight: '40px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass(!showNewPass)}
                      style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-soft)', fontSize: '0.9rem' }}
                    >
                      <i className={showNewPass ? 'fas fa-eye-slash' : 'fas fa-eye'}></i>
                    </button>
                  </div>
                </div>
                <div className="form-group" style={{ position: 'relative' }}>
                  <label htmlFor="profile-confirm-password">Confirm Password</label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      id="profile-confirm-password" 
                      name="confirmPassword" 
                      type={showConfirmPass ? 'text' : 'password'} 
                      value={confirmPassword} 
                      onChange={e => setConfirmPassword(e.target.value)} 
                      style={{ paddingRight: '40px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPass(!showConfirmPass)}
                      style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-soft)', fontSize: '0.9rem' }}
                    >
                      <i className={showConfirmPass ? 'fas fa-eye-slash' : 'fas fa-eye'}></i>
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" disabled={isChangingPassword} className="btn-primary" style={{ padding: '9px 24px', fontSize: '0.88rem', borderRadius: '10px', fontWeight: 700 }}>
                  {isChangingPassword ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>

          {/* IDENTITY VERIFICATION */}
          {currentUser?.role !== 'admin' && (
            <div style={{ background: 'var(--bg-secondary)', borderRadius: '14px', padding: '20px', border: '1px solid var(--border-soft)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fas fa-id-card" style={{ color: '#8b5cf6' }}></i> Identity Verification
                </h4>
                {getStatusBadge()}
              </div>

              {vStatus === 'verified' ? (
                <div style={{ background: '#ecfdf5', color: '#065f46', padding: '14px 16px', borderRadius: '12px', fontSize: '0.88rem', border: '1px solid #a7f3d0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                   <i className="fas fa-check-circle" style={{ fontSize: '1.2rem', color: '#10b981' }}></i>
                   <span>Your account has been verified. You now have full access to publish posts and make claims on Findit.</span>
                </div>
              ) : vStatus === 'pending' ? (
                <div style={{ background: '#fffbeb', color: '#92400e', padding: '14px 16px', borderRadius: '12px', fontSize: '0.88rem', border: '1px solid #fde68a', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600 }}>
                    <i className="fas fa-clock" style={{ fontSize: '1.2rem', color: '#f59e0b' }}></i>
                    <span>Your document is under manual review by the administrator.</span>
                  </div>
                  {(currentUser?.verificationAttempts || 0) >= 6 ? (
                    <span style={{ fontSize: '0.82rem', color: '#b45309' }}>
                      ⚠️ Maximum auto-verification attempts (6/6) used. Auto-verification is locked, and your request is waiting for manual admin approval.
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.82rem', color: '#b45309' }}>
                      Name matches are auto-processed. If unresolved, an administrator will review your documents manually.
                    </span>
                  )}
                </div>
              ) : (
                <form onSubmit={handleUploadDocument}>
                  <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '12px 14px', borderRadius: '10px', fontSize: '0.85rem', color: '#1e40af', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <i className="fas fa-info-circle" style={{ fontSize: '1.1rem', color: '#3b82f6' }}></i>
                      <span>To report or claim items, please verify your identity by uploading official documents.</span>
                    </div>
                    <span style={{ fontSize: '0.78rem', background: '#dbeafe', color: '#1e40af', padding: '3px 8px', borderRadius: '6px', whiteSpace: 'nowrap', fontWeight: 700, border: '1px solid #93c5fd' }}>
                      Attempt {currentUser?.verificationAttempts || 0}/6
                    </span>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="profile-doc-type">Document Category</label>
                      <select id="profile-doc-type" name="docType" value={docType} onChange={e => setDocType(e.target.value as any)}>
                        <option value="citizenship">Citizenship Card (requires front + back)</option>
                        <option value="passport">Passport (requires front scan only)</option>
                        <option value="driving_license">Driver's License (requires front + back)</option>
                        <option value="student_id">Student ID Card (requires front only)</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-row" style={{ marginTop: '12px' }}>
                    <div className="form-group">
                      <label htmlFor="profileDocInput">Upload Document Scans</label>
                      <input
                        id="profileDocInput"
                        name="documents"
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleFileChange}
                      />
                      <small style={{ color: 'var(--text-soft)', marginTop: '6px', display: 'block' }}>
                        {(docType === 'passport' || docType === 'student_id')
                          ? 'Select exactly 1 image (front side).'
                          : 'Select exactly 2 images — Upload Front first, then Back.'}
                      </small>
                      {docFiles && docFiles.length > 0 && (
                        <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {docFiles.map((f, i) => (
                            <span key={i} style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '6px', background: '#e0e7ff', color: '#3730a3', fontWeight: 600 }}>
                              📄 {f.name} ({Math.round(f.size / 1024)} KB)
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                    <button type="submit" disabled={isUploadingDocs} className="btn-primary" style={{ padding: '9px 24px', fontSize: '0.88rem', borderRadius: '10px', fontWeight: 700 }}>
                      {isUploadingDocs ? 'Uploading & Verifying...' : 'Submit Verification Docs'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


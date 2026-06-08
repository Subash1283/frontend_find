import React, { useState } from 'react';


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

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Identity Verification fields
  const [docType, setDocType] = useState<'citizenship' | 'passport' | 'driving_license' | 'student_id'>('citizenship');
  const [docFiles, setDocFiles] = useState<FileList | null>(null);
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
        body: JSON.stringify({ address: address.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        onUserUpdated(data);
        showToast('Profile updated successfully!', 'success');
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
    // Backend expects multipart fields: document + (optional) documentBack
    // Frontend order: front first, then back.
    if (docFiles.length >= 1) formData.append('document', docFiles[0]);
    if (docFiles.length >= 2) formData.append('documentBack', docFiles[1]);

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
            showToast('🎉 Verification Successful! Your identity has been verified.', 'success');
          } else if (data.autoVerification.rejected) {
            showToast(`❌ Verification Failed. ${data.autoVerification.reason || 'Name mismatch detected.'}`, 'error');
          } else {
            showToast('Documents uploaded! Your verification is pending manual review.', 'info');
          }
        } else {
          showToast('Documents uploaded successfully! Processing auto-verification...', 'success');
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
    if (currentUser?.role === 'admin') return <span className="status-badge found-tag">ADMINISTRATOR 🛡️</span>;
    if (vStatus === 'verified') return <span className="status-badge found-tag">VERIFIED ✓</span>;
    if (vStatus === 'pending') return <span className="status-badge" style={{ background: 'var(--reward-bg)', color: 'var(--reward)', border: '1px solid rgba(245,158,11,0.2)' }}>PENDING REVIEW</span>;
    return <span className="status-badge lost-tag">UNVERIFIED PROFILE</span>;
  };

  return (
    <div className="modal active" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '620px' }}>
        <div className="modal-title">
          <h3>⚙️ Profile & Verification Control</h3>
          <button className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          {/* PROFILE INFO SECTION */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid var(--border-soft)', paddingBottom: '6px' }}>
              <h4 style={{ fontFamily: 'Syne', fontSize: '1rem', margin: 0 }}>
                👤 Basic Details
              </h4>
            </div>
            <form onSubmit={handleUpdateProfile}>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="profile-name">Full Name (Permanent)</label>
                  <input id="profile-name" name="name" type="text" value={currentUser?.name || ''} disabled style={{ opacity: 0.65, cursor: 'not-allowed' }} />
                </div>
                <div className="form-group">
                  <label htmlFor="profile-email">Email (Account ID)</label>
                  <input id="profile-email" name="email" type="email" value={currentUser?.email || ''} disabled style={{ opacity: 0.65, cursor: 'not-allowed' }} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="profile-address">Home Address</label>
                  <input id="profile-address" name="address" type="text" placeholder="e.g. Lalitpur, Nepal" value={address} onChange={e => setAddress(e.target.value)} />
                </div>
                <div className="form-group">
                  <label htmlFor="profile-phone">Phone Number</label>
                  <input id="profile-phone" name="phone" type="text" placeholder="e.g. 98XXXXXXXX" value={phone} onChange={e => setPhone(e.target.value)} />
                </div>
              </div>
              <button type="submit" disabled={isUpdatingProfile} className="btn-primary" style={{ padding: '8px 20px', fontSize: '0.8rem' }}>
                {isUpdatingProfile ? 'Saving...' : 'Save Profile Details'}
              </button>
            </form>
          </div>

          {/* CHANGE PASSWORD */}
          <div>
            <h4 style={{ fontFamily: 'Syne', marginBottom: '12px', fontSize: '1rem', borderBottom: '1px solid var(--border-soft)', paddingBottom: '6px' }}>
              🔑 Change Account Password
            </h4>
            <form onSubmit={handleChangePassword}>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="profile-current-password">Current Password</label>
                  <input id="profile-current-password" name="currentPassword" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="profile-new-password">New Password (min 6 chars)</label>
                  <input id="profile-new-password" name="newPassword" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                </div>
                <div className="form-group">
                  <label htmlFor="profile-confirm-password">Confirm Password</label>
                  <input id="profile-confirm-password" name="confirmPassword" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                </div>
              </div>
              <button type="submit" disabled={isChangingPassword} className="btn-primary" style={{ padding: '8px 20px', fontSize: '0.8rem' }}>
                {isChangingPassword ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </div>

          {/* IDENTITY VERIFICATION */}
          {currentUser?.role !== 'admin' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid var(--border-soft)', paddingBottom: '6px' }}>
                <h4 style={{ fontFamily: 'Syne', fontSize: '1rem', margin: 0 }}>
                  🪪 Identity Verification
                </h4>
                {getStatusBadge()}
              </div>

              {vStatus === 'verified' ? (
                <div style={{ background: 'var(--found-bg)', color: 'var(--found)', padding: '12px', borderRadius: '8px', fontSize: '0.82rem', border: '1px solid rgba(16,185,129,0.3)' }}>
                  🎉 Your account has been verified. You now have full access to publish posts and make claims on Findit.
                </div>
              ) : vStatus === 'pending' ? (
                <div style={{ background: 'var(--reward-bg)', color: '#b45309', padding: '12px', borderRadius: '8px', fontSize: '0.82rem', border: '1px solid rgba(245,158,11,0.3)' }}>
                  ⏳ Your document has been uploaded and is under manual review by the administrator. Name matches are auto-processed.
                </div>
              ) : (
                <form onSubmit={handleUploadDocument}>
                  <div style={{ background: '#fffbeb', border: '1px solid rgba(245,158,11,0.4)', padding: '10px 12px', borderRadius: '8px', fontSize: '0.82rem', color: '#b45309', marginBottom: '14px' }}>
                    📢 To report or claim items, please verify your identity by uploading official documents. Name matching checks are auto-approved instantly.
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="profile-doc-type">Document Category</label>
                      <select id="profile-doc-type" name="docType" value={docType} onChange={e => setDocType(e.target.value as any)}>
                        <option value="citizenship">Citizenship Card (requires front + back)</option>
                        <option value="passport">Passport (requires front scan only)</option>
                        <option value="driving_license">Driver's License (requires front + back)</option>
                        <option value="student_id">🎓 Student ID Card (requires front only)</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="profileDocInput">Upload Document Scans</label>
                      <input
                        id="profileDocInput"
                        name="documents"
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={e => setDocFiles(e.target.files)}
                      />
                      <small style={{ color: 'var(--text-soft)', marginTop: '4px', display: 'block' }}>
                        {(docType === 'passport' || docType === 'student_id')
                          ? 'Select exactly 1 image (front side).'
                          : 'Select exactly 2 images — Upload Front first, then Back.'}
                      </small>
                    </div>
                  </div>
                  <button type="submit" disabled={isUploadingDocs} className="btn-primary" style={{ padding: '8px 20px', fontSize: '0.8rem' }}>
                    {isUploadingDocs ? 'Uploading & Verifying...' : 'Submit Verification Docs'}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>

    </div>
  );
};


import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';

interface ReportModalProps {
  token: string;
  apiBase: string;
  onClose: () => void;
  onSuccess: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  token,
  apiBase,
  onClose,
  onSuccess,
  showToast,
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Electronics');
  const [type, setType] = useState('lost');
  const [location, setLocation] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [description, setDescription] = useState('');
  const [sensitive, setSensitive] = useState('');
  const [sensitiveBlur, setSensitiveBlur] = useState(false);
  const [reward, setReward] = useState('');
  const [currency, setCurrency] = useState('NPR');
  const [files, setFiles] = useState<FileList | null>(null);
  const [showMismatchDialog, setShowMismatchDialog] = useState(false);
  const [mismatchDetails, setMismatchDetails] = useState<{ reason: string; title: string; category: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAutoFilling, setIsAutoFilling] = useState(false);
  const [documentType, setDocumentType] = useState('citizenship');
  const [showPicker, setShowPicker] = useState(false);
  const pickerMapRef = useRef<L.Map | null>(null);
  const pickerMarkerRef = useRef<L.Marker | null>(null);
  const [tempLat, setTempLat] = useState<number | null>(null);
  const [tempLng, setTempLng] = useState<number | null>(null);
  const [mapSearch, setMapSearch] = useState('');
  const [mapSearching, setMapSearching] = useState(false);

  const handleMapSearch = async () => {
    if (!mapSearch.trim()) return;
    setMapSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(mapSearch)}&limit=1`
      );
      const data = await res.json();
      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        const latNum = parseFloat(lat);
        const lngNum = parseFloat(lon);
        pickerMapRef.current?.setView([latNum, lngNum], 16);
        setTempLat(latNum);
        setTempLng(lngNum);
        if (pickerMarkerRef.current) {
          pickerMarkerRef.current.setLatLng([latNum, lngNum]);
        } else if (pickerMapRef.current) {
          pickerMarkerRef.current = L.marker([latNum, lngNum]).addTo(pickerMapRef.current);
        }
      } else {
        showToast('Place not found. Try a different search term.', 'error');
      }
    } catch {
      showToast('Search failed. Check your connection.', 'error');
    } finally {
      setMapSearching(false);
    }
  };

  const isFound = type === 'found';

  // Reset files when category or documentType changes
  useEffect(() => {
    setFiles(null);
    const fileInput = document.getElementById('report-images') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  }, [category, documentType]);

  // File validator
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    if (category === 'Documents') {
      const requiredCount = (documentType === 'passport' || documentType === 'driving_license' || documentType === 'certificate') ? 1 : 2;
      if (selectedFiles.length !== requiredCount) {
        showToast(`Documents of type "${documentType.replace('_', ' ')}" require exactly ${requiredCount} image(s)`, 'error');
        e.target.value = '';
        setFiles(null);
        return;
      }
    } else {
      if (selectedFiles.length > 2) {
        showToast('Maximum 2 images allowed', 'error');
        e.target.value = '';
        setFiles(null);
        return;
      }
    }
    setFiles(selectedFiles);

    // Trigger AI Auto-fill if it's not a document
    if (category !== 'Documents' && selectedFiles[0]) {
      handleAutoFill(selectedFiles[0]);
    }
  };

  const handleAutoFill = async (file: File) => {
    if (!file) return;
    setIsAutoFilling(true);
    showToast(' AI is analyzing the image.Please wait ...', 'info');
    
    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await fetch(`${apiBase}/items/autofill`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        let populated = false;
        
        if (data.title && !title) {
          setTitle(data.title);
          populated = true;
        }
        if (data.category && data.category !== 'Other' && category === 'Electronics') { // default is Electronics
          setCategory(data.category);
          populated = true;
        } else if (data.category && data.category !== 'Other' && category !== data.category) {
          // If they haven't manually changed it away from default, or we just want to help
          if (!title) { // simple heuristic: if title was empty, they probably haven't started filling the form
             setCategory(data.category);
             populated = true;
          }
        }
        if (data.description && !description) {
          setDescription(data.description);
          populated = true;
        }

        if (populated) {
          showToast(' Form auto-filled successfully!', 'success');
        } else if (data.title || data.description) {
           // We received data but fields were already populated, maybe prompt them or do nothing.
           showToast('AI analysis complete (existing fields kept)', 'info');
        }
      }
    } catch (e) {
      console.warn('AI Auto-fill failed:', e);
    } finally {
      setIsAutoFilling(false);
    }
  };

  // Location Picker logic
  useEffect(() => {
    if (showPicker) {
      setTimeout(() => {
        const container = document.getElementById('pickerMap');
        if (!container) return;

        if (!pickerMapRef.current) {
          const map = L.map('pickerMap').setView([27.7172, 85.3240], 13);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
          }).addTo(map);

          map.on('click', (e: L.LeafletMouseEvent) => {
            const { lat, lng } = e.latlng;
            setTempLat(lat);
            setTempLng(lng);

            if (pickerMarkerRef.current) {
              pickerMarkerRef.current.setLatLng(e.latlng);
            } else {
              pickerMarkerRef.current = L.marker(e.latlng).addTo(map);
            }
          });

          pickerMapRef.current = map;
        } else {
          pickerMapRef.current.invalidateSize();
        }
      }, 150);
    } else {
      if (pickerMapRef.current) {
        pickerMapRef.current.remove();
        pickerMapRef.current = null;
        pickerMarkerRef.current = null;
      }
    }
  }, [showPicker]);

  const confirmLocation = async () => {
    if (!tempLat || !tempLng) {
      showToast('Please click on the map first to pin a location', 'error');
      return;
    }

    setLatitude(String(tempLat));
    setLongitude(String(tempLng));
    setLocation('📍 Location Pinned (fetching address...)');
    setShowPicker(false);

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${tempLat}&lon=${tempLng}`
      );
      const data = await res.json();
      if (data && data.display_name) {
        setLocation(data.display_name);
      } else {
        setLocation(`Pinned Location (${tempLat.toFixed(4)}, ${tempLng.toFixed(4)})`);
      }
    } catch (e) {
      setLocation(`Pinned Location (${tempLat.toFixed(4)}, ${tempLng.toFixed(4)})`);
    }
    showToast('Location pinned!', 'success');
  };

  // Submit report
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return showToast('Title is required', 'error');

    const formData = new FormData();
    formData.append('title', title.trim());
    formData.append('category', category);
    formData.append('type', type);
    if (location.trim()) formData.append('location', location.trim());
    if (latitude) formData.append('latitude', latitude);
    if (longitude) formData.append('longitude', longitude);
    formData.append('description', description.trim());
    formData.append('sensitive', sensitive.trim());
    formData.append('sensitiveBlur', String(sensitiveBlur));
    if (sensitiveBlur) {
      formData.append('blurType', 'full_image');
    }
    formData.append('reward', isFound ? '0' : reward || '0');
    formData.append('currency', currency);

    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        formData.append('images', files[i]);
      }
    }
    if (category === 'Documents') {
      formData.append('documentType', documentType);
    }

    try {
      setIsSubmitting(true);
      const res = await fetch(`${apiBase}/items`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      
      if (res.ok) {
        showToast('Item reported successfully!', 'success');
        onSuccess();
      } else {
        // Try to parse JSON error response for mismatch detection
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await res.json();
          
          // Check if this is an image mismatch error
          if (errorData.error === 'Image Mismatch' && errorData.details) {
            setMismatchDetails({
              reason: errorData.message,
              title: errorData.details.title || title,
              category: errorData.details.category || category
            });
            setShowMismatchDialog(true);
            return;
          }
          
          showToast(errorData.message || 'Failed to submit report', 'error');
        } else {
          const errorText = await res.text();
          showToast(errorText || 'Failed to submit report', 'error');
        }
      }
    } catch {
      showToast('Connection error to backend', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMismatchDismiss = () => {
    setShowMismatchDialog(false);
    setMismatchDetails(null);
  };

  const handleMismatchUpdateCategory = () => {
    setShowMismatchDialog(false);
    setMismatchDetails(null);
    showToast('Please update the category to match your image', 'info');
  };

  return (
    <>
      <div className="modal active" onClick={onClose}>
        <div className="modal-card" onClick={e => e.stopPropagation()}>
          <div className="modal-title">
            <h3>📢 Report Lost or Found Item</h3>
            <button className="modal-close" onClick={onClose}>
              &times;
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="report-title">Item Name / Title</label>
                <input
                  id="report-title"
                  name="title"
                  type="text"
                  placeholder="e.g. Blue leather wallet"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="report-category">Category</label>
                <select id="report-category" name="category" value={category} onChange={e => setCategory(e.target.value)}>
                  <option value="Electronics">Electronics</option>
                  <option value="Documents">Documents</option>
                  <option value="Vehicles">Vehicles</option>
                  <option value="Keys">Keys</option>
                  <option value="Clothing">Clothing</option>
                  <option value="Wallets & Bags">Wallets & Bags</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="report-type">Report Type</label>
                <select id="report-type" name="type" value={type} onChange={e => setType(e.target.value)}>
                  <option value="lost">Lost</option>
                  <option value="found">Found</option>
                </select>
              </div>
            </div>

            {category === 'Documents' && (
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="report-document-type">Document Type</label>
                  <select 
                    id="report-document-type" 
                    name="documentType" 
                    value={documentType} 
                    onChange={e => setDocumentType(e.target.value)}
                  >
                    <option value="citizenship">Citizenship Card (Requires Front & Back 2 Images )</option>
                    <option value="passport">Passport (Requires Front Only - 1 Image)</option>
                    <option value="driving_license">Driving License (Requires Front Only - 1 Image)</option>
                    <option value="certificate">Certificate (Requires Front Only - 1 Image)</option>
                  </select>
                </div>
              </div>
            )}

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="report-location">Location Name</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    id="report-location"
                    name="location"
                    type="text"
                    placeholder="e.g. Kathmandu Mall, Bagbazar"
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ padding: '8px 14px', borderRadius: '10px' }}
                    onClick={() => setShowPicker(true)}
                  >
                    📍 Pin
                  </button>
                </div>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="report-latitude">Latitude (optional)</label>
                <input
                  id="report-latitude"
                  name="latitude"
                  type="text"
                  placeholder="e.g. 27.7172"
                  value={latitude}
                  onChange={e => setLatitude(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="report-longitude">Longitude (optional)</label>
                <input
                  id="report-longitude"
                  name="longitude"
                  type="text"
                  placeholder="e.g. 85.3240"
                  value={longitude}
                  onChange={e => setLongitude(e.target.value)}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="report-description">Detailed Description</label>
                <textarea
                  id="report-description"
                  name="description"
                  rows={3}
                  placeholder="Provide physical features, identifying marks, serial numbers, date/time lost..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                ></textarea>
              </div>
            </div>

            {!isFound && (
              <div className="form-row" id="rewardContainer">
                <div className="form-group">
                  <label htmlFor="report-reward">Offer Reward Amount (Optional)</label>
                  <input
                    id="report-reward"
                    name="reward"
                    type="number"
                    placeholder="e.g. 1500"
                    value={reward}
                    onChange={e => setReward(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ flex: '0.4' }}>
                  <label htmlFor="report-currency">Currency</label>
                  <select id="report-currency" name="currency" value={currency} onChange={e => setCurrency(e.target.value)}>
                    <option value="NPR">NPR</option>
                    {/* <option value="USD">USD</option>
                    <option value="INR">INR</option> */}
                  </select>
                </div>
              </div>
            )}

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="report-sensitive">Sensitive content note (Optional)</label>
                <input
                  id="report-sensitive"
                  name="sensitive"
                  type="text"
                  placeholder="e.g. ID card or citizenship number"
                  value={sensitive}
                  onChange={e => setSensitive(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '24px' }}>
                <input
                  type="checkbox"
                  id="blurCheck"
                  checked={sensitiveBlur}
                  onChange={e => setSensitiveBlur(e.target.checked)}
                  style={{ width: 'auto', transform: 'scale(1.2)', cursor: 'pointer' }}
                />
                <label htmlFor="blurCheck" style={{ cursor: 'pointer', margin: 0 }}>
                  Mask Sensitive Image
                </label>
              </div>
              {sensitiveBlur && (
                <small style={{ color: 'var(--text-soft)', marginTop: '6px', display: 'block' }}>
                  Images will be blurred and require manual reveal. The sensitive text note above will be masked with partial characters.
                </small>
              )}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="report-images">
                  Attach Images (Max 2)
                  {isAutoFilling && (
                    <span style={{ marginLeft: 'F12px', color: 'var(--brand)', fontSize: '0.85rem' }}>
                      <i className="fas fa-circle-notch fa-spin"></i> Auto-filling with AI...
                    </span>
                  )}
                </label>
                <input
                  id="report-images"
                  name="images"
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileChange}
                />
                 <small style={{ color: 'var(--text-soft)', marginTop: '4px', display: 'block' }}>
                  {category === 'Documents'
                    ? `⚠️ Documents of type "${documentType.replace('_', ' ')}" require EXACTLY ${(documentType === 'passport' || documentType === 'driving_license' || documentType === 'certificate') ? '1 image' : '2 images (front and back)'}.`
                    : 'Max 2 photos. Supported formats: JPG, PNG.'}
                </small>
              </div>
            </div>

            <button 
              type="submit" 
              className="btn-primary" 
              style={{ width: '100%', justifyContent: 'center', marginTop: '16px' }}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <i className="fas fa-circle-notch fa-spin" style={{ marginRight: '8px' }}></i>
                  Publishing...
                </>
              ) : (
                'Publish Report'
              )}
            </button>
          </form>
        </div>
      </div>

      {/* LOCATION MAP PICKER SUB-MODAL */}
      {showPicker && (
        <div className="modal active" style={{ zIndex: 1100 }}>
          <div className="modal-card" style={{ maxWidth: '520px' }}>
            <div className="modal-title">
              <h3>📍 Map Location Pinpoint</h3>
              <button className="modal-close" onClick={() => setShowPicker(false)}>
                &times;
              </button>
            </div>

            {/* Search bar */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <input
                type="text"
                placeholder="Search a place (e.g. Kathmandu Mall)..."
                value={mapSearch}
                onChange={e => setMapSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleMapSearch()}
                style={{ flex: 1, borderRadius: '10px', padding: '8px 12px', border: '1.5px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-main)', fontSize: '0.9rem' }}
              />
              <button
                type="button"
                className="btn-primary"
                style={{ padding: '8px 14px', borderRadius: '10px', whiteSpace: 'nowrap' }}
                onClick={handleMapSearch}
                disabled={mapSearching}
              >
                {mapSearching ? '...' : '🔍 Search'}
              </button>
            </div>

            <div
              id="pickerMap"
              style={{
                height: '320px',
                width: '100%',
                borderRadius: 'var(--r-md)',
                marginBottom: '16px',
              }}
            ></div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-soft)', margin: '-8px 0 12px' }}>
              🖱️ Click anywhere on the map to drop a pin, or search a place above.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={confirmLocation}>
                Confirm Pin
              </button>
              <button
                className="btn-primary"
                style={{
                  flex: 1,
                  background: 'var(--surface-2)',
                  color: 'var(--text-muted)',
                  border: '1.5px solid var(--border)',
                  boxShadow: 'none',
                  justifyContent: 'center',
                }}
                onClick={() => setShowPicker(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IMAGE MISMATCH DIALOG */}
      {showMismatchDialog && mismatchDetails && (
        <div className="modal active" style={{ zIndex: 2000 }} onClick={handleMismatchDismiss}>
          <div className="modal-card" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              <h3>⚠️ Image Verification Alert</h3>
              <button className="modal-close" onClick={handleMismatchDismiss}>
                &times;
              </button>
            </div>

            <div style={{ padding: '20px 0' }}>
              <div style={{ 
                background: 'var(--lost-bg)', 
                borderRadius: '12px', 
                padding: '20px',
                border: '1px solid rgba(244,63,94,0.2)'
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ 
                    fontSize: '1.5rem', 
                    color: 'var(--lost)',
                    flexShrink: 0
                  }}>
                    <i className="fas fa-exclamation-triangle"></i>
                  </div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: '0 0 8px', fontSize: '1rem', color: 'var(--text-main)' }}>
                      Image May Not Match Category
                    </h4>
                    <p style={{ margin: '0 0 12px', fontSize: '0.85rem', color: 'var(--text-soft)', lineHeight: '1.5' }}>
                      Our AI detected that your uploaded image may not match the selected category or title.
                    </p>
                    <div style={{ 
                      background: 'rgba(255,255,255,0.5)', 
                      borderRadius: '8px', 
                      padding: '12px',
                      fontSize: '0.82rem'
                    }}>
                      <div style={{ marginBottom: '6px' }}>
                        <strong style={{ color: 'var(--text-main)' }}>Your selection:</strong>
                        <span style={{ color: 'var(--text-soft)', marginLeft: '8px' }}>
                          Title: "{mismatchDetails.title}" | Category: "{mismatchDetails.category}"
                        </span>
                      </div>
                      <div>
                        <strong style={{ color: 'var(--text-main)' }}>AI message:</strong>
                        <span style={{ color: 'var(--text-soft)', marginLeft: '8px' }}>
                          {mismatchDetails.reason}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-soft)', margin: '0 0 16px' }}>
              Please either update your category/title to match the image, or upload a different image that matches your description.
            </p>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className="btn-primary"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={handleMismatchUpdateCategory}
              >
                <i className="fas fa-edit"></i> Update Category
              </button>
              <button
                className="btn-primary"
                style={{
                  flex: 1,
                  background: 'var(--surface-2)',
                  color: 'var(--text-muted)',
                  border: '1.5px solid var(--border)',
                  boxShadow: 'none',
                  justifyContent: 'center',
                }}
                onClick={handleMismatchDismiss}
              >
                Cancel Submission
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

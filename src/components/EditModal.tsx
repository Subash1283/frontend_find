import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import imageCompression from 'browser-image-compression';

interface EditModalProps {
  token: string;
  apiBase: string;
  itemId: number;
  onClose: () => void;
  onSuccess: () => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

export const EditModal: React.FC<EditModalProps> = ({
  token,
  apiBase,
  itemId,
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
  const [status, setStatus] = useState('active');
  const [files, setFiles] = useState<File[] | null>(null);
  const [documentType, setDocumentType] = useState('citizenship');

  const [isLoading, setIsLoading] = useState(true);
  const [imageFrontPreview, setImageFrontPreview] = useState<string | null>(null);
  const [imageBackPreview, setImageBackPreview] = useState<string | null>(null);

  // Map picker state
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

  // Load item details
  useEffect(() => {
    const fetchItem = async () => {
      try {
        const res = await fetch(`${apiBase}/items/${itemId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const item = await res.json();
          setTitle(item.title || '');
          setCategory(item.category || 'Electronics');
          setDocumentType(item.documentType || 'citizenship');
          setType(item.type || 'lost');
          setLocation(item.location || '');
          setLatitude(item.latitude ? String(item.latitude) : '');
          setLongitude(item.longitude ? String(item.longitude) : '');
          setDescription(item.description || '');
          setSensitive(item.sensitive || '');
          setSensitiveBlur(!!item.sensitiveBlur);
          setReward(item.reward ? String(item.reward) : '0');
          setCurrency(item.currency || 'NPR');
          setStatus(item.status || 'active');
          setImageFrontPreview(item.imageFront ? `${apiBase}/uploads/items/${item.imageFront}` : null);
          setImageBackPreview(item.imageBack ? `${apiBase}/uploads/items/${item.imageBack}` : null);
        } else {
          showToast('Failed to load item info', 'error');
          onClose();
        }
      } catch {
        showToast('Error connecting to backend', 'error');
        onClose();
      } finally {
        setIsLoading(false);
      }
    };

    fetchItem();
  }, [itemId]);

  // Reset files when category or documentType changes
  useEffect(() => {
    setFiles(null);
    const fileInput = document.getElementById('edit-images') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  }, [category, documentType]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;

    if (category === 'Documents') {
      const requiredCount = (documentType === 'passport' || documentType === 'driving_license' || documentType === 'certificate' || documentType === 'student_id') ? 1 : 2;
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

    const compressedFiles: File[] = [];
    const options = {
      maxSizeMB: 1,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
    };

    try {
      showToast('Optimizing image...', 'info');
      for (let i = 0; i < selectedFiles.length; i++) {
        const compressedBlob = await imageCompression(selectedFiles[i], options);
        const compressedFile = new File([compressedBlob], selectedFiles[i].name, {
          type: selectedFiles[i].type,
          lastModified: Date.now(),
        });
        compressedFiles.push(compressedFile);
      }
      setFiles(compressedFiles);
    } catch (error) {
      console.error('Compression error:', error);
      showToast('Image optimization failed, using original', 'error');
      setFiles(Array.from(selectedFiles));
    }
  };

  // Location Picker leaflet map logic
  useEffect(() => {
    if (showPicker) {
      setTimeout(() => {
        const container = document.getElementById('editPickerMap');
        if (!container) return;

        const initialLat = latitude ? parseFloat(latitude) : 27.7172;
        const initialLng = longitude ? parseFloat(longitude) : 85.3240;

        if (!pickerMapRef.current) {
          const map = L.map('editPickerMap').setView([initialLat, initialLng], 13);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
          }).addTo(map);

          const initialMarker = L.marker([initialLat, initialLng]).addTo(map);
          pickerMarkerRef.current = initialMarker;
          setTempLat(initialLat);
          setTempLng(initialLng);

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
      showToast('Please select a spot on the map', 'error');
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
    showToast('Location updated!', 'success');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return showToast('Title is required', 'error');

    const formData = new FormData();
    formData.append('title', title.trim());
    formData.append('category', category);
    if (category === 'Documents') {
      formData.append('documentType', documentType);
    }
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
    formData.append('status', status);

    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        formData.append('images', files[i]);
      }
    }

    try {
      const res = await fetch(`${apiBase}/items/${itemId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) {
        showToast('Report updated successfully!', 'success');
        onSuccess();
      } else {
        const errorText = await res.text();
        showToast(errorText || 'Failed to update report', 'error');
      }
    } catch {
      showToast('Connection error to backend', 'error');
    }
  };

  if (isLoading) {
    return (
      <div className="modal active">
        <div className="modal-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <i className="fas fa-circle-notch fa-spin" style={{ fontSize: '2rem', color: 'var(--accent)' }}></i>
          <p style={{ marginTop: '1rem', color: 'var(--text-soft)' }}>Fetching details...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="modal active" onClick={onClose}>
        <div className="modal-card" onClick={e => e.stopPropagation()}>
          <div className="modal-title">
            <h3>✏️ Edit Report</h3>
            <button className="modal-close" onClick={onClose}>
              &times;
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="edit-title">Item Name / Title</label>
                <input
                  id="edit-title"
                  name="title"
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="edit-category">Category</label>
                <select id="edit-category" name="category" value={category} onChange={e => setCategory(e.target.value)}>
                  <option value="Electronics">Electronics</option>
                  <option value="Documents">Documents</option>
                  <option value="Vechiles">Vechiles</option>
                  <option value="Keys">Keys</option>
                  <option value="Clothing">Clothing</option>
                  <option value="Wallets & Bags">Wallets & Bags</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="edit-type">Report Type</label>
                <select id="edit-type" name="type" value={type} onChange={e => setType(e.target.value)}>
                  <option value="lost">Lost</option>
                  <option value="found">Found</option>
                </select>
              </div>
            </div>

            {category === 'Documents' && (
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="edit-document-type">Document Type</label>
                  <select 
                    id="edit-document-type" 
                    name="documentType" 
                    value={documentType} 
                    onChange={e => setDocumentType(e.target.value)}
                  >
                    <option value="citizenship">Citizenship Card (Requires Front & Back - 2 Images)</option>
                    <option value="passport">Passport (Requires Front Only - 1 Image)</option>
                    <option value="driving_license">Driving License (Requires Front Only - 1 Image)</option>
                    <option value="certificate">Certificate (Requires Front Only - 1 Image)</option>
                    <option value="student_id">🎓 Student ID Card (Requires Front Only - 1 Image)</option>
                  </select>
                </div>
              </div>
            )}

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="edit-status">Status</label>
                <select id="edit-status" name="status" value={status} onChange={e => setStatus(e.target.value)}>
                  <option value="active">Active Feed (Public)</option>
                  <option value="resolved">Resolved (Closed)</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="edit-location">Location Name</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    id="edit-location"
                    name="location"
                    type="text"
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
                <label htmlFor="edit-latitude">Latitude</label>
                <input
                  id="edit-latitude"
                  name="latitude"
                  type="text"
                  value={latitude}
                  onChange={e => setLatitude(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-longitude">Longitude</label>
                <input
                  id="edit-longitude"
                  name="longitude"
                  type="text"
                  value={longitude}
                  onChange={e => setLongitude(e.target.value)}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="edit-description">Detailed Description</label>
                <textarea
                  id="edit-description"
                  name="description"
                  rows={3}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                ></textarea>
              </div>
            </div>

            {!isFound && (
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="edit-reward">Offer Reward Amount</label>
                  <input
                    id="edit-reward"
                    name="reward"
                    type="number"
                    value={reward}
                    onChange={e => setReward(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ flex: '0.4' }}>
                  <label htmlFor="edit-currency">Currency</label>
                  <select id="edit-currency" name="currency" value={currency} onChange={e => setCurrency(e.target.value)}>
                    <option value="NPR">NPR</option>
                    <option value="USD">USD</option>
                    <option value="INR">INR</option>
                  </select>
                </div>
              </div>
            )}

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="edit-sensitive">Sensitive content note</label>
                <input
                  id="edit-sensitive"
                  name="sensitive"
                  type="text"
                  value={sensitive}
                  onChange={e => setSensitive(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '24px' }}>
                <input
                  type="checkbox"
                  id="editBlurCheck"
                  checked={sensitiveBlur}
                  onChange={e => setSensitiveBlur(e.target.checked)}
                  style={{ width: 'auto', transform: 'scale(1.2)', cursor: 'pointer' }}
                />
                <label htmlFor="editBlurCheck" style={{ cursor: 'pointer', margin: 0 }}>
                  Mask Sensitive Image
                </label>
              </div>
              {sensitiveBlur && (
                <small style={{ color: 'var(--text-soft)', marginTop: '6px', display: 'block' }}>
                  Images will be blurred and require manual reveal. The sensitive text note will be masked with partial characters.
                </small>
              )}
            </div>

            {/* Existing image previews */}
            {(imageFrontPreview || imageBackPreview) && (
              <div className="form-row" style={{ marginBottom: '14px' }}>
                <div className="form-group">
                  <label>Current Images</label>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                    {imageFrontPreview && (
                      <div style={{ flex: 1, position: 'relative' }}>
                        <img
                          src={imageFrontPreview}
                          alt="Front"
                          style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border)' }}
                        />
                        <span style={{ position: 'absolute', bottom: '2px', left: '2px', background: 'rgba(0,0,0,0.6)', color: 'white', padding: '1px 4px', fontSize: '10px', borderRadius: '4px' }}>Front</span>
                      </div>
                    )}
                    {imageBackPreview && (
                      <div style={{ flex: 1, position: 'relative' }}>
                        <img
                          src={imageBackPreview}
                          alt="Back"
                          style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border)' }}
                        />
                        <span style={{ position: 'absolute', bottom: '2px', left: '2px', background: 'rgba(0,0,0,0.6)', color: 'white', padding: '1px 4px', fontSize: '10px', borderRadius: '4px' }}>Back</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="edit-images">Replace Images (Select files to overwrite)</label>
                <input
                  id="edit-images"
                  name="images"
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileChange}
                />
                <small style={{ color: 'var(--text-soft)', marginTop: '4px', display: 'block' }}>
                  {category === 'Documents'
                    ? `⚠️ Documents of type "${documentType.replace('_', ' ')}" require EXACTLY ${(documentType === 'passport' || documentType === 'driving_license' || documentType === 'certificate' || documentType === 'student_id') ? '1 image' : '2 images (front and back)'}. Leave empty to keep existing.`
                    : 'Leave empty to keep existing images. Oversubscribing uploads will overwrite both slots.'}
                </small>
              </div>
            </div>

            <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '16px' }}>
              Save Changes
            </button>
          </form>
        </div>
      </div>

      {/* LOCATION MAP PICKER SUB-MODAL */}
      {showPicker && (
        <div className="modal active" style={{ zIndex: 1100 }}>
          <div className="modal-card" style={{ maxWidth: '520px' }}>
            <div className="modal-title">
              <h3>📍 Map Location Picker</h3>
              <button className="modal-close" onClick={() => setShowPicker(false)}>
                &times;
              </button>
            </div>

            {/* Search bar */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <input
                type="text"
                placeholder="Search a place (e.g. Thamel, Kathmandu)..."
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
              id="editPickerMap"
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
                Confirm Location
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
    </>
  );
};

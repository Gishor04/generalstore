import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Filter, Edit, Trash2, Package, Tag, AlertTriangle, Layers, X, Scale, Camera, Upload, Image as ImageIcon, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Product } from '../types';
import { PinModal } from './PinModal';

interface ProductsViewProps {
  token: string | null;
  addToast: (text: string, type: 'success' | 'error' | 'warning') => void;
  userRole: 'owner' | 'staff';
}

export function ProductsView({ token, addToast, userRole }: ProductsViewProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [categories, setCategories] = useState<string[]>([]);

  // Modal / Drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [lowStockThreshold, setLowStockThreshold] = useState('10');
  const [image, setImage] = useState<string>('');

  // Camera settings state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const closeDrawer = () => {
    stopCamera();
    setIsDrawerOpen(false);
  };

  // Security PIN states
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    type: 'add' | 'edit' | 'delete';
    id?: string;
    payload?: any;
  } | null>(null);

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/products', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setProducts(data);

        // Extract unique categories
        const uniqueCats = Array.from(new Set(data.map((p: Product) => p.category))) as string[];
        setCategories(uniqueCats);
      } else {
        addToast('Failed to retrieve inventory product list.', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('Error communicating with server.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // Camera and File Upload Handlers
  const startCamera = async () => {
    setCameraError(null);
    setIsCameraActive(true);
    try {
      setTimeout(async () => {
        try {
          const constraints = {
            video: {
              facingMode: 'environment',
              width: { ideal: 640 },
              height: { ideal: 480 }
            }
          };
          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(e => console.error("Error playing video:", e));
          }
        } catch (e: any) {
          console.error("Camera access error inside timeout:", e);
          setCameraError(e.message || "Failed to access camera stream. Make sure you gave permission.");
        }
      }, 150);
    } catch (err: any) {
      console.error("Camera error:", err);
      setCameraError(err.message || "Could not start camera.");
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setImage(dataUrl);
        stopCamera();
        addToast('Photo captured successfully!', 'success');
      }
    } catch (err) {
      console.error("Capture photo error:", err);
      addToast('Failed to capture photo.', 'error');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      addToast('Please upload an image file.', 'warning');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      addToast('Image size should be less than 2MB.', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImage(reader.result);
        addToast('Image uploaded successfully.', 'success');
      }
    };
    reader.onerror = () => {
      addToast('Failed to read image file.', 'error');
    };
    reader.readAsDataURL(file);
  };

  // Action handlers
  const handleOpenAddDrawer = () => {
    setEditingProduct(null);
    setName('');
    setCategory('');
    setPrice('');
    setCostPrice('');
    setQuantity('');
    setUnit('pcs');
    setLowStockThreshold('10');
    setImage('');
    setIsDrawerOpen(true);
  };

  const handleOpenEditDrawer = (product: Product) => {
    setEditingProduct(product);
    setName(product.name);
    setCategory(product.category);
    setPrice(product.price.toString());
    setCostPrice(product.costPrice.toString());
    setQuantity(product.quantity.toString());
    setUnit(product.unit);
    setLowStockThreshold(product.lowStockThreshold.toString());
    setImage(product.image || '');
    setIsDrawerOpen(true);
  };

  const triggerAddProduct = () => {
    if (!name || !category || !price || !quantity || !unit) {
      addToast('Please fill out all required fields.', 'warning');
      return;
    }

    setPendingAction({
      type: 'add',
      payload: {
        name,
        category,
        price: Number(price),
        costPrice: Number(costPrice || 0),
        quantity: Number(quantity),
        unit,
        lowStockThreshold: Number(lowStockThreshold),
        image: image || undefined,
      },
    });
    setIsPinModalOpen(true);
  };

  const triggerEditProduct = () => {
    if (!editingProduct) return;
    if (!name || !category || !price || !quantity || !unit) {
      addToast('Please fill out all required fields.', 'warning');
      return;
    }

    setPendingAction({
      type: 'edit',
      id: editingProduct.id,
      payload: {
        name,
        category,
        price: Number(price),
        costPrice: Number(costPrice || 0),
        quantity: Number(quantity),
        unit,
        lowStockThreshold: Number(lowStockThreshold),
        image: image || undefined,
      },
    });
    setIsPinModalOpen(true);
  };

  const triggerDeleteProduct = (id: string) => {
    setPendingAction({ type: 'delete', id });
    setIsPinModalOpen(true);
  };

  // Securely call server with PIN header
  const handlePinSuccess = async (verifiedPin: string) => {
    if (!pendingAction) return;

    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-security-pin': verifiedPin,
      };

      if (pendingAction.type === 'add') {
        const response = await fetch('/api/products', {
          method: 'POST',
          headers,
          body: JSON.stringify(pendingAction.payload),
        });

        if (response.ok) {
          addToast('Product added to inventory successfully.', 'success');
          setIsDrawerOpen(false);
          fetchProducts();
        } else {
          const errData = await response.json();
          addToast(errData.error || 'Failed to add product.', 'error');
        }
      } else if (pendingAction.type === 'edit') {
        const response = await fetch(`/api/products/${pendingAction.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(pendingAction.payload),
        });

        if (response.ok) {
          addToast('Product details updated successfully.', 'success');
          setIsDrawerOpen(false);
          fetchProducts();
        } else {
          const errData = await response.json();
          addToast(errData.error || 'Failed to update product.', 'error');
        }
      } else if (pendingAction.type === 'delete') {
        const response = await fetch(`/api/products/${pendingAction.id}`, {
          method: 'DELETE',
          headers,
        });

        if (response.ok) {
          addToast('Product deleted from inventory.', 'success');
          fetchProducts();
        } else {
          const errData = await response.json();
          addToast(errData.error || 'Failed to delete product.', 'error');
        }
      }
    } catch (err) {
      console.error(err);
      addToast('A network error occurred.', 'error');
    } finally {
      setPendingAction(null);
    }
  };

  // Filters
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-160px)]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-semibold text-slate-500">Loading store inventory...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      {/* Upper Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm shadow-slate-100/40">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Product Inventory</h2>
          <p className="text-sm text-slate-500">Add new stocks, revise rates, and verify current quantities.</p>
        </div>
        <button
          onClick={handleOpenAddDrawer}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition-all shadow-md shadow-indigo-600/10 active:scale-95 self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          Add Product
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col md:flex-row gap-3">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search products by name or category..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl pl-11 pr-4 py-2.5 text-sm font-medium outline-none transition-all"
          />
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2 min-w-[180px]">
          <Filter className="h-4 w-4 text-slate-400 shrink-0" />
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl px-3 py-2.5 text-sm font-semibold outline-none transition-all cursor-pointer text-slate-700"
          >
            <option value="all">All Categories</option>
            {categories.map((cat, idx) => (
              <option key={idx} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Catalog Table Card */}
      <div className="bg-white border border-slate-100 shadow-sm shadow-slate-100/40 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm text-slate-500">
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 border-b border-slate-100">
              <tr>
                <th scope="col" className="px-6 py-4">Product details</th>
                <th scope="col" className="px-6 py-4">Category</th>
                <th scope="col" className="px-6 py-4 text-right">Selling Price</th>
                <th scope="col" className="px-6 py-4 text-right">Cost Price</th>
                <th scope="col" className="px-6 py-4 text-center">Stock Level</th>
                <th scope="col" className="px-6 py-4 text-center">Alert Limit</th>
                <th scope="col" className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.length > 0 ? (
                filteredProducts.map((p) => {
                  const isLowStock = p.quantity <= p.lowStockThreshold;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl overflow-hidden shrink-0 bg-slate-50 border border-slate-200/60 flex items-center justify-center">
                          {p.image ? (
                            <img src={p.image} alt={p.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <Package className={`h-5 w-5 ${isLowStock ? 'text-rose-500' : 'text-slate-400'}`} />
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 leading-tight">{p.name}</p>
                          <span className="text-[10px] text-slate-400 font-semibold uppercase">{p.id}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full">
                          <Tag className="h-3 w-3" />
                          {p.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-slate-900">${p.price.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right font-semibold text-slate-400">${p.costPrice.toFixed(2)}</td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 font-bold">
                          <span className={`${isLowStock ? 'text-rose-600' : 'text-slate-800'}`}>
                            {p.quantity} {p.unit}
                          </span>
                          {isLowStock && (
                            <span className="p-0.5 bg-rose-50 text-rose-600 rounded-full" title="Low Stock Warn!">
                              <AlertTriangle className="h-3.5 w-3.5" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center text-slate-400 font-semibold">
                        {p.lowStockThreshold} {p.unit}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEditDrawer(p)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            title="Edit product"
                          >
                            <Edit className="h-4.5 w-4.5" />
                          </button>
                          <button
                            onClick={() => triggerDeleteProduct(p.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                            title="Delete product"
                          >
                            <Trash2 className="h-4.5 w-4.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400">
                    <Package className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-sm">No products found</p>
                    <p className="text-xs text-slate-400 mt-1">Try modifying your search or filter options.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Sliding Drawer */}
      <AnimatePresence>
        {isDrawerOpen && (
          <div className="fixed inset-0 z-40 flex justify-end">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeDrawer}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />

            {/* Drawer Body */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="relative w-full max-w-md bg-white h-full shadow-2xl border-l border-slate-100 flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 p-6">
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">
                    {editingProduct ? 'Edit Inventory Product' : 'Register New Product'}
                  </h3>
                  <p className="text-xs text-slate-500">Provide product specification details to commit changes.</p>
                </div>
                <button
                  onClick={closeDrawer}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Form Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {/* Product Image Option (Camera & Upload) */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Product Image</label>
                  
                  {isCameraActive ? (
                    <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-black aspect-video flex flex-col justify-between">
                      <video 
                        ref={videoRef} 
                        playsInline 
                        muted 
                        className="w-full h-full object-cover"
                      />
                      
                      {cameraError ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-slate-900/90 text-center text-white">
                          <AlertTriangle className="h-8 w-8 text-rose-500 mb-2" />
                          <p className="text-xs font-bold">{cameraError}</p>
                          <button
                            type="button"
                            onClick={startCamera}
                            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-900 bg-white hover:bg-slate-50 rounded-lg transition-all"
                          >
                            <RefreshCw className="h-3 w-3" /> Retry Connection
                          </button>
                        </div>
                      ) : null}

                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={capturePhoto}
                          className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-lg flex items-center gap-1.5 transition-all"
                        >
                          <Camera className="h-3.5 w-3.5" /> Capture Frame
                        </button>
                        <button
                          type="button"
                          onClick={stopCamera}
                          className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-md transition-all"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : image ? (
                    <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50 aspect-video flex items-center justify-center group">
                      <img src={image} alt="Preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                        <button
                          type="button"
                          onClick={startCamera}
                          className="p-2 bg-white text-slate-700 hover:text-indigo-600 rounded-full shadow-lg transition-all"
                          title="Retake Photo"
                        >
                          <Camera className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const fileInput = document.getElementById('file-upload-input');
                            if (fileInput) fileInput.click();
                          }}
                          className="p-2 bg-white text-slate-700 hover:text-indigo-600 rounded-full shadow-lg transition-all"
                          title="Upload Different Image"
                        >
                          <Upload className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setImage('')}
                          className="p-2 bg-white text-rose-600 hover:bg-rose-50 rounded-full shadow-lg transition-all"
                          title="Remove Image"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-200 p-5 bg-slate-50/50 hover:bg-slate-50 transition-colors text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="p-2 rounded-lg bg-white shadow-sm border border-slate-100 text-slate-400 mb-3">
                          <ImageIcon className="h-6 w-6" />
                        </div>
                        <p className="text-xs font-bold text-slate-700">No Image Specified</p>
                        <p className="text-[10px] text-slate-400 mt-0.5 mb-4">Add a snap via camera or upload standard file</p>
                        
                        <div className="flex items-center gap-2 justify-center">
                          <button
                            type="button"
                            onClick={startCamera}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-indigo-600 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-lg shadow-sm transition-all"
                          >
                            <Camera className="h-3.5 w-3.5" /> Use Camera
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => {
                              const fileInput = document.getElementById('file-upload-input');
                              if (fileInput) fileInput.click();
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-indigo-600 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-lg shadow-sm transition-all"
                          >
                            <Upload className="h-3.5 w-3.5" /> Upload File
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Hidden file input */}
                  <input
                    id="file-upload-input"
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
                {/* Product Name */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Product Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Organic Whole Milk"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-4 py-2 text-sm font-medium outline-none transition-all"
                  />
                </div>

                {/* Category */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Category *</label>
                  <div className="relative">
                    <Layers className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      required
                      placeholder="e.g., Dairy, Groceries, Beverages"
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl pl-10 pr-4 py-2 text-sm font-medium outline-none transition-all"
                      list="category-suggestions"
                    />
                    <datalist id="category-suggestions">
                      {categories.map((cat, idx) => (
                        <option key={idx} value={cat} />
                      ))}
                    </datalist>
                  </div>
                </div>

                {/* Price and Cost Grid */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Price */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Selling Price * ($)</label>
                    <input
                      type="number"
                      required
                      min={0}
                      step="0.01"
                      placeholder="0.00"
                      value={price}
                      onChange={e => setPrice(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-4 py-2 text-sm font-medium outline-none transition-all"
                    />
                  </div>
                  {/* Cost Price */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Cost Price ($)</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="0.00"
                      value={costPrice}
                      onChange={e => setCostPrice(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-4 py-2 text-sm font-medium outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Quantity and Unit Grid */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Quantity */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Stock Count *</label>
                    <input
                      type="number"
                      required
                      min={0}
                      placeholder="0"
                      value={quantity}
                      onChange={e => setQuantity(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-4 py-2 text-sm font-medium outline-none transition-all"
                    />
                  </div>
                  {/* Unit Selection */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Unit *</label>
                    <div className="relative">
                      <Scale className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                      <select
                        value={unit}
                        onChange={e => setUnit(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl pl-10 pr-4 py-2 text-sm font-semibold outline-none transition-all cursor-pointer text-slate-700"
                      >
                        <option value="pcs">Pieces (pcs)</option>
                        <option value="kg">Kilograms (kg)</option>
                        <option value="litre">Litres (litre)</option>
                        <option value="box">Boxes (box)</option>
                        <option value="pack">Packs (pack)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Low Stock Threshold */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Low Stock Threshold Limit</label>
                  <input
                    type="number"
                    min={0}
                    value={lowStockThreshold}
                    onChange={e => setLowStockThreshold(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-4 py-2 text-sm font-medium outline-none transition-all"
                  />
                  <p className="text-[10px] text-slate-400">Triggers alert warnings when stock drops to or below this count.</p>
                </div>
              </div>

              {/* Action Drawer Footer */}
              <div className="border-t border-slate-100 p-6 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="flex-1 border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold text-sm px-4 py-2.5 rounded-xl transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={editingProduct ? triggerEditProduct : triggerAddProduct}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm px-4 py-2.5 rounded-xl shadow-md shadow-indigo-600/15 transition-all active:scale-95"
                >
                  {editingProduct ? 'Update Product' : 'Register Product'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Security Verification PIN Modal */}
      <PinModal
        isOpen={isPinModalOpen}
        onClose={() => {
          setIsPinModalOpen(false);
          setPendingAction(null);
        }}
        onSuccess={handlePinSuccess}
        title="Security PIN Verification"
        description={
          pendingAction?.type === 'delete'
            ? 'Deleting this product requires authorization. Please enter your 4-digit PIN.'
            : 'Modifying the inventory requires authorization. Please enter your 4-digit PIN.'
        }
        token={token}
      />
    </div>
  );
}

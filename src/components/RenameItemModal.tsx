'use client';

import React, { useState } from 'react';
import { 
  X, 
  AlertTriangle, 
  Info, 
  Search, 
  Edit3, 
  RefreshCw, 
  Database, 
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  Undo2,
  Shield,
  Zap
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface RenameResult {
  success: boolean;
  totalCollections: number;
  collectionsProcessed: number;
  totalDocuments: number;
  documentsUpdated: number;
  errors: string[];
  details: CollectionResult[];
  backupId?: string;
  duration: number;
  dryRun: boolean;
}

interface CollectionResult {
  collection: string;
  documentsFound: number;
  documentsUpdated: number;
  fields: string[];
  error?: string;
}

interface RenameItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function RenameItemModal({ isOpen, onClose, onSuccess }: RenameItemModalProps) {
  const [oldName, setOldName] = useState('');
  const [newName, setNewName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastResult, setLastResult] = useState<RenameResult | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewResult, setPreviewResult] = useState<RenameResult | null>(null);
  const [showWarnings, setShowWarnings] = useState(false);
  const [currentStep, setCurrentStep] = useState<'input' | 'preview' | 'warning' | 'result'>('input');

  if (!isOpen) return null;

  // ================ Reset Function ================
  const handleReset = () => {
    setOldName('');
    setNewName('');
    setLastResult(null);
    setShowPreview(false);
    setPreviewResult(null);
    setShowWarnings(false);
    setCurrentStep('input');
  };

  // ================ Close Function ================
  const handleClose = () => {
    if (!isLoading) {
      handleReset();
      onClose();
    }
  };

  // ================ Preview Function ================
  const handlePreview = async () => {
    if (!oldName.trim()) {
      toast.error('กรุณาระบุชื่อเดิมที่ต้องการตรวจสอบ');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/rename-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'preview',
          oldName: oldName.trim()
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setPreviewResult(data.result);
        setCurrentStep('preview');
        toast.success(`พบข้อมูลที่จะได้รับผลกระทบ: ${data.result.totalDocuments} รายการ`);
      } else {
        toast.error(data.error || 'เกิดข้อผิดพลาดในการตรวจสอบ');
      }
    } catch (error) {
      console.error('Preview error:', error);
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setIsLoading(false);
    }
  };

  // ================ Rename Function ================
  const handleRename = async (dryRun: boolean = false) => {
    if (!oldName.trim() || !newName.trim()) {
      toast.error('กรุณากรอกชื่อเดิมและชื่อใหม่');
      return;
    }

    if (oldName.trim() === newName.trim()) {
      toast.error('ชื่อเดิมและชื่อใหม่ต้องไม่เหมือนกัน');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/rename-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rename',
          oldName: oldName.trim(),
          newName: newName.trim(),
          options: {
            dryRun,
            createBackup: !dryRun,
            batchSize: 1000
          }
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setLastResult(data.result);
        setCurrentStep('result');
        if (dryRun) {
          toast.success(`ทดสอบสำเร็จ: จะมีการเปลี่ยน ${data.result.documentsUpdated} รายการ`);
        } else {
          toast.success(`เปลี่ยนชื่อสำเร็จ: "${oldName}" → "${newName}"`);
          if (onSuccess) onSuccess();
        }
      } else {
        toast.error(data.error || 'เกิดข้อผิดพลาดในการเปลี่ยนชื่อ');
        if (data.result) {
          setLastResult(data.result);
          setCurrentStep('result');
        }
      }
    } catch (error) {
      console.error('Rename error:', error);
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setIsLoading(false);
    }
  };

  // ================ Rollback Function ================
  const handleRollback = async () => {
    if (!lastResult?.backupId) {
      toast.error('ไม่พบข้อมูล backup ให้กู้คืน');
      return;
    }

    if (!confirm(`ต้องการกู้คืนข้อมูลจาก backup ${lastResult.backupId}?`)) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/rename-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rollback',
          backupId: lastResult.backupId
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success('กู้คืนข้อมูลสำเร็จ');
        setLastResult(null);
        setCurrentStep('input');
        if (onSuccess) onSuccess();
      } else {
        toast.error(data.error || 'เกิดข้อผิดพลาดในการกู้คืน');
      }
    } catch (error) {
      console.error('Rollback error:', error);
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-white/20">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Edit3 className="w-6 h-6" />
              <div>
                <h2 className="text-xl font-semibold">เปลี่ยนชื่ออุปกรณ์</h2>
                <p className="text-blue-100 text-sm">เปลี่ยนชื่ออุปกรณ์ในระบบทั้งหมด รวมถึงข้อมูลย้อนหลัง</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowWarnings(!showWarnings)}
                className="flex items-center space-x-1 px-3 py-1.5 bg-yellow-500/20 text-yellow-100 rounded-lg hover:bg-yellow-500/30 transition-colors text-sm"
              >
                <AlertTriangle className="w-4 h-4" />
                <span>คำเตือน</span>
              </button>
              <button
                onClick={handleClose}
                disabled={isLoading}
                className="text-white/70 hover:text-white transition-colors disabled:opacity-50"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="max-h-[calc(90vh-140px)] overflow-y-auto">

          {/* Warning Section */}
          {showWarnings && (
            <div className="p-6 space-y-4 bg-gradient-to-r from-red-50 to-orange-50 border-b">
              {/* Critical Warning */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <Shield className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-red-800 mb-2">⚠️ คำเตือนสำคัญ</h3>
                    <div className="text-red-700 text-sm space-y-1">
                      <p>• <strong>ข้อมูลทั้งหมด</strong> ที่เคยเป็น "{oldName || 'ชื่อเดิม'}" จะกลายเป็น "{newName || 'ชื่อใหม่'}"</p>
                      <p>• <strong>รายงานเก่า</strong> จะแสดงชื่อใหม่ (ไม่ใช่ชื่อตอนที่ทำรายการ)</p>
                      <p>• <strong>การเปลี่ยนแปลงมีผลทันที</strong> ในทุกหน้าของระบบ</p>
                      <p>• <strong>ผู้ใช้ทุกคน</strong> จะเห็นชื่อใหม่ทันทีหลังการเปลี่ยน</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Process Information */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <Info className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-blue-800 mb-2">📋 ขั้นตอนการดำเนินการ</h3>
                    <div className="text-blue-700 text-sm">
                      <p className="mb-2">ระบบจะดำเนินการ: สร้าง Backup → ตรวจสอบข้อมูล → เปลี่ยนชื่อ → ตรวจสอบผลลัพธ์</p>
                      <p><strong>🔄 สามารถกู้คืนได้ภายใน 24 ชม.</strong></p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Main Content */}
          <div className="p-6">

            {/* Input Step */}
            {currentStep === 'input' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Old Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ชื่อเดิม *
                    </label>
                    <input
                      type="text"
                      value={oldName}
                      onChange={(e) => setOldName(e.target.value)}
                      placeholder="เช่น Mouse"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* New Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ชื่อใหม่ *
                    </label>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="เช่น เม้า"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Preview Section */}
                {oldName && newName && oldName !== newName && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2 text-green-800 mb-2">
                      <Zap className="w-4 h-4" />
                      <span className="font-medium">การเปลี่ยนแปลง:</span>
                    </div>
                    <div className="text-lg">
                      <span className="text-red-600 line-through">"{oldName}"</span>
                      <span className="mx-2">→</span>
                      <span className="text-green-600 font-medium">"{newName}"</span>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handlePreview}
                    disabled={isLoading || !oldName.trim()}
                    className="flex items-center space-x-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    <span>ดูข้อมูลที่จะได้รับผลกระทบ</span>
                  </button>

                  <button
                    onClick={() => handleRename(true)}
                    disabled={isLoading || !oldName.trim() || !newName.trim()}
                    className="flex items-center space-x-2 px-4 py-2.5 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Search className="w-4 h-4" />
                    <span>ทดสอบ (Dry Run)</span>
                  </button>

                  <button
                    onClick={() => setCurrentStep('warning')}
                    disabled={isLoading || !oldName.trim() || !newName.trim()}
                    className="flex items-center space-x-2 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Database className="w-4 h-4" />
                    <span>เปลี่ยนชื่อจริง</span>
                  </button>
                </div>
              </div>
            )}

            {/* Preview Step */}
            {currentStep === 'preview' && previewResult && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">ข้อมูลที่จะได้รับผลกระทบ</h3>
                  <button
                    onClick={() => setCurrentStep('input')}
                    className="text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    ← กลับ
                  </button>
                </div>

                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Collections:</span>
                      <span className="ml-2 font-medium">{previewResult.totalCollections}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">รายการทั้งหมด:</span>
                      <span className="ml-2 font-medium text-blue-600">{previewResult.totalDocuments}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {previewResult.details.map((detail, index) => (
                    <div key={index} className="bg-white border rounded-lg p-3">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-gray-800">{detail.collection}</span>
                        <span className="text-blue-600 font-medium">{detail.documentsFound} รายการ</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Fields: {detail.fields.join(', ')}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setCurrentStep('input')}
                    className="flex items-center space-x-2 px-4 py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    <span>กลับแก้ไข</span>
                  </button>
                  <button
                    onClick={() => setCurrentStep('warning')}
                    disabled={!newName.trim()}
                    className="flex items-center space-x-2 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    <span>ดำเนินการเปลี่ยนชื่อ</span>
                  </button>
                </div>
              </div>
            )}

            {/* Warning Step */}
            {currentStep === 'warning' && (
              <div className="space-y-6">
                <div className="text-center">
                  <h3 className="text-xl font-semibold text-red-600 mb-4">⚠️ ยืนยันการเปลี่ยนชื่อ</h3>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                    <div className="text-lg mb-4">
                      <span className="text-red-600 line-through font-medium">"{oldName}"</span>
                      <span className="mx-3">→</span>
                      <span className="text-green-600 font-semibold">"{newName}"</span>
                    </div>
                    <p className="text-red-700 font-medium">
                      การเปลี่ยนแปลงนี้จะมีผลกับข้อมูลทั้งหมดในระบบ
                    </p>
                    <p className="text-red-600 text-sm mt-2">
                      กรุณาตรวจสอบให้แน่ใจก่อนดำเนินการ
                    </p>
                  </div>
                </div>

                <div className="flex justify-center gap-4">
                  <button
                    onClick={() => setCurrentStep('input')}
                    className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={() => handleRename(false)}
                    disabled={isLoading}
                    className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    {isLoading ? 'กำลังดำเนินการ...' : 'ยืนยันเปลี่ยนชื่อ'}
                  </button>
                </div>
              </div>
            )}

            {/* Result Step */}
            {currentStep === 'result' && lastResult && (
              <div className="space-y-6">
                <div className={`rounded-lg p-6 ${lastResult.success ? 'bg-green-50' : 'bg-red-50'}`}>
                  <h3 className={`text-lg font-semibold mb-4 flex items-center ${lastResult.success ? 'text-green-900' : 'text-red-900'}`}>
                    {lastResult.success ? (
                      <CheckCircle className="w-5 h-5 mr-2" />
                    ) : (
                      <XCircle className="w-5 h-5 mr-2" />
                    )}
                    ผลการดำเนินการ {lastResult.dryRun ? '(ทดสอบ)' : ''}
                  </h3>
                  
                  <div className="space-y-4">
                    {/* Summary */}
                    <div className="bg-white rounded-lg p-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Collections:</span>
                          <span className="ml-2 font-medium">{lastResult.collectionsProcessed}/{lastResult.totalCollections}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">เอกสารที่อัปเดต:</span>
                          <span className="ml-2 font-medium text-green-600">{lastResult.documentsUpdated}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">เวลาที่ใช้:</span>
                          <span className="ml-2 font-medium">{(lastResult.duration / 1000).toFixed(2)} วินาที</span>
                        </div>
                        {lastResult.backupId && (
                          <div className="col-span-2">
                            <span className="text-gray-600">Backup ID:</span>
                            <span className="ml-2 font-mono text-xs bg-gray-100 px-2 py-1 rounded">{lastResult.backupId}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Collection Details */}
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {lastResult.details.map((detail, index) => (
                        <div key={index} className={`bg-white rounded-lg p-3 ${detail.error ? 'border-l-4 border-red-400' : ''}`}>
                          <div className="flex justify-between items-center">
                            <span className="font-medium text-gray-800">{detail.collection}</span>
                            <span className={`font-medium ${detail.error ? 'text-red-600' : 'text-green-600'}`}>
                              {detail.error ? 'Error' : `${detail.documentsUpdated}/${detail.documentsFound}`}
                            </span>
                          </div>
                          {detail.error && (
                            <div className="text-xs text-red-600 mt-1">{detail.error}</div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Errors */}
                    {lastResult.errors.length > 0 && (
                      <div className="bg-red-100 rounded-lg p-4">
                        <h4 className="font-medium text-red-800 mb-2">Errors:</h4>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {lastResult.errors.map((error, index) => (
                            <div key={index} className="text-sm text-red-700">• {error}</div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={() => {
                          handleReset();
                          setCurrentStep('input');
                        }}
                        className="px-4 py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                      >
                        เปลี่ยนชื่ออื่น
                      </button>
                      
                      {lastResult.backupId && !lastResult.dryRun && (
                        <button
                          onClick={handleRollback}
                          disabled={isLoading}
                          className="flex items-center space-x-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
                        >
                          <Undo2 className="w-4 h-4" />
                          <span>กู้คืนข้อมูล</span>
                        </button>
                      )}
                      
                      <button
                        onClick={handleClose}
                        disabled={isLoading}
                        className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        เสร็จสิ้น
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Loading Overlay */}
            {isLoading && (
              <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center">
                <div className="flex items-center space-x-3 text-blue-600">
                  <RefreshCw className="w-6 h-6 animate-spin" />
                  <span className="font-medium">กำลังดำเนินการ...</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

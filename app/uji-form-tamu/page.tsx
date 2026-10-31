// SEMENTARA — hapus setelah Task 6 dicek
'use client';

import React, { useState } from 'react';
import FormResep, { ResepTamu } from '../../components/FormResep';

export default function UjiFormTamu() {
  const [hasil, setHasil] = useState<ResepTamu | null>(null);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">
          Uji FormResep Mode Tamu
        </h1>

        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <FormResep
            mode="tamu"
            onKirim={(r) => {
              console.log('onKirim dipanggil:', r);
              setHasil(r);
            }}
          />
        </div>

        {hasil && (
          <div className="bg-green-50 border-2 border-green-500 rounded-xl p-6">
            <h2 className="text-xl font-bold text-green-900 mb-3">
              Hasil onKirim:
            </h2>
            <pre className="bg-white p-4 rounded-lg text-sm overflow-x-auto border border-green-200">
              {JSON.stringify(hasil, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

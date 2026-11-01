'use client';

import { useAlihkanBilaMasuk } from '../AuthLayout';

/** Pengguna yang sudah masuk (termasuk pembuka PWA lewat start_url '/') langsung ke beranda perannya. */
export default function AlihkanBilaMasuk() {
  useAlihkanBilaMasuk();
  return null;
}
